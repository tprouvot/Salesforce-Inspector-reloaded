import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  TEST_GUID,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

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
      //if mock is disabled, continue with the request
      if (!TEST_CONSTANTS.mockEnabled) {
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

  test("Execute SOQL Query (GET)", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`);

    // Wait for app load
    await page.waitForSelector("select.slds-select", {timeout: 1000});

    // Select GET
    await page.locator('select.slds-select:has(option[value="GET"])').selectOption("GET");

    // Fill Query
    const query = `/services/data/v${apiVersion}/query/?q=SELECT+Id,Name+FROM+Account+WHERE+Name+like+'Test%20Account%25'+LIMIT+2`;
    await page.locator('input[placeholder*="/services/data/v"]').fill(query);

    // Send
    await page.click('button:has-text("Send")');
    console.log("query: " + query);
    await waitSuccessfulHttpResponse(page, query, 1000);

    // Verify
    const responseCode = page.locator("code.language-json");
    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"totalSize": 2');
    await expect(responseCode).toContainText('"Name": "Test Account');
  });

  test("CRUD Flow (POST, PATCH, GET, DELETE)", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`);
    // Wait for app load
    await page.waitForSelector("select.slds-select", {timeout: 1000});

    const methodSelect = page.locator('select.slds-select:has(option[value="GET"])');
    const endpointInput = page.locator('input[placeholder*="/services/data/v"]');
    const sendBtn = page.locator('button:has-text("Send")');
    const responseCode = page.locator("code.language-json");
    const bodyInput = page.locator("textarea.slds-textarea");

    // 1. POST (Create)
    await methodSelect.selectOption("POST");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Inspector_Test__c/`);
    await bodyInput.fill('{ "Name" : "SFIR-' + TEST_GUID + '" }');
    await sendBtn.click();

    await waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/sobjects/Inspector_Test__c/", 1000);

    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"id": "');
    await expect(responseCode).toContainText('"success": true');

    // The inspector shows status in a badge
    const statusBadge = page.locator('.slds-badge:has-text("Status:")');
    await expect(statusBadge).toContainText("Status: 201");

    //extract the id from the response code
    const id = await responseCode.evaluate(el => el.textContent.match(/"id": "([^"]+)"/)[1]);
    console.log("id: " + id);

    // 2. PATCH (Update)
    await methodSelect.selectOption("PATCH");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Inspector_Test__c/${id}`);
    await bodyInput.fill('{ "Name" : "SFIR Updated-' + TEST_GUID + '" }');
    await sendBtn.click();

    await waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/sobjects/Inspector_Test__c/" + id, 1000);

    // Wait for status 204 (No Content) or success indication
    await expect(statusBadge).toContainText("Status: 204");

    // 3. GET (Retrieve)
    await methodSelect.selectOption("GET");
    await sendBtn.click();

    await waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/sobjects/Inspector_Test__c/" + id, 1000);

    await expect(responseCode).toBeVisible();
    await expect(responseCode).toContainText('"Name": "SFIR Updated-' + TEST_GUID + '"');
    await expect(statusBadge).toContainText("Status: 200");

    // 4. DELETE (Delete)
    await methodSelect.selectOption("DELETE");
    await sendBtn.click();

    await waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/sobjects/Inspector_Test__c/" + id, 1000);

    await expect(statusBadge).toContainText("Status: 204");
  });
});
