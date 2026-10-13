import {test, expect} from "./fixtures";
import {TEST_CONSTANTS, injectSessionData} from "./test-helpers";
import fs from "fs";
import path from "path";

test.describe("Security Remediation (SEC-01 through SEC-05)", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });
  });

  /* ========================================================================
     SEC-01: Manifest Privileges & Frame Ancestor CSP
     ======================================================================== */
  test("SEC-01: Manifest restricts web_accessible_resources and sets frame-ancestors none", async () => {
    const manifestPath = path.join(process.cwd(), "addon", "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    // Verify CSP extension_pages contains frame-ancestors 'none'
    const csp = manifest.content_security_policy?.extension_pages || "";
    expect(csp).toContain("frame-ancestors 'none'");

    // Verify privileged pages are not exposed in web_accessible_resources
    const webAccessible = manifest.web_accessible_resources || [];
    const allExposedResources = webAccessible.flatMap(entry => entry.resources || []);

    const privilegedPages = [
      "rest-explore.html",
      "data-export.html",
      "data-import.html",
      "inspect.html",
      "options.html",
      "flow-scanner.html",
      "event-monitor.html",
      "debug-log.html",
      "field-manager.html"
    ];

    for (const page of privilegedPages) {
      expect(allExposedResources).not.toContain(page);
    }

    // Only popup.html and inject.js should be accessible to web pages
    expect(allExposedResources).toContain("popup.html");
    expect(allExposedResources).toContain("inject.js");
  });

  /* ========================================================================
     SEC-01 & SEC-05: Background Tab Isolation & Sender URL Validation
     ======================================================================== */
  test("SEC-01 & SEC-05: Background domain whitelist and tab isolation", async ({context}) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const results = await background.evaluate(async () => {
      // Dynamic import of background module functions
      const bg = await import("./background.js");
      const { SF_DOMAIN_REGEX, hostByTab } = bg;

      // 1. Domain whitelist checks
      const validHosts = [
        "my-org.my.salesforce.com",
        "my-org.lightning.force.com",
        "my-org.visualforce.com",
        "my-org.cloudforce.com",
        "gov.salesforce.mil"
      ];
      const invalidHosts = [
        "evil.com",
        "salesforce.com.attacker.com",
        "attacker.salesforce.com.evil.com",
        "not-salesforce.com"
      ];

      const domainValidation = {
        allValidPassed: validHosts.every(h => SF_DOMAIN_REGEX.test(h)),
        allInvalidRejected: invalidHosts.every(h => !SF_DOMAIN_REGEX.test(h))
      };

      // 2. Tab isolation checks
      hostByTab.clear();
      hostByTab.set(1001, "sandbox-org.my.salesforce.com");
      hostByTab.set(1002, "prod-org.my.salesforce.com");

      const tabIsolation = {
        tab1Host: hostByTab.get(1001),
        tab2Host: hostByTab.get(1002),
        unmappedTab: hostByTab.get(9999) === undefined
      };

      // Cleanup test
      hostByTab.delete(1001);
      const cleanupPassed = !hostByTab.has(1001) && hostByTab.get(1002) === "prod-org.my.salesforce.com";

      return {
        domainValidation,
        tabIsolation,
        cleanupPassed
      };
    });

    expect(results.domainValidation.allValidPassed).toBe(true);
    expect(results.domainValidation.allInvalidRejected).toBe(true);
    expect(results.tabIsolation.tab1Host).toBe("sandbox-org.my.salesforce.com");
    expect(results.tabIsolation.tab2Host).toBe("prod-org.my.salesforce.com");
    expect(results.tabIsolation.unmappedTab).toBe(true);
    expect(results.cleanupPassed).toBe(true);
  });

  /* ========================================================================
     SEC-01: REST Explorer Guardrails
     ======================================================================== */
  test("SEC-01: REST Explorer requires user confirmation for state-altering requests", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`);
    await page.waitForSelector("select.slds-select", {timeout: 2000});

    const methodSelect = page.locator('select.slds-select:has(option[value="GET"])');
    const endpointInput = page.locator('input[placeholder*="/services/data/v"]');
    const sendBtn = page.locator('button:has-text("Send")');

    await methodSelect.selectOption("POST");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Account/`);
    await page.locator("textarea.slds-textarea").fill('{ "Name": "SecTest" }');

    let dialogMessage = "";
    page.once("dialog", async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await sendBtn.click();
    expect(dialogMessage).toContain("POST");
    await expect(page.locator("code.language-json")).not.toBeVisible();
  });

  /* ========================================================================
     SEC-02: Formula Neutralization
     ======================================================================== */
  test("SEC-02: Spreadsheet formula injection neutralization across exports", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);

    const neutralized = await page.evaluate(async () => {
      const module = await import("./data-export.js");
      const { neutralizeSpreadsheetFormula } = module;

      return {
        calc: neutralizeSpreadsheetFormula("=cmd|' /C calc'!A0"),
        minus: neutralizeSpreadsheetFormula("-5+2"),
        plus: neutralizeSpreadsheetFormula("+1234"),
        at: neutralizeSpreadsheetFormula("@SUM(A1:A10)"),
        tab: neutralizeSpreadsheetFormula("\tTAB"),
        cr: neutralizeSpreadsheetFormula("\rCR"),
        safeText: neutralizeSpreadsheetFormula("Lead Account"),
        internalAt: neutralizeSpreadsheetFormula("user@salesforce.com")
      };
    });

    expect(neutralized.calc).toBe("'=cmd|' /C calc'!A0");
    expect(neutralized.minus).toBe("'-5+2");
    expect(neutralized.plus).toBe("'+1234");
    expect(neutralized.at).toBe("'@SUM(A1:A10)");
    expect(neutralized.tab).toBe("'\tTAB");
    expect(neutralized.cr).toBe("'\rCR");
    expect(neutralized.safeText).toBe("Lead Account");
    expect(neutralized.internalAt).toBe("user@salesforce.com");
  });

  /* ========================================================================
     SEC-03: Safe Plain-Text Flow Descriptions
     ======================================================================== */
  test("SEC-03: Flow description rendered safely as plain text without dangerouslySetInnerHTML", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/flow-scanner.html?host=${mockHost}&flowDefId=300000000000000AAA&flowId=301000000000000AAA`);

    const result = await page.evaluate(async () => {
      const module = await import("./flow-scanner.js");
      const maliciousHtml = '<strong id="sir-test">test</strong>';

      const flow = {
        label: "Security Test Flow",
        apiName: "Sec_Test",
        status: "Active",
        displayStatus: "Active",
        xmlData: { description: maliciousHtml }
      };

      const tree = module.FlowInfoSection({
        flow,
        elements: [],
        onPurgeVersions: () => {},
        onToggleDescription: () => {},
        handleMouseDown: () => {},
        shouldIgnoreClick: () => false,
        sfHost: "test.my.salesforce.com",
        flowId: "301000000000000AAA"
      });

      function findDesc(node) {
        if (!node || typeof node !== "object") return null;
        if (node.props?.className && node.props.className.split(/\s+/).includes("flow-description")) {
          return node;
        }
        const children = Array.isArray(node.children) ? node.children : [node.children];
        for (const child of children) {
          const found = findDesc(child);
          if (found) return found;
        }
        return null;
      }

      const desc = findDesc(tree);
      return {
        hasDangerouslySetInnerHTML: desc?.props?.dangerouslySetInnerHTML !== undefined,
        isLiteralString: typeof desc?.children === "string" && desc?.children === maliciousHtml,
        hasPreWrap: desc?.props?.style?.whiteSpace === "pre-wrap"
      };
    });

    expect(result.hasDangerouslySetInnerHTML).toBe(false);
    expect(result.isLiteralString).toBe(true);
    expect(result.hasPreWrap).toBe(true);
  });

  /* ========================================================================
     SEC-04: Options Export Secret Filtering
     ======================================================================== */
  test("SEC-04: Options export filters access tokens, session IDs and PKCE verifiers", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/options.html?host=${mockHost}`);

    const result = await page.evaluate(async () => {
      const module = await import("./options.js");
      const { filterExportData, isSecretKey, SECRET_SUFFIXES } = module;

      const mockStorage = {
        "apiVersion": "67.0",
        "popupDarkTheme": "true",
        "test.my.salesforce.com_access_token": "ACCESS_SECRET",
        "test.my.salesforce.com_code_verifier": "VERIFIER_SECRET",
        "test.my.salesforce.com_sid": "SID_SECRET"
      };

      const exported = filterExportData(mockStorage);
      return {
        exportedKeys: Object.keys(exported),
        hasAccessToken: "test.my.salesforce.com_access_token" in exported,
        hasCodeVerifier: "test.my.salesforce.com_code_verifier" in exported,
        hasSid: "test.my.salesforce.com_sid" in exported,
        preservedNormalKey: exported["apiVersion"] === "67.0",
        isSecretKeyToken: isSecretKey("test.my.salesforce.com_access_token"),
        isSecretKeyVerifier: isSecretKey("test.my.salesforce.com_code_verifier"),
        isSecretKeyNormal: isSecretKey("apiVersion")
      };
    });

    expect(result.hasAccessToken).toBe(false);
    expect(result.hasCodeVerifier).toBe(false);
    expect(result.hasSid).toBe(false);
    expect(result.preservedNormalKey).toBe(true);
    expect(result.isSecretKeyToken).toBe(true);
    expect(result.isSecretKeyVerifier).toBe(true);
    expect(result.isSecretKeyNormal).toBe(false);
  });
});
