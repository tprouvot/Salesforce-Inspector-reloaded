import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createModelExposureSetup,
} from "./test-helpers";
import { routeMock } from "./test-mock";

test.describe("Event Monitor", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data with model exposure setup
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion,
      additionalSetup: createModelExposureSetup()
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      //if mock is disabled, continue with the request
      if(!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      await route.continue();
    });
  });

  /** @description Initializes the event monitor page
   * @param {Object} page - Playwright page object
   * @param {Object} extensionId - Extension ID
   * @returns {Promise<void>}
   */
  async function initEventMonitorPage(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`);

    // Wait for page to load
    await page.waitForSelector("select.slds-select");
  }

  /** @description Adds a fake test event to the event monitor page
   * @param {Object} page - Playwright page object
   * @returns {Promise<void>}
   */
  async function addFakeTestEvent(page) {
    // Wait for the addTestEvent function to be available
    await page.waitForFunction(() => typeof window.addTestEvent === "function", {timeout: 10000});

    // Add test events directly without subscribing - using the global function
    await page.evaluate(() => {
      // Add a test event with the expected structure matching CometD message format
      addTestEvent({
        event: {
          replayId: 12345,
          type: "ChangeEvent",
          createdDate: new Date().toISOString()
        },
        payload: {
          ChangeEventHeader: {
            entityName: "Inspector_Test__c",
            changeType: "CREATE"
          },
          Name: "TestEvent"
        }
      });
    });
  }

  test("Load Page and Verify Channel Types", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Verify channel type dropdown exists and has options
    const channelTypeSelect = page.locator("select.slds-select").first();
    await expect(channelTypeSelect).toBeVisible();

    // Verify default selection is "Standard Platform Event"
    await expect(channelTypeSelect).toHaveValue("standardPlatformEvent");
  });

  test("Load Standard Platform Events", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    await page.waitForTimeout(500);

    // Verify channel dropdown has options
    const channelSelect = page.locator("select.slds-select").nth(1); // Second select is the channel dropdown

    // Verify Batch Job Execution Event is available (check all options)
    const options = await channelSelect.locator("option").allTextContents();
    await expect(options.some(text => text.includes("Batch Job Execution Event") || text.includes("Account"))).toBeTruthy();
  });

  test("Change Channel Type to Custom Platform Event", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Select "Custom Platform Event" channel type
    await  page.locator("select.slds-select").first().selectOption("platformEvent");
    await page.waitForTimeout(500);

    // Verify channel dropdown shows custom events (check for the option text)
    const channelSelect = page.locator("select.slds-select").nth(1);
    // The label should be "Batch Job Execution Event" or "Event" based on the mock
    const options = await channelSelect.locator("option").allTextContents();
    await expect(options.some(text => text.includes(TEST_CONSTANTS.mockEnabled ? "Account" : "Event"))).toBeTruthy();
  });

  test("Change Channel Type to Change Event", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Select "Change Event" channel type
    await page.locator("select.slds-select").first().selectOption("changeEvent");

    // Verify "All Change Events" option appears first
    const channelSelect = await page.locator("select.slds-select").nth(1);
    await expect(channelSelect.locator("option").first()).toContainText("All Change Events");
  });

  test("Enter Custom Channel Path", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    await page.waitForSelector("input[type='text']");

    // Find the custom channel path input
    const customChannelInput = page.locator("input[placeholder='/event/LoginAsEventStream']");
    await customChannelInput.fill("/event/CustomChannel");

    // Verify the value is set
    await expect(customChannelInput).toHaveValue("/event/CustomChannel");
  });

  test("Change Replay ID", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    await page.waitForSelector("input[type='number']");

    // Find the replay ID input
    const replayIdInput = page.locator("input[type='number']");
    await replayIdInput.fill("12345");

    // Verify the value is set
    await expect(replayIdInput).toHaveValue("12345");
  });

  test("Subscribe Button State", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    await page.waitForSelector("button[title='Subscribe to channel']");

    // Subscribe button should be enabled if channel is selected
    const subscribeButton = page.locator("button[title='Subscribe to channel']");
    // Button state depends on whether a channel is selected and not listening
    await expect(subscribeButton).toBeVisible();

    // Unsubscribe button should be disabled initially
    const unsubscribeButton = page.locator("button[title='Unsubscribe to channel']");
    await expect(unsubscribeButton).toBeDisabled();
  });

  test("Toggle Help", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Find and click help button
    const helpButton = page.locator("button[title='Event Monitor Help']");
    await helpButton.click();

    // Verify help section appears
    await expect(page.locator("text=Event Monitor Help")).toBeVisible();
    await expect(page.locator("text=Subscribe to a channel to see events")).toBeVisible();
  });

  test("Toggle Metrics", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Find and click metrics button
    const metricsButton = page.locator("button[title='Show Metrics']");
    await metricsButton.click();

    // Verify metrics section appears
    await expect(page.locator("text=Platform Events Limits")).toBeVisible();
    // Check for specific limit text (more specific than just "Remaining")
    await expect(page.locator(".slds-card__body.slds-card__body_inner p.slds-m-bottom_x-small").first()).toContainText("Platform Events: Remaining");
  });

  test("Event Filter Input", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Wait for filter input to appear
    await page.waitForSelector("input[placeholder='Filter events...']");

    const filterInput = page.locator("input[placeholder='Filter events...']");

    // Filter input should be disabled when there are no events
    await expect(filterInput).toBeDisabled();

    // Note: To test filtering with events, we would need to mock CometD events
    // which is complex. This test verifies the UI element exists and is properly disabled.
  });

  test("Copy and Clear Buttons State", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    // Wait for buttons to appear
    await page.waitForSelector("button:has-text('Copy')");
    await page.waitForSelector("button:has-text('Clear')");

    // Copy and Clear buttons should be disabled when there are no events
    const copyButton = page.locator("button:has-text('Copy')");
    const clearButton = page.locator("button:has-text('Clear')");

    await expect(copyButton).toBeDisabled();
    await expect(clearButton).toBeDisabled();
  });

  test("Copy as JSON with Events", async ({page, extensionId, context}) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await initEventMonitorPage(page, extensionId);
    await addFakeTestEvent(page);

    // Copy button should now be enabled
    const copyButton = page.locator("button:has-text('Copy')");
    await expect(copyButton).toBeEnabled();

    // Click copy button
    await copyButton.click();

    // Wait a bit for clipboard to be updated
    await page.waitForTimeout(200);

    // Verify clipboard content
    const clipboardContent = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });
    await expect(clipboardContent).toContain("replayId");
    await expect(clipboardContent).toContain("TestEvent");
  });

  test("Clear Events", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);
    await addFakeTestEvent(page);

    // Clear button should be enabled
    const clearButton = page.locator("button:has-text('Clear')");
    await expect(clearButton).toBeEnabled();

    // Click clear button
    await clearButton.click();

    // Copy and Clear buttons should be disabled again
    await expect(page.locator("button:has-text('Copy')")).toBeDisabled();
    await expect(page.locator("button:has-text('Clear')")).toBeDisabled();
  });

  test("Replay ID -2 Confirmation Popup", async ({page, extensionId}) => {
    await initEventMonitorPage(page, extensionId);

    await page.waitForSelector("input[type='number']");

    // Set replay ID to -2
    await page.locator("input[type='number']").fill("-2");

    // Click Subscribe button (use title to distinguish from modal button)
    const subscribeButton = page.locator("button[title='Subscribe to channel']");
    await expect(subscribeButton).toBeEnabled({timeout: 5000});
    await subscribeButton.click();

    // Verify confirmation popup appears
    await expect(page.locator("text=Important")).toBeVisible({timeout: 5000});
    await expect(page.locator("text=Use this option sparingly")).toBeVisible();
    // Use more specific selector for modal buttons (footer)
    await expect(page.locator(".slds-modal .slds-modal__footer button:has-text('Subscribe')")).toBeVisible();
    await expect(page.locator(".slds-modal .slds-modal__footer button:has-text('Cancel')")).toBeVisible();
    //cancel is also in the modal as close button
    await expect(page.locator(".slds-modal button:has-text('Cancel').slds-modal__close")).toBeEnabled();
  });
});
