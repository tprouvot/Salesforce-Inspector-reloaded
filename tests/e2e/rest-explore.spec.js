import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createSuccessResponse,
  handleGetUserInfoSoap
} from "./test-helpers";

test.describe("REST Explore", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      const request = route.request();
      const url = request.url();
      const method = request.method();

      // Handle getUserInfo SOAP call (common handler)
      const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
      if (getUserInfoHandled) {
        return;
      }

      if (url.includes(mockHost)) {
        const success = (body = {}, status = 200) => route.fulfill(createSuccessResponse(body, status));

        // Handle REST calls
        if (url.includes("/services/data/")) {
          // POST (Create)
          if (method === "POST" && url.includes("sobjects/Inspector_Test__c")) {
            await success({id: "a00000000000001AAA", success: true, errors: []}, 201);
            return;
          }

          // PATCH (Update)
          if (method === "PATCH" && url.includes("sobjects/Inspector_Test__c/")) {
            await success(undefined, 204);
            return;
          }

          // DELETE (Delete)
          if (method === "DELETE" && url.includes("sobjects/Inspector_Test__c/")) {
            await success(undefined, 204);
            return;
          }

          // GET (Retrieve specific record)
          if (method === "GET" && url.includes("sobjects/Inspector_Test__c/") && !url.includes("/describe")) {
            await success({
              attributes: {type: "Inspector_Test__c", url: `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/a00000000000001AAA`},
              Id: "a00000000000001AAA",
              Name: "SFIR Updated"
            });
            return;
          }

          // SOQL Query
          if (url.includes("/query/?q=")) {
            await success({
              totalSize: 1,
              done: true,
              records: [
                {
                  attributes: {type: "Account", url: `/services/data/v${apiVersion}/sobjects/Account/001000000000001AAA`},
                  Id: "001000000000001AAA",
                  Name: "Test Account"
                }
              ]
            });
            return;
          }

          // Versions / Discovery
          if (url.includes(`/services/data/v${apiVersion}/`)) {
            await success({
              tooling: `/services/data/v${apiVersion}/tooling`,
              query: `/services/data/v${apiVersion}/query`
            });
            return;
          }

          // SObjects Global Describe
          if (url.includes("/sobjects/")) {
            await success({sobjects: []});
            return;
          }
        }

        // Generic Fallback
        await route.fulfill(createSuccessResponse({}));
        return;
      }

      await route.continue();
    });
  });

  test("Execute SOQL Query (GET)", async ({page, extensionId}) => {
    const exploreUrl = `chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`;
    await page.goto(exploreUrl);

    // Wait for app load
    await page.waitForSelector("select.slds-select", {timeout: 10000});

    // Select GET
    await page.locator('select.slds-select:has(option[value="GET"])').selectOption("GET");

    // Fill Query
    const endpointInput = page.locator('input[placeholder*="/services/data/v"]');
    await endpointInput.fill(`/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+LIMIT+1`);

    // Send
    await page.click('button:has-text("Send")');

    // Verify
    const responseCode = page.locator("code.language-json");
    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"totalSize": 1');
    await expect(responseCode).toContainText('"Name": "Test Account"');
  });

  test("CRUD Flow (POST, PATCH, GET, DELETE)", async ({page, extensionId}) => {
    const exploreUrl = `chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`;
    await page.goto(exploreUrl);
    await page.waitForSelector("select.slds-select", {timeout: 10000});

    const methodSelect = page.locator('select.slds-select:has(option[value="GET"])');
    const endpointInput = page.locator('input[placeholder*="/services/data/v"]');
    const sendBtn = page.locator('button:has-text("Send")');
    const responseCode = page.locator("code.language-json");
    const bodyInput = page.locator("textarea.slds-textarea");

    // 1. POST (Create)
    await methodSelect.selectOption("POST");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Inspector_Test__c/`);
    await bodyInput.fill('{ "Name" : "SFIR" }');
    await sendBtn.click();

    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"id": "a00000000000001AAA"');
    await expect(responseCode).toContainText('"success": true');

    // The inspector shows status in a badge
    const statusBadge = page.locator('.slds-badge:has-text("Status:")');
    await expect(statusBadge).toContainText("Status: 201");

    // 2. PATCH (Update)
    await methodSelect.selectOption("PATCH");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Inspector_Test__c/a00000000000001AAA`);
    await bodyInput.fill('{ "Name" : "SFIR Updated" }');
    await sendBtn.click();

    // Wait for status 204 (No Content) or success indication
    await expect(statusBadge).toContainText("Status: 204");

    // 3. GET (Retrieve)
    await methodSelect.selectOption("GET");
    await sendBtn.click();

    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"Name": "SFIR Updated"');
    await expect(statusBadge).toContainText("Status: 200");

    // 4. DELETE (Delete)
    await methodSelect.selectOption("DELETE");
    await sendBtn.click();

    await expect(statusBadge).toContainText("Status: 204");
  });

});
