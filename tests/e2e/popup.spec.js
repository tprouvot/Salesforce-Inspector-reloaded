import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse,
  fulfillSuccess
} from "./test-helpers";
import {routeMock} from "./test-mock";

// Stub records returned by the Shortcut tab metadata composite mock, keyed by a
// distinctive substring of the SOQL query used for each metadata type in popup.js.
// Values mirror the real metadata deployed from test/main/ (flow, class, permission set)
// so search terms and assertions are identical whether tests run mocked or against a real org.
const SHORTCUT_METADATA_MOCKS = [
  {
    match: "FlowDefinitionView",
    record: {
      DurableId: "301000000000001AAA",
      LatestVersionId: "301000000000002AAA",
      ApiName: "RecordTrigger_InspectorTest",
      Label: "RecordTrigger InspectorTest",
      ProcessType: "AutoLaunchedFlow",
      attributes: {type: "FlowDefinitionView"}
    }
  },
  {
    // PermissionSet is checked before Profile since "PermissionSet" does not contain "Profile"
    // but both queries are otherwise disjoint; order here only matters for readability.
    match: "PermissionSet",
    record: {
      Id: "0PS000000000001AAA",
      Name: "SfInspector",
      Label: "Sf Inspector",
      Type: "Regular",
      License: null,
      PermissionSetGroupId: null,
      attributes: {type: "PermissionSet"}
    }
  },
  {
    // Standard "System Administrator" profile exists in every org (real or scratch)
    match: "Profile",
    record: {
      Id: "00e000000000001AAA",
      Name: "System Administrator",
      UserLicense: {Name: "Salesforce"},
      attributes: {type: "Profile"}
    }
  },
  {
    match: "ApexClass",
    record: {
      Id: "01p000000000001AAA",
      Name: "SalesforceInspectorTest",
      NamespacePrefix: null,
      ApiVersion: 66,
      Status: "Active",
      LengthWithoutComments: 100,
      attributes: {type: "ApexClass"}
    }
  }
];

test.describe("Popup", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data and Mock Parent Window
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion,
      additionalSetup() {
        // Mock chrome.runtime
        if (!window.chrome) {
          window.chrome = {
            runtime: {
              getManifest: () => ({versionName: "1.0.0"}),
              onMessage: {addListener: () => {}},
              sendMessage: () => {}
            }
          };
        }

        // Mock parent window to allow message communication
        // Note: popup.js checks e.source == parent, so we need to make parent return a consistent object
        const mockParentObj = {
          postMessage(msg) {
            // When popup sends insextInitRequest, respond with insextInitResponse
            if (msg && msg.insextInitRequest) {
              setTimeout(() => {
                // Dispatch message event - source will be handled by our wrapped listener
                const event = new MessageEvent("message", {
                  data: {
                    insextInitResponse: true,
                    sfHost: mockHost,
                    inDevConsole: false,
                    inLightning: false,
                    inInspector: false
                  },
                  origin: window.location.origin
                });

                window.dispatchEvent(event);
              }, 100);
            }
          }
        };

        // Set up parent mock BEFORE popup.js loads
        if (window.parent === window) {
          Object.defineProperty(window, "parent", {
            get() {
              return mockParentObj;
            },
            configurable: true
          });
        }

        // Patch addEventListener BEFORE popup.js loads to intercept message events
        // This ensures that when popup.js sets up its listener, it's already wrapped
        // We need to make e.source === parent for all message events
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = function(type, listener, useCapture) {
          if (type === "message") {
            const wrappedListener = function(e) {
              // Always ensure e.source === parent for message events
              // This is needed because MessageEvent.source is read-only and can't be set in constructor
              if (e.source !== mockParentObj) {
                // Create a wrapper that inherits from the event but overrides source
                const wrappedEvent = Object.create(e);
                Object.defineProperty(wrappedEvent, "source", {
                  get: () => mockParentObj,
                  configurable: true,
                  enumerable: true
                });
                return listener.call(this, wrappedEvent);
              }
              return listener.call(this, e);
            };
            return originalAddEventListener.call(this, type, wrappedListener, useCapture);
          }
          return originalAddEventListener.call(this, type, listener, useCapture);
        };
      }
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      //if mock is disabled, continue with the request
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }

      const request = route.request();
      const url = request.url();
      const method = request.method();

      // REST API - Composite Query (user details + Shortcut tab metadata search).
      // Handled before routeMock() because test-mock.js has a generic composite fallback
      // that would otherwise swallow these requests and respond with empty records.
      if (url.includes(mockHost) && url.includes("/composite") && method === "POST") {
        const requestBody = await request.postData();
        const body = JSON.parse(requestBody);

        // User search composite
        if (body.compositeRequest && body.compositeRequest[0]?.url?.includes("FROM User WHERE")) {
          await fulfillSuccess(route, {
            compositeResponse: [
              {
                httpStatusCode: 200,
                body: {
                  totalSize: 1,
                  records: [{
                    Id: "005000000000001AAA",
                    Name: "Test User",
                    Email: "test@example.com",
                    Username: "test@example.com",
                    Alias: "tuser",
                    IsActive: true,
                    Profile: {
                      Name: "System Administrator"
                    },
                    UserRole: {
                      Name: "CEO"
                    }
                  }]
                }
              }
            ]
          });
          return;
        }

        // User details composite
        if (body.compositeRequest && body.compositeRequest[0]?.url?.includes("WHERE Id='")) {
          await fulfillSuccess(route, {
            compositeResponse: [
              {
                httpStatusCode: 200,
                body: {
                  totalSize: 1,
                  records: [{
                    Id: "005000000000001AAA",
                    Name: "Test User",
                    Email: "test@example.com",
                    Username: "test@example.com",
                    Alias: "tuser",
                    IsActive: true,
                    FederationIdentifier: "test@example.com",
                    ProfileId: "00e000000000001AAA",
                    Profile: {
                      Name: "System Administrator"
                    },
                    ContactId: null,
                    IsPortalEnabled: false,
                    UserPreferencesUserDebugModePref: false,
                    UserRole: {
                      Name: "CEO"
                    },
                    LocaleSidKey: "en_US",
                    LanguageLocaleKey: "en_US"
                  }]
                }
              }
            ]
          });
          return;
        }

        // Shortcut search composite (Shortcuts tab: default, "!", "!flow", "!profile", "!class", "!perm" searches)
        if (body.compositeRequest && body.compositeRequest.some((req) => SHORTCUT_METADATA_MOCKS.some(({match}) => req.url?.includes(match)))) {
          const compositeResponse = body.compositeRequest.map((req) => {
            const mock = SHORTCUT_METADATA_MOCKS.find(({match}) => req.url?.includes(match));
            return {
              httpStatusCode: 200,
              body: {totalSize: mock ? 1 : 0, records: mock ? [mock.record] : []}
            };
          });
          await fulfillSuccess(route, {compositeResponse});
          return;
        }
      }

      //we check if we have a mock for this request
      if (await routeMock(route, mockHost)) {
        return;
      }

      if (url.includes(mockHost)) {

        // Tooling API - TraceFlag Query
        if (url.includes("/tooling/query") && url.includes("TraceFlag")) {
          await fulfillSuccess(route, {
            size: 0,
            totalSize: 0,
            done: true,
            records: []
          });
          return;
        }

        // Tooling API - DebugLevel Query
        if (url.includes("/tooling/query") && url.includes("DebugLevel")) {
          await fulfillSuccess(route, {
            size: 1,
            totalSize: 1,
            done: true,
            records: [{
              Id: "7dl000000000001AAA"
            }]
          });
          return;
        }

        // Tooling API - Create TraceFlag
        if (url.includes("/tooling/sobjects/traceflag") && method === "POST") {
          await fulfillSuccess(route, {
            id: "7tf000000000001AAA",
            success: true,
            errors: []
          });
          return;
        }

        // Tooling API - ApexLog Query
        if (url.includes("/tooling/query") && url.includes("ApexLog")) {
          await fulfillSuccess(route, {
            size: 2,
            totalSize: 2,
            done: true,
            records: [
              {Id: "07L000000000001AAA"},
              {Id: "07L000000000002AAA"}
            ]
          });
        }

        // REST API - Composite Delete (ApexLogs)
        if (url.includes("/composite/sobjects") && method === "DELETE") {
          await fulfillSuccess(route, [
            {id: "07L000000000001AAA", success: true},
            {id: "07L000000000002AAA", success: true}
          ]);
          return;
        }

        // REST API - NetworkMember Query
        if (url.includes("/query/") && url.includes("NetworkMember")) {
          await fulfillSuccess(route, {
            totalSize: 0,
            done: true,
            records: []
          });
          return;
        }

        // REST API - ListView Query (for list view export)
        if (url.includes("/query/") && url.includes("ListView")) {
          await fulfillSuccess(route, {
            totalSize: 1,
            done: true,
            records: [{
              Id: "00B000000000001AAA"
            }]
          });
          return;
        }

        // REST API - ListView Describe
        if (url.includes("/sobjects/") && url.includes("/listviews/") && url.includes("/describe")) {
          await fulfillSuccess(route, {
            query: "SELECT Id, Name FROM Account LIMIT 100"
          });
        }

        // Fallback
        await fulfillSuccess(route, {});
        return;
      }

      await route.continue();
    });
  });

  async function initPopupPage(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/test-popup.html?host=${mockHost}`);

    //click on the button to open the popup
    await page.locator(".insext-btn").click();

    const frame = await page.frameLocator(".insext-popup");

    if (frame) {
      await expect(frame.locator("#root")).toBeVisible();
    } else {
      throw new Error("Frame not found");
    }
  }

  async function waitForObjectsTabToLoad(page) {
    // Wait for objects and entity definitions to load (utils.js fetches sobjects, tooling/sobjects, and EntityDefinition via COUNT + batched queries)
    await Promise.all([
      waitSuccessfulHttpResponse(page, "/services/data/v" + TEST_CONSTANTS.apiVersion + "/sobjects/"),
      waitSuccessfulHttpResponse(page, "/services/data/v" + TEST_CONSTANTS.apiVersion + "/tooling/sobjects/"),
      waitSuccessfulHttpResponse(page, "EntityDefinition"),
    ]);

    //Wait some time to ensure that the responses are processed
    await page.waitForTimeout(500);

    await page.frameLocator(".insext-popup").locator("input[placeholder*='Record id']").waitFor({timeout: 1000});
  }

  test.describe("General", () => {
    test("Load Popup Page", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      // Verify basic page structure (may not have React content if init didn't work)
      const rootContent = await page.frameLocator(".insext-popup").locator("#root").textContent();

      // Root should exist even if React hasn't rendered yet
      await expect(rootContent !== null).toBeTruthy();
    });

    test("Verify Main Sections Exist", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Verify Data & Metadata section
      await expect(page.frameLocator(".insext-popup").locator("text=Data & Metadata")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Data Export')")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Data Import')")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Field Creator')")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Download Metadata')")).toBeVisible();

      // Verify Platform Tools section
      await expect(page.frameLocator(".insext-popup").locator("text=Platform Tools")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('REST Explorer')")).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Event Monitor')")).toBeVisible();
    });

    test("Change API Version", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Find API version input
      const apiInput = page.frameLocator(".insext-popup").locator("input#idApiInput");
      await expect(apiInput).toBeVisible();

      // Change API version
      await apiInput.fill("64"); //be careful as this value depends on the test-mock.js file and real api versions
      await apiInput.press("Enter");

      // Verify value is updated
      await expect(apiInput).toHaveValue("64");
    });

    test("Click Data Export Link", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Find Data Export link
      const exportLink = page.frameLocator(".insext-popup").locator("a:has-text('Data Export')");
      await expect(exportLink).toBeVisible();

      // Verify href contains data-export.html
      const href = await exportLink.getAttribute("href");
      expect(href).toContain("data-export.html");
    });

    test("Click Data Import Link", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Find Data Import link
      const importLink = page.frameLocator(".insext-popup").locator("a:has-text('Data Import')");
      await expect(importLink).toBeVisible();

      // Verify href contains data-import.html
      const href = await importLink.getAttribute("href");
      expect(href).toContain("data-import.html");
    });

    test("Click REST Explorer Link", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Find REST Explorer link
      const restLink = page.frameLocator(".insext-popup").locator("a:has-text('REST Explorer')");
      await expect(restLink).toBeVisible();

      // Verify href contains rest-explore.html
      const href = await restLink.getAttribute("href");
      expect(href).toContain("rest-explore.html");
    });

    test("Click Event Monitor Link", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Find Event Monitor link
      const eventLink = page.frameLocator(".insext-popup").locator("a:has-text('Event Monitor')");
      await expect(eventLink).toBeVisible();

      // Verify href contains event-monitor.html
      const href = await eventLink.getAttribute("href");
      expect(href).toContain("event-monitor.html");
    });

    test("Footer Links Exist", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Wait for footer to load
      await page.frameLocator(".insext-popup").locator("#footer").waitFor({timeout: 1000});

      // Verify footer link exists (release-note is in footer)
      await expect(page.frameLocator(".insext-popup").locator("#footer a[href*='release-note']")).toBeVisible();

      const donateContainer = page.frameLocator(".insext-popup").locator("div[title='Donate']");
      await expect(donateContainer).toBeVisible({timeout: 1000});
      const donateLink = donateContainer.locator("a[href*='donate']");
      await expect(donateLink).toBeAttached({timeout: 1000});

      // Documentation locate by parent div title attribute
      const docContainer = page.frameLocator(".insext-popup").locator("div[title='Documentation']");
      await expect(docContainer).toBeVisible({timeout: 1000});
      const docLink = docContainer.locator("a[href*='Salesforce-Inspector-reloaded']");
      await expect(docLink).toBeAttached({timeout: 1000});
    });
  });

  test.describe("Objects Tab", () => {
    test("Search and Select Object", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      await waitForObjectsTabToLoad(page);
      // Type in search input
      await page.frameLocator(".insext-popup").locator("input[placeholder*='Record id']").pressSequentially("Account", {delay: 50});
      await page.waitForTimeout(500);

      // Verify Account appears in results
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().waitFor({state: "visible", timeout: 1000});
      await expect(await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").count()).toBeGreaterThan(0);

      // Click on Account
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().click();

      // Verify object details appear
      await expect(page.frameLocator(".insext-popup").locator(".tab-container .slds-card__body .slds-text-body_small").locator("text=Account")).toBeVisible();
    });

    test("Select Record ID", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      await waitForObjectsTabToLoad(page);

      // Type a record ID
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Record id']");
      await searchInput.fill(TEST_CONSTANTS.accountRecordId);

      // Wait for autocomplete
      await page.waitForTimeout(1000);

      // Click on the record result
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item").first().click();

      // Verify record details appear (the detail view shows the record ID with key prefix)
      await expect(page.frameLocator(".insext-popup").locator("text=" + TEST_CONSTANTS.accountRecordId)).toBeVisible({timeout: 1000});
    });

    test("Show All Data Button", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      await waitForObjectsTabToLoad(page);

      // Type and select an object
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Record id']");
      await searchInput.pressSequentially("Account", {delay: 50});
      await page.waitForTimeout(500);
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().waitFor({state: "visible", timeout: 1000});
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().click();

      // Wait for object details to appear
      await page.waitForTimeout(1000);

      // Verify "Show all data" button appears
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Show all data')")).toBeVisible({timeout: 1000});
    });

    test("Object Links (Fields, List, etc.)", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      await waitForObjectsTabToLoad(page);

      // Type and select an object
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Record id']");
      await searchInput.pressSequentially("Account", {delay: 50});
      await page.waitForTimeout(500);
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().waitFor({state: "visible", timeout: 1000});
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('Account')").first().click();

      // Wait for object details to appear
      await page.waitForTimeout(1000);

      // Verify links appear (use href to avoid matching "Waitlist*" links that contain "List")
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Fields')")).toBeVisible({timeout: 1000});
      await expect(page.frameLocator(".insext-popup").locator("a[href*='Account/list']")).toBeVisible();
    });
  });

  test.describe("Users Tab", () => {
    test("Switch to Users Tab", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Users tab
      const usersTab = page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Users')");
      await usersTab.click();

      // Verify Users tab is active
      await expect(usersTab).toHaveClass(/slds-is-active/);

      // Verify user search input appears
      await expect(page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']")).toBeVisible({timeout: 1000});
    });

    test("Search User", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Users tab
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Users')").click();

      // Wait for user search input
      await page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']").waitFor({timeout: 1000});

      // Type in search (Integration User exists in all orgs)
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']");
      await searchInput.fill(TEST_CONSTANTS.testUserSearchTerm);

      // Wait for autocomplete results (User API can be slower when full suite runs)
      await page.waitForTimeout(1500);

      // Verify user appears in results
      await expect(page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('" + TEST_CONSTANTS.testUserSearchTerm + "')").first()).toBeVisible({timeout: 2000});
    });

    test("Select User and View Details", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Users tab
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Users')").click();

      // Wait for user search input
      await page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']").waitFor({timeout: 1000});

      // Type in search
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']");
      await searchInput.fill(TEST_CONSTANTS.testUserSearchTerm);

      // Wait for autocomplete
      await page.waitForTimeout(1000);

      // Click on user result
      const searchTerm = TEST_CONSTANTS.testUserSearchTerm;
      const username = await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('" + searchTerm + "')").first().locator(".dropdown-item.slds-wrap.small span").first().textContent();
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('" + searchTerm + "')").first().click();

      // Wait for user details to load
      await page.waitForTimeout(2000);

      // Verify user details appear
      await expect(page.frameLocator(".insext-popup").getByText(searchTerm, {exact: true}).first()).toBeVisible();
      await expect(page.frameLocator(".insext-popup").locator("text=" + username).first()).toBeVisible();
    });

    test("User Action Buttons", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Users tab
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Users')").click();

      // Wait for user search input
      await page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']").waitFor({timeout: 1000});

      // Type and select a user
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']");
      await searchInput.fill(TEST_CONSTANTS.testUserSearchTerm);
      await page.waitForTimeout(1000);
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('" + TEST_CONSTANTS.testUserSearchTerm + "')").first().click();

      // Wait for user details to load
      await page.waitForTimeout(2000);

      // Verify user action buttons appear
      await expect(page.frameLocator(".insext-popup").locator("a:has-text('Details')")).toBeVisible({timeout: 1000});
      //Pset and PsetG buttons should be visible
      await expect(await page.frameLocator(".insext-popup").locator("a:has-text('PSet')").count()).toBe(2);
    });

    test("Enable Debug Logs", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Users tab
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Users')").click();

      // Wait for user search input
      await page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']").waitFor({timeout: 1000});

      // Type and select a user
      const searchInput = page.frameLocator(".insext-popup").locator("input[placeholder*='Name, username']");
      await searchInput.fill(TEST_CONSTANTS.testUserSearchTerm);
      await page.waitForTimeout(1000);
      await page.frameLocator(".insext-popup").locator(".slds-dropdown__item:has-text('" + TEST_CONSTANTS.testUserSearchTerm + "')").first().click();

      // Wait for user details to load
      await page.waitForTimeout(2000);

      // Click Enable Logs button
      const enableLogsButton = page.frameLocator(".insext-popup").locator("a#enableDebugLog");
      await expect(enableLogsButton).toBeVisible({timeout: 1000});

      // Note: Clicking this will trigger API calls, but we'll just verify the button exists
      await expect(enableLogsButton).toBeEnabled();
    });
  });

  test.describe("Shortcuts Tab", () => {
    const shortcutInputSelector = "input[placeholder*='!profile']";
    // referenceId used in popup.js composite request for each metadata type (name + "Select")
    const ALL_METADATA_REFERENCE_IDS = ["flowsSelect", "profilesSelect", "permissionSetsSelect", "classesSelect"];

    async function openShortcutsTab(page) {
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Shortcuts')").click();
      await page.frameLocator(".insext-popup").locator(shortcutInputSelector).waitFor({timeout: 1000});
      return page.frameLocator(".insext-popup").locator(shortcutInputSelector);
    }

    /**
     * Captures the metadata types (referenceIds) requested via the Shortcut tab's
     * composite search. Asserting on this (rather than on specific record content)
     * keeps these tests valid whether mocks are enabled or tests run against a real org.
     */
    function captureShortcutMetadataRequests(page) {
      const referenceIds = [];
      const handler = (request) => {
        if (request.method() !== "POST" || !request.url().includes("/composite")) {
          return;
        }
        let body;
        try {
          body = JSON.parse(request.postData() || "{}");
        } catch {
          return;
        }
        (body.compositeRequest || [])
          .filter((r) => ALL_METADATA_REFERENCE_IDS.includes(r.referenceId))
          .forEach((r) => referenceIds.push(r.referenceId));
      };
      page.on("request", handler);
      return {referenceIds, stop: () => page.off("request", handler)};
    }

    test("Switch to Shortcuts Tab", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Shortcuts tab
      const shortcutsTab = page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Shortcuts')");
      await shortcutsTab.click();

      // Verify Shortcuts tab is active
      await expect(shortcutsTab).toHaveClass(/slds-is-active/);

      // Verify shortcut search input appears
      await expect(page.frameLocator(".insext-popup").locator(shortcutInputSelector)).toBeVisible({timeout: 1000});
    });

    test("Search Shortcut (default: links + metadata)", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // Type in search
      await searchInput.fill("Flow");
      await page.waitForTimeout(1200);
      capture.stop();

      // Default search includes both setup links (e.g. "Flow Trigger Explorer") and metadata
      await expect(page.frameLocator(".insext-popup").locator("text=Flow Trigger Explorer")).toBeVisible({timeout: 3000});
      expect(capture.referenceIds).toContain("flowsSelect");
    });

    test("Search Shortcut with '/' prefix returns setup links only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "/" prefix should search setupLinks only, skipping the metadata composite call entirely
      await searchInput.fill("/Flow Trigger");
      await page.waitForTimeout(1200);
      capture.stop();

      // Setup link shortcut is shown
      await expect(page.frameLocator(".insext-popup").locator("text=Flow Trigger Explorer")).toBeVisible({timeout: 3000});

      // No metadata composite request should have been sent at all
      expect(capture.referenceIds).toEqual([]);
    });

    test("Search Shortcut with '!' prefix returns metadata only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "Inspector" is not a type alias, so the bare "!" prefix must query every metadata
      // type. It also happens to match the "Sf Inspector" permission set deployed from
      // test/main/, giving a real content assertion in addition to the referenceId check.
      // (Note: asserting *absence* of setup links here is unreliable against a real org,
      // since arbitrary search terms can coincidentally match unrelated real metadata.)
      await searchInput.fill("!Inspector");
      await page.waitForTimeout(1200);
      capture.stop();

      // Bare "!" queries every metadata type, regardless of the "Searchable metadata" options
      for (const referenceId of ALL_METADATA_REFERENCE_IDS) {
        expect(capture.referenceIds).toContain(referenceId);
      }
      await expect(page.frameLocator(".insext-popup").locator("text=Sf Inspector")).toBeVisible({timeout: 3000});
    });

    test("Search Shortcut with '!flow' prefix returns flows only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "RecordTrigger_InspectorTest" is the flow deployed from test/main/ (required test prerequisite)
      await searchInput.fill("!flow RecordTrigger");
      await page.waitForTimeout(1200);
      capture.stop();

      expect(capture.referenceIds).toEqual(["flowsSelect"]);
      await expect(page.frameLocator(".insext-popup").locator("text=RecordTrigger InspectorTest")).toBeVisible({timeout: 3000});
    });

    test("Search Shortcut with '!profile' prefix returns profiles only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "System Administrator" is a standard profile present in every org (real or scratch)
      await searchInput.fill("!profile System Administrator");
      await page.waitForTimeout(1200);
      capture.stop();

      expect(capture.referenceIds).toEqual(["profilesSelect"]);
      await expect(page.frameLocator(".insext-popup").locator("text=System Administrator")).toBeVisible({timeout: 3000});
    });

    test("Search Shortcut with '!class' prefix returns Apex classes only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "SalesforceInspectorTest" is the Apex class deployed from test/main/. Also verifies the
      // typed prefix forces the query even though "Apex Classes" is unchecked by default in
      // "Searchable metadata from Shortcut tab" (see options.js).
      await searchInput.fill("!class SalesforceInspectorTest");
      await page.waitForTimeout(1200);
      capture.stop();

      expect(capture.referenceIds).toEqual(["classesSelect"]);
      // Non-namespaced Apex classes render the same name twice (label + name lines), producing
      // two <mark> highlights for a single result row, so use .first() rather than a unique match.
      await expect(page.frameLocator(".insext-popup").locator("text=SalesforceInspectorTest").first()).toBeVisible({timeout: 3000});
    });

    test("Search Shortcut with '!perm' prefix returns Permission Sets only", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);
      const searchInput = await openShortcutsTab(page);
      const capture = captureShortcutMetadataRequests(page);

      // "Sf Inspector" is the permission set deployed from test/main/ (SfInspector.permissionset-meta.xml)
      await searchInput.fill("!perm Sf Inspector");
      await page.waitForTimeout(1200);
      capture.stop();

      expect(capture.referenceIds).toEqual(["permissionSetsSelect"]);
      await expect(page.frameLocator(".insext-popup").locator("text=Sf Inspector")).toBeVisible({timeout: 3000});
    });
  });

  test.describe("Org Tab", () => {
    test("Switch to Org Tab", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Org tab
      const orgTab = page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Org')");
      await orgTab.click();

      // Verify Org tab is active
      await expect(orgTab).toHaveClass(/slds-is-active/);

      // Verify org info table appears
      await expect(page.frameLocator(".insext-popup").locator("text=Org Id")).toBeVisible({timeout: 1000});
    });

    test("Delete Apex Logs Button", async ({page, extensionId}) => {
      await initPopupPage(page, extensionId);

      // Click Org tab
      await page.frameLocator(".insext-popup").locator(".slds-tabs_scoped__item:has-text('Org')").click();

      // Wait for org info to load
      await page.waitForTimeout(2000);

      // Verify Delete All ApexLogs button exists
      await expect(page.frameLocator(".insext-popup").locator("a#deleteLogs:has-text('Delete All ApexLogs')")).toBeVisible({timeout: 1000});
    });
  });
});
