import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData
} from "./test-helpers";
import {routeMock} from "./test-mock";

/**
 * Dependencies Explorer E2E tests using metadata from test/main/:
 * - ApexClass: SalesforceInspectorTest
 * - Flow: RecordTrigger_InspectorTest (references Inspector_Test__c)
 * - CustomObject: Inspector_Test__c
 */
test.describe("Dependencies Explorer", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });

    await context.route("**/*", async route => {
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }
      if (await routeMock(route, mockHost)) {
        return;
      }
      await route.continue();
    });
  });

  async function initDependenciesExplorerPage(page, extensionId, metadataType = "ApexClass") {
    await page.goto(`chrome-extension://${extensionId}/dependencies-explorer.html?host=${mockHost}&metadataType=${metadataType}`);

    // Wait for metadata items to load (tooling query)
    await page.waitForSelector(".dep-dropdown-trigger:not(:has-text('Loading...'))", {timeout: 5000});
    await page.waitForTimeout(300);
  }

  test("Load page with ApexClass and verify SalesforceInspectorTest", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "ApexClass");

    await expect(page).toHaveTitle(/Dependencies Explorer/);

    // Open item dropdown and verify test class from test/main/classes/
    // SalesforceInspectorTest.cls references Inspector_Test__c: "Inspector_Test__c inspectorTest = new Inspector_Test__c()"
    await page.locator(".dep-dropdown-trigger").click();
    await expect(page.locator(".dep-dropdown-item:has-text('SalesforceInspectorTest')")).toBeVisible();
  });

  // Skipped: MetadataComponentDependency mock in test-mock.js returns empty in E2E context
  test.skip("Analyze ApexClass dependencies shows Inspector_Test__c", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "ApexClass");

    await page.locator(".dep-dropdown-trigger").click();
    await page.locator(".dep-dropdown-item:has-text('SalesforceInspectorTest')").click();

    // Analyze dependencies - SalesforceInspectorTest.cls references Inspector_Test__c
    await page.locator("button:has-text('Analyze Dependencies')").click();
    await page.waitForSelector(".dep-card, .dep-empty, .dep-error", {timeout: 15000});
    await page.waitForTimeout(300);

    await expect(page.locator("text=Inspector_Test__c")).toBeVisible();
    await expect(page.locator("text=CustomObject")).toBeVisible();
  });

  test("Load page with Flow and verify RecordTrigger_InspectorTest", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "Flow");

    await page.locator(".dep-dropdown-trigger").click();
    // Flow display: "RecordTrigger_InspectorTest (AutoLaunchedFlow, v1, Active)"
    await expect(page.locator(".dep-dropdown-item:has-text('RecordTrigger_InspectorTest')")).toBeVisible();
  });

  // Skipped: same MetadataComponentDependency mock issue as ApexClass
  test.skip("Analyze Flow dependencies shows Inspector_Test__c", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "Flow");

    // Select RecordTrigger_InspectorTest (from test/main/default/flows/)
    await page.locator(".dep-dropdown-trigger").click();
    await page.locator(".dep-dropdown-item:has-text('RecordTrigger_InspectorTest')").click();

    // Click Analyze Dependencies
    await page.locator("button:has-text('Analyze Dependencies')").click();

    // Wait for analysis to complete - dep-loading disappears when spinnerCount goes to 0
    await page.waitForSelector(".dep-loading", {state: "detached", timeout: 10000}).catch(() => {});
    await page.waitForTimeout(500);

    // Flow depends on Inspector_Test__c (RecordTrigger_InspectorTest.flow-meta.xml object=Inspector_Test__c)
    await expect(page.locator("text=Inspector_Test__c")).toBeVisible({timeout: 5000});
    await expect(page.locator("text=CustomObject")).toBeVisible();
  });

  test("Analyze button disabled until item selected", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "ApexClass");

    const analyzeBtn = page.locator("button:has-text('Analyze Dependencies')");
    await expect(analyzeBtn).toBeDisabled();

    await page.locator(".dep-dropdown-trigger").click();
    await page.locator(".dep-dropdown-item:has-text('SalesforceInspectorTest')").click();

    await expect(analyzeBtn).toBeEnabled();
  });

  test("Welcome message when no analysis run", async ({page, extensionId}) => {
    await initDependenciesExplorerPage(page, extensionId, "ApexClass");

    await expect(page.locator("text=Welcome to the Dependencies Explorer!")).toBeVisible();
    await expect(page.locator("text=Select a metadata type and item to analyze")).toBeVisible();
  });
});
