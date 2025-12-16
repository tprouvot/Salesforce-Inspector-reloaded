import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  handleGetUserInfoSoap,
  createModelExposureSetup,
  fulfillSuccess
} from "./test-helpers";

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
      const request = route.request();
      const url = request.url();

      // Handle getUserInfo SOAP call (common handler)
      const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
      if (getUserInfoHandled) {
        return;
      }

      if (url.includes(mockHost)) {

        // Tooling API - Standard Platform Events
        if (url.includes("/tooling/query")) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes("IsCustomizable = FALSE") && decodedUrl.includes("IsEverCreatable = TRUE") && decodedUrl.includes("QualifiedApiName LIKE '%Event'")) {
            await fulfillSuccess(route, {
              size: 2,
              totalSize: 2,
              done: true,
              records: [
                {
                  Label: "Login Event",
                  QualifiedApiName: "LoginEvent",
                  DeveloperName: "LoginEvent"
                },
                {
                  Label: "Logout Event",
                  QualifiedApiName: "LogoutEvent",
                  DeveloperName: "LogoutEvent"
                }
              ]
            });
            return;
          }
        }

        // Tooling API - Custom Platform Events
        if (url.includes("/tooling/query")) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes("isCustomizable = TRUE") && decodedUrl.includes("KeyPrefix LIKE 'e%'")) {
            await fulfillSuccess(route, {
              size: 1,
              totalSize: 1,
              done: true,
              records: [
                {
                  QualifiedApiName: "CustomEvent__e",
                  Label: "Custom Event"
                }
              ]
            });
            return;
          }
        }

        // Tooling API - Custom Channels
        if (url.includes("/tooling/query")) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes("PlatformEventChannel") && !decodedUrl.includes("PlatformEventChannelMember") && !decodedUrl.includes("EventChannel =")) {
            await fulfillSuccess(route, {
              size: 1,
              totalSize: 1,
              done: true,
              records: [
                {
                  FullName: "CustomChannel",
                  MasterLabel: "Custom Channel"
                }
              ]
            });
            return;
          }
        }

        // Tooling API - Change Events
        if (url.includes("/tooling/query")) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes("PlatformEventChannelMember") && decodedUrl.includes("EventChannel = 'ChangeEvents'")) {
            await fulfillSuccess(route, {
              size: 2,
              totalSize: 2,
              done: true,
              records: [
                {
                  MasterLabel: "Account Change Event",
                  SelectedEntity: "AccountChangeEvent"
                },
                {
                  MasterLabel: "Contact Change Event",
                  SelectedEntity: "ContactChangeEvent"
                }
              ]
            });
            return;
          }
        }

        // Tooling API - Real-Time Events
        if (url.includes("/tooling/query")) {
          const decodedUrl = decodeURIComponent(url);
          if (decodedUrl.includes("RealTimeEvent") && decodedUrl.includes("IsEnabled = true")) {
            await fulfillSuccess(route, {
              size: 1,
              totalSize: 1,
              done: true,
              records: [
                {
                  EntityName: "Account"
                }
              ]
            });
            return;
          }
        }

        // Limits API
        if (url.includes("/limits")) {
          await fulfillSuccess(route, {
            DailyPlatformEvents: {
              Max: 10000,
              Remaining: 8500
            },
            HourlyPlatformEvents: {
              Max: 1000,
              Remaining: 900
            },
            FifteenMinutesPlatformEvents: {
              Max: 100,
              Remaining: 95
            }
          });
          return;
        }

        // CometD endpoints - mock handshake and subscription
        if (url.includes("/cometd/")) {
          const requestBody = await request.postData();
          if (requestBody) {
            const body = JSON.parse(requestBody);

            // Handshake response
            if (body.channel === "/meta/handshake") {
              await fulfillSuccess(route, {
                channel: "/meta/handshake",
                successful: true,
                version: "1.0",
                supportedConnectionTypes: ["long-polling"],
                clientId: "mock-client-id-12345",
                ext: {
                  replay: true
                }
              });
              return;
            }

            // Subscribe response
            if (body.channel === "/meta/subscribe") {
              await fulfillSuccess(route, {
                channel: "/meta/subscribe",
                successful: true,
                subscription: body.subscription,
                clientId: "mock-client-id-12345"
              });
              return;
            }

            // Unsubscribe response
            if (body.channel === "/meta/unsubscribe") {
              await fulfillSuccess(route, {
                channel: "/meta/unsubscribe",
                successful: true,
                subscription: body.subscription
              });
              return;
            }

            // Disconnect response
            if (body.channel === "/meta/disconnect") {
              await fulfillSuccess(route, {
                channel: "/meta/disconnect",
                successful: true
              });
              return;
            }

            // Long polling - return empty response (no events yet)
            await fulfillSuccess(route, {
              channel: "/meta/connect",
              successful: true,
              clientId: "mock-client-id-12345"
            });
            return;
          }
        }

        // Fallback
        await fulfillSuccess(route, {});
        return;
      }

      await route.continue();
    });
  });

  test("Load Page and Verify Channel Types", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Wait for page to load
    await page.waitForSelector("select.slds-select");

    // Verify channel type dropdown exists and has options
    const channelTypeSelect = page.locator("select.slds-select").first();
    await expect(channelTypeSelect).toBeVisible();

    // Verify default selection is "Standard Platform Event"
    await expect(channelTypeSelect).toHaveValue("standardPlatformEvent");
  });

  test("Load Standard Platform Events", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("select.slds-select");

    // Wait for model to be exposed and channels to be loaded
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.channels && window.insextTestModel.channels.length > 0;
    }, {timeout: 15000});

    // Wait a bit more for React to render
    await page.waitForTimeout(1000);

    // Verify channel dropdown has options
    const channelSelects = page.locator("select.slds-select");
    const channelSelect = channelSelects.nth(1); // Second select is the channel dropdown

    // Verify LoginEvent is available (check all options)
    const options = await channelSelect.locator("option").allTextContents();
    expect(options.some(text => text.includes("Login Event"))).toBeTruthy();
  });

  test("Change Channel Type to Custom Platform Event", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("select.slds-select");

    // Select "Custom Platform Event" channel type
    const channelTypeSelect = page.locator("select.slds-select").first();
    await channelTypeSelect.selectOption("platformEvent");

    // Wait for channels to load
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.channels && window.insextTestModel.channels.length > 0;
    }, {timeout: 10000});

    // Wait a bit more for React to render
    await page.waitForTimeout(500);

    // Verify channel dropdown shows custom events (check for the option text)
    const channelSelects = page.locator("select.slds-select");
    const channelSelect = channelSelects.nth(1);
    // The label should be "Custom Event" based on the mock
    const options = await channelSelect.locator("option").allTextContents();
    expect(options.some(text => text.includes("Custom Event"))).toBeTruthy();
  });

  test("Change Channel Type to Change Event", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("select.slds-select");

    // Select "Change Event" channel type
    const channelTypeSelect = page.locator("select.slds-select").first();
    await channelTypeSelect.selectOption("changeEvent");

    // Wait for channels to load
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.channels && window.insextTestModel.channels.length > 0;
    }, {timeout: 10000});

    // Verify "All Change Events" option appears first
    const channelSelects = page.locator("select.slds-select");
    const channelSelect = channelSelects.nth(1);
    await expect(channelSelect.locator("option").first()).toContainText("All Change Events");
  });

  test("Enter Custom Channel Path", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("input[type='text']");

    // Find the custom channel path input
    const customChannelInput = page.locator("input[placeholder='/event/LoginAsEventStream']");
    await customChannelInput.fill("/event/CustomChannel");

    // Verify the value is set
    await expect(customChannelInput).toHaveValue("/event/CustomChannel");
  });

  test("Change Replay ID", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("input[type='number']");

    // Find the replay ID input
    const replayIdInput = page.locator("input[type='number']");
    await replayIdInput.fill("12345");

    // Verify the value is set
    await expect(replayIdInput).toHaveValue("12345");
  });

  test("Subscribe Button State", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("button[title='Subscribe to channel']");

    // Wait for channels to load
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.channels && window.insextTestModel.channels.length > 0;
    }, {timeout: 10000});

    // Subscribe button should be enabled if channel is selected
    const subscribeButton = page.locator("button[title='Subscribe to channel']");
    // Button state depends on whether a channel is selected and not listening
    await expect(subscribeButton).toBeVisible();

    // Unsubscribe button should be disabled initially
    const unsubscribeButton = page.locator("button[title='Unsubscribe to channel']");
    await expect(unsubscribeButton).toBeDisabled();
  });

  test("Toggle Help", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Find and click help button
    const helpButton = page.locator("button[title='Event Monitor Help']");
    await helpButton.click();

    // Verify help section appears
    await expect(page.locator("text=Event Monitor Help")).toBeVisible();
    await expect(page.locator("text=Subscribe to a channel to see events")).toBeVisible();
  });

  test("Toggle Metrics", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Find and click metrics button
    const metricsButton = page.locator("button[title='Show Metrics']");
    await metricsButton.click();

    // Wait for metrics to load
    await page.waitForTimeout(1000);

    // Verify metrics section appears
    await expect(page.locator("text=Platform Events Limits")).toBeVisible();
    await expect(page.locator("text=Daily Platform Events")).toBeVisible();
    // Check for specific limit text (more specific than just "Remaining")
    await expect(page.locator("text=Daily Platform Events: Remaining")).toBeVisible();
  });

  test("Event Filter Input", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Wait for filter input to appear
    await page.waitForSelector("input[placeholder='Filter events...']");

    const filterInput = page.locator("input[placeholder='Filter events...']");

    // Filter input should be disabled when there are no events
    await expect(filterInput).toBeDisabled();

    // Note: To test filtering with events, we would need to mock CometD events
    // which is complex. This test verifies the UI element exists and is properly disabled.
  });

  test("Copy and Clear Buttons State", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Wait for buttons to appear
    await page.waitForSelector("button:has-text('Copy')");
    await page.waitForSelector("button:has-text('Clear')");

    // Copy and Clear buttons should be disabled when there are no events
    const copyButton = page.locator("button:has-text('Copy')");
    const clearButton = page.locator("button:has-text('Clear')");

    await expect(copyButton).toBeDisabled();
    await expect(clearButton).toBeDisabled();
  });

  test("Copy as JSON with Events", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Wait for model to be exposed
    await page.waitForFunction(() => window.insextTestModel !== undefined, {timeout: 10000});

    // Add mock events to the model
    await page.evaluate(() => {
      if (window.insextTestModel) {
        window.insextTestModel.events = [
          {
            event: {
              replayId: 1,
              type: "TestEvent"
            },
            data: {
              field1: "value1",
              field2: "value2"
            }
          }
        ];
        window.insextTestModel.didUpdate();
      }
    });

    // Wait for React to update
    await page.waitForTimeout(500);

    // Copy button should now be enabled
    const copyButton = page.locator("button:has-text('Copy')");
    await expect(copyButton).toBeEnabled();

    // Click copy button
    await copyButton.click();

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => window.testClipboardValue);
    expect(clipboardContent).toContain("replayId");
    expect(clipboardContent).toContain("TestEvent");
  });

  test("Clear Events", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    // Wait for model to be exposed
    await page.waitForFunction(() => window.insextTestModel !== undefined, {timeout: 10000});

    // Add mock events to the model
    await page.evaluate(() => {
      if (window.insextTestModel) {
        window.insextTestModel.events = [
          {
            event: {
              replayId: 1,
              type: "TestEvent"
            }
          }
        ];
        window.insextTestModel.didUpdate();
      }
    });

    // Wait for React to update
    await page.waitForTimeout(500);

    // Clear button should be enabled
    const clearButton = page.locator("button:has-text('Clear')");
    await expect(clearButton).toBeEnabled();

    // Click clear button
    await clearButton.click();

    // Verify events are cleared
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.events.length === 0;
    }, {timeout: 5000});

    // Copy and Clear buttons should be disabled again
    await expect(page.locator("button:has-text('Copy')")).toBeDisabled();
    await expect(page.locator("button:has-text('Clear')")).toBeDisabled();
  });

  test("Replay ID -2 Confirmation Popup", async ({page, extensionId}) => {
    const monitorUrl = `chrome-extension://${extensionId}/event-monitor.html?host=${mockHost}`;
    await page.goto(monitorUrl);

    await page.waitForSelector("input[type='number']");

    // Wait for channels to load first (so Subscribe button is enabled)
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      return window.insextTestModel.channels && window.insextTestModel.channels.length > 0
             && window.insextTestModel.selectedChannel !== null;
    }, {timeout: 15000});

    // Set replay ID to -2
    const replayIdInput = page.locator("input[type='number']");
    await replayIdInput.fill("-2");

    // Wait for model to update (replayId is a string initially, then converted)
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      if (window.insextTestModel) {
        window.insextTestModel.didUpdate();
      }
    });

    // Click Subscribe button (use title to distinguish from modal button)
    const subscribeButton = page.locator("button[title='Subscribe to channel']");
    await expect(subscribeButton).toBeEnabled({timeout: 5000});
    await subscribeButton.click();

    // Verify confirmation popup appears
    await expect(page.locator("text=Important")).toBeVisible({timeout: 5000});
    await expect(page.locator("text=Use this option sparingly")).toBeVisible();
    // Use more specific selector for modal buttons
    await expect(page.locator(".slds-modal button:has-text('Subscribe')")).toBeVisible();
    await expect(page.locator(".slds-modal button:has-text('Cancel')")).toBeVisible();
  });

});

