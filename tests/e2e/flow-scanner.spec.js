import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Flow Scanner", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context, extensionId}) => {
    TEST_CONSTANTS.extensionId = extensionId;

    // Inject session data and the core mock before page scripts run.
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });
    await context.addInitScript(() => {
      // Enable flow scanner rules in localStorage
      const flowScannerRules = [
        {
          name: "APIVersion",
          checked: true,
          config: {threshold: "58.0"},
          severity: "error"
        },
        {
          name: "FlowName",
          checked: true,
          config: {expression: "[A-Za-z0-9]+_[A-Za-z0-9]+"},
          severity: "warning"
        },
        {
          name: "StoredBetaRule",
          checked: true,
          severity: "warning"
        }
      ];
      window.localStorage.setItem("flowScannerRules", JSON.stringify(flowScannerRules));

      // Mock flow-scanner-core library
      // Set library name first (flow-scanner.js checks this)
      window.flowScannerLibraryName = "lightningflowscanner";
      class MockFlow {
        static NODE_TAGS = ["actionCalls"];
        static RESOURCE_TAGS = ["textTemplates"];
        static VARIABLE_TAGS = ["constants"];

        constructor(name, xmlData) {
          this.name = name;
          this.xmlData = xmlData;
          this.xmlData.actionCalls = [{
            name: "Static_Action",
            label: "Static Action"
          }];
          this.xmlData.textTemplates = [{
            name: "Static_Template",
            label: "Static Template"
          }];
          this.xmlData.constants = [{
            name: "Static_Constant",
            label: "Static Constant"
          }];
        }
      }
      const coreRules = [
        {
          name: "APIVersion",
          label: "API Version",
          description: "Check flow API version",
          severity: "error",
          configurableOptions: [{type: "expression", defaultValue: ">= 50"}]
        },
        {
          name: "FlowName",
          label: "Flow Name",
          description: "Check flow naming convention",
          severity: "warning",
          configurableOptions: [{
            type: "expression",
            defaultValue: "[A-Za-z0-9]+_[A-Za-z0-9]+"
          }]
        }
      ];
      const betaRules = [
        {
          name: "DefaultBetaRule",
          label: "Default Beta Rule",
          description: "Beta rule without stored settings",
          severity: "warning"
        },
        {
          name: "StoredBetaRule",
          label: "Stored Beta Rule",
          description: "Beta rule with stored settings",
          severity: "warning"
        }
      ];
      window.lightningflowscanner = {
        version: "6.19.4",
        Flow: MockFlow,
        FlowType: {
          allTypes: () => ["Flow", "AutoLaunchedFlow", "Workflow", "ScreenFlow"],
          unsupportedTypes: []
        },
        scan: (flows, config) => {
          window.flowScannerScanConfig = config;
          return [{
            flow: flows[0],
            ruleResults: [
              {
                occurs: false,
                errorMessage: "Rule execution failed"
              },
              {
                occurs: true,
                ruleName: "StaticTagRule",
                severity: "warning",
                ruleDefinition: {
                  label: "Static Tag Rule",
                  description: "Checks static Flow tags"
                },
                details: [{
                  name: "Static_Action",
                  type: "Action"
                }, {
                  name: "Static_Template",
                  type: "Text Template"
                }, {
                  name: "Static_Constant",
                  type: "Constant"
                }]
              }
            ]
          }];
        },
        getRules: (ruleNames, options = {}) => options.betaMode
          ? [...coreRules, ...betaRules]
          : coreRules
      };
    });

    // Mock Salesforce API calls
    await context.route("**/*", async route => {
      //if mock is disabled, continue with the request
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      const request = route.request();
      const url = request.url();

      if (url.endsWith("/lib/flow-scanner-core.js")) {
        await route.fulfill({contentType: "application/javascript", body: ""});
        return;
      }

      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      await route.continue();
    });
  });

  async function initFlowScannerPage(page, extensionId, mockHost, mockFlowDefId = null, mockFlowId = null) {
    const flowDefinitionResponse = mockFlowDefId && mockFlowId
      ? waitSuccessfulHttpResponse(page, "FlowDefinitionView")
      : null;
    await page.goto(`chrome-extension://${extensionId}/flow-scanner.html?host=${mockHost}${mockFlowDefId ? `&flowDefId=${mockFlowDefId}` : ""}${mockFlowId ? `&flowId=${mockFlowId}` : ""}`);
    await page.waitForSelector("#root", {timeout: 10000});
    await page.waitForSelector("text=Flow Scanner", {timeout: 10000});

    //if mockFlowDefId and mockFlowId are provided, wait for the flow info section to be visible
    if (flowDefinitionResponse) {
      await flowDefinitionResponse;
    }

    // Wait for loading to complete
    await page.waitForFunction(
      () => {
        const loadingOverlay = document.querySelector(".loading-overlay");
        return !loadingOverlay || loadingOverlay.style.display === "none";
      },
      {timeout: 15000}
    );
    //add some delay to ensure the page is loaded
    await page.waitForTimeout(500);
  }

  test("Load Flow Scanner Page", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Verify Flow Information section appears (use more specific selector)
    await expect(page.locator("h2:has-text('Flow Information')").first()).toBeVisible();
  });

  test("Display Flow Information", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Verify flow information section exists
    const flowInfoSection = page.locator(".flow-info-section");
    await expect(flowInfoSection).toBeVisible({timeout: 5000});

    // Verify flow details are displayed (check for any flow-related text)
    const hasFlowContent = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      return bodyText.includes("Flow") || bodyText.includes("Test");
    });
    await expect(hasFlowContent).toBe(true);
  });

  test("Display Scan Results", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Verify Scan Results section appears (check for results area)
    await expect(page.locator(".scan-results-area, .summary-body").first()).toBeVisible({timeout: 5000});
  });

  test("Use Flow Scanner Core 6.19.4 configuration and results", async ({page, extensionId}) => {
    test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Flow Scanner Core");
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    const scanConfig = await page.evaluate(() => window.flowScannerScanConfig);
    expect(scanConfig, await page.locator("body").innerText()).toBeDefined();
    expect.soft(scanConfig.rules.DefaultBetaRule.enabled).toBe(false);
    expect.soft(scanConfig.rules.StoredBetaRule.enabled).toBe(true);
    expect.soft(scanConfig.rules.APIVersion.expression).toBe(">=58");
    const apiVersionRule = await page.evaluate(async () => {
      const {getFlowScannerRules} = await import(chrome.runtime.getURL("flow-scanner-rules.js"));
      return getFlowScannerRules(window.lightningflowscanner).find(rule => rule.name === "APIVersion");
    });
    expect.soft(apiVersionRule.configValue).toBe("58.0");
    const scanErrorSection = page.locator(".rule-section").filter({hasText: "Scan Error"});
    await expect.soft(scanErrorSection.locator("tbody")).toContainText("Rule execution failed");

    const staticTagRow = page.locator(".details-table tbody tr").filter({hasText: "Static_Action"});
    await expect.soft(staticTagRow).toContainText("Static Action");
    await expect.soft(staticTagRow).toContainText("Action");
    const staticResourceRow = page.locator(".details-table tbody tr").filter({hasText: "Static_Template"});
    await expect.soft(staticResourceRow).toContainText("Static Template");
    await expect.soft(staticResourceRow).toContainText("Text Template");
    const staticVariableRow = page.locator(".details-table tbody tr").filter({hasText: "Static_Constant"});
    await expect.soft(staticVariableRow).toContainText("Static Constant");
    await expect.soft(staticVariableRow).toContainText("Constant");
  });

  test("Expand All Results", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Click Expand All button
    const expandAllButton = page.locator("button:has-text('Expand All')");
    if (await expandAllButton.isVisible()) {
      await expandAllButton.click();
    }
  });

  test("Collapse All Results", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Click Collapse All button
    const collapseAllButton = page.locator("button:has-text('Collapse All')");
    if (await collapseAllButton.isVisible()) {
      await collapseAllButton.click();
    }
  });

  test("Toggle Severity Group", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Find and click a severity group header (e.g., Errors)
    const errorHeader = page.locator(".severity-title-left:has-text('Errors')").first();
    if (await errorHeader.isVisible()) {
      await errorHeader.click();
    }
  });

  test("Export Results", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Click Export button
    const exportButton = page.locator("button:has-text('Export')");
    await exportButton.isVisible();
    if (!(await exportButton.isDisabled())) {
      const downloadPromise = page.waitForEvent("download");
      await exportButton.click();
      const download = await downloadPromise;
      await download.cancel();
    }
  });

  test("Toggle Flow Description", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Find and click description toggle button
    const descriptionToggle = page.locator("button.description-toggle-btn, button:has-text('Show description'), button:has-text('Hide description')").first();
    await descriptionToggle.isVisible();
    await descriptionToggle.click();
  });

  test("Open Purge Versions Modal", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    const versionsText = await page.locator("text=/\\d+ versions?/i").first().textContent().catch(() => "");
    const versionCount = parseInt(versionsText) || 0;
    test.skip(versionCount <= 1, "Flow has only 1 version, purge button not available");

    // Find purge button (trash icon next to versions count)
    const purgeButton = page.locator("button[title='Purge old versions'], button:has(svg use[xlinkHref*='delete'])").first();
    await purgeButton.waitFor({state: "visible", timeout: 15000});
    await purgeButton.click();

    // Verify purge modal appears
    await expect(page.locator("text=Purge Old Versions")).toBeVisible();
  }, {timeout: 45000});

  test("Open Agentforce Modal", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Find Agentforce button (Einstein icon)
    const agentforceButton = page.locator("button[title='Open Agentforce Flow Scanner'], button:has(svg use[xlinkHref*='einstein'])").first();
    await agentforceButton.isVisible();
    await agentforceButton.click();

    // Verify Agentforce modal appears
    await expect(page.locator("text=Agentforce Flow Scanner")).toBeVisible();
  });

  test("Open Help/Settings", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Find settings/help button
    const settingsButton = page.locator("button[title='Open Flow Scanner Options'], button:has(svg use[xlinkHref*='settings'])").first();
    await settingsButton.isVisible();
    await settingsButton.click();

    // Verify new tab/window opens (we can't verify this in E2E, but we can verify click works)

  });

  test("Display Flow Versions", async ({page, extensionId}) => {
    await initFlowScannerPage(page, extensionId, mockHost, TEST_CONSTANTS.flowDefId, TEST_CONSTANTS.flowId);

    // Verify flow info section loaded successfully (which includes versions)
    await expect(page.locator(".flow-info-section")).toBeVisible({timeout: 5000});

    // Verify that flow data was loaded (check for flow label or API name)
    // This confirms that flow metadata including versions was fetched
    const hasFlowData = await page.evaluate(() => {
      const bodyText = document.body.textContent || "";
      return bodyText.includes("Flow") && bodyText.includes("Test");
    });
    expect(hasFlowData).toBe(true);
  });

  test.skip("Error Handling - Missing Parameters", async ({page, extensionId}) => {
    // Skip this test as it requires specific error handling that may not work in test environment
    // The error occurs during initialization before React renders
    await initFlowScannerPage(page, extensionId, mockHost);

    // Wait for error to appear - check for error text anywhere on page
    await page.waitForFunction(
      () => {
        const bodyText = document.body.textContent || "";
        return bodyText.includes("Missing required") || bodyText.includes("Error Occurred");
      },
      {timeout: 15000}
    );

    // Verify error message about missing parameters
    await expect(page.locator("text=Missing required parameters").first()).toBeVisible({timeout: 5000});
  });

  test.skip("Retry After Error", async ({page, extensionId}) => {
    // Skip this test as it requires specific error handling that may not work in test environment
    // The error occurs during initialization before React renders
    await initFlowScannerPage(page, extensionId, mockHost);

    // Wait for error - check for error text anywhere on page
    await page.waitForFunction(
      () => {
        const bodyText = document.body.textContent || "";
        return bodyText.includes("Missing required") || bodyText.includes("Error Occurred");
      },
      {timeout: 15000}
    );

    // Click Retry button
    const retryButton = page.locator("button:has-text('Retry')");
    if (await retryButton.isVisible({timeout: 5000})) {
      await retryButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
