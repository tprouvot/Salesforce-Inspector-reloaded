import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData
} from "./test-helpers";
import {routeMock} from "./test-mock";

const RULE_NAMES = [
  "ActionCallsInLoop",
  "APIVersion",
  "AutoLayout",
  "CopyAPIName",
  "CyclomaticComplexity",
  "DMLStatementInLoop",
  "DuplicateDMLOperation",
  "FlowDescription",
  "FlowName",
  "GetRecordAllFields",
  "HardcodedId",
  "HardcodedUrl",
  "InactiveFlow",
  "MissingFaultPath",
  "MissingNullHandler",
  "ProcessBuilder",
  "RecursiveAfterUpdate",
  "SameRecordFieldUpdates",
  "SOQLQueryInLoop",
  "TriggerOrder",
  "UnconnectedElement",
  "UnsafeRunningContext",
  "UnusedVariable"
];

const CLEAN_METADATA = {
  apiVersion: 62,
  label: "Clean Flow",
  description: "A complete flow used to verify an empty scan.",
  processType: "AutoLaunchedFlow",
  status: "Active",
  interviewLabel: "Clean Flow {!$Flow.CurrentDateTime}",
  start: {
    locationX: 50,
    locationY: 0,
    connector: {targetReference: "Assign_Value"}
  },
  assignments: [{
    name: "Assign_Value",
    label: "Assign Value",
    locationX: 50,
    locationY: 200,
    assignmentItems: [{
      assignToReference: "Message",
      operator: "Assign",
      value: {stringValue: "ok"}
    }]
  }],
  variables: [{
    name: "Message",
    dataType: "String",
    isCollection: false,
    isInput: false,
    isOutput: false
  }],
  processMetadataValues: [
    {name: "BuilderType", value: {stringValue: "LightningFlowBuilder"}},
    {name: "CanvasMode", value: {stringValue: "AUTO_LAYOUT_CANVAS"}}
  ]
};

function compositeResponse(body, metadata) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      compositeResponse: (body.compositeRequest || []).map(req => {
        if (req.referenceId === "flow") {
          return {
            referenceId: "flow",
            httpStatusCode: 200,
            body: {records: [{Id: TEST_CONSTANTS.flowId, Metadata: metadata}]}
          };
        }
        if (req.referenceId === "versions") {
          return {
            referenceId: "versions",
            httpStatusCode: 200,
            body: {records: [{Id: TEST_CONSTANTS.flowId, VersionNumber: 1, Status: "Active"}]}
          };
        }
        return {referenceId: req.referenceId, httpStatusCode: 200, body: {}};
      })
    })
  };
}

async function setup(context, {rules = "default", metadataMode = "clean"} = {}) {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;
  await injectSessionData(context, {
    host: mockHost,
    token: mockToken,
    version: apiVersion
  });
  const storedRules = rules === "none"
    ? JSON.stringify(RULE_NAMES.map(name => ({name, checked: false, severity: "error"})))
    : "";
  await context.addInitScript(ruleJson => {
    if (ruleJson) {
      window.localStorage.setItem("flowScannerRules", ruleJson);
    } else {
      window.localStorage.removeItem("flowScannerRules");
    }
  }, storedRules);

  const loadState = {metadataMode};
  await context.route("**/*", async route => {
    const request = route.request();
    const url = request.url();
    if (url.includes(mockHost) && url.includes("/tooling/composite") && request.method() === "POST") {
      if (loadState.metadataMode === "fail") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify([{message: "Metadata for this flow is too large to return", errorCode: "QUERY_TOO_COMPLICATED"}])
        });
        return;
      }
      await route.fulfill(compositeResponse(request.postDataJSON(), CLEAN_METADATA));
      return;
    }
    if (await routeMock(route, mockHost)) {
      return;
    }
    await route.continue();
  });
  return loadState;
}

async function openScanner(page, extensionId) {
  const {mockHost, flowDefId, flowId} = TEST_CONSTANTS;
  await page.goto(`chrome-extension://${extensionId}/flow-scanner.html?host=${mockHost}&flowDefId=${flowDefId}&flowId=${flowId}`);
  await page.waitForSelector("text=Flow Scanner", {timeout: 10000});
  await page.waitForFunction(() => {
    const loadingOverlay = document.querySelector(".loading-overlay");
    return !loadingOverlay || loadingOverlay.style.display === "none";
  }, {timeout: 15000});
}

async function waitForScanSettled(page) {
  await page.waitForFunction(() => {
    const loadingOverlay = document.querySelector(".loading-overlay");
    return !loadingOverlay || loadingOverlay.style.display === "none";
  }, {timeout: 15000});
}

test.describe("Flow Scanner empty result messages", () => {
  test("a clean flow shows No Issues Found", async ({context, page, extensionId}) => {
    await setup(context, {rules: "default", metadataMode: "clean"});
    await openScanner(page, extensionId);

    const results = page.locator(".scan-results-area");
    await expect(results).toBeVisible();
    await expect(results.locator("h3")).toHaveText("No Issues Found");
    await expect(results).toContainText("Great job! Your flow passed all checks with no issues detected.");
    await expect(results).not.toContainText("No Rules Enabled");
    await expect(page.locator(".flow-info-section")).toContainText("Test Flow");
    await expect(page.locator(".flow-info-section")).toContainText("A complete flow used to verify an empty scan.");
  });

  test("turning every rule off shows No Rules Enabled", async ({context, page, extensionId}) => {
    await setup(context, {rules: "none", metadataMode: "clean"});
    await openScanner(page, extensionId);

    const results = page.locator(".scan-results-area");
    await expect(results.locator("h3")).toHaveText("No Rules Enabled");
    await expect(results).toContainText("No Flow Scanner rules are enabled. Please enable rules on the Options page.");
    await expect(results).not.toContainText("Unable to Load Flow");
  });

  test("a failed metadata load shows a load error and can be retried", async ({context, page, extensionId}) => {
    const loadState = await setup(context, {rules: "default", metadataMode: "fail"});
    await openScanner(page, extensionId);

    const results = page.locator(".scan-results-area");
    await expect(results.locator("h3")).toHaveText("Unable to Load Flow");
    await expect(results).toContainText("Failed to fetch flow metadata");
    await expect(results).toContainText("Metadata for this flow is too large to return");
    await expect(results).not.toContainText("No Rules Enabled");
    await expect(page.locator(".flow-info-section")).toContainText("Flow information could not be loaded.");
    await expect(page.locator(".flow-info-section")).not.toContainText("Loading flow information...");

    loadState.metadataMode = "clean";
    await results.getByRole("button", {name: "Retry"}).click();
    await waitForScanSettled(page);

    await expect(results.locator("h3")).toHaveText("No Issues Found");
    await expect(page.locator(".flow-info-section")).toContainText("Test Flow");
    await expect(page.locator(".flow-info-section")).not.toContainText("could not be loaded");
  });
});
