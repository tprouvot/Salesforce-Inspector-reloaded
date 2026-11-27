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

  // formatXml (addon/utils.js) is used by the REST Explorer to pretty-print XML responses.
  // The response is stubbed at page level so the test is identical in mock and real-org mode.
  async function sendStubbedXml(page, extensionId, body) {
    const endpoint = `/services/data/v${apiVersion}/xml-format-test`;
    await page.route(`**${endpoint}`, route => route.fulfill({
      status: 200,
      contentType: "application/xml",
      headers: {"access-control-allow-origin": "*"},
      body
    }));
    await page.goto(`chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`);
    await page.waitForSelector("select.slds-select", {timeout: 1000});
    await page.locator('input[placeholder*="/services/data/v"]').fill(endpoint);
    await page.click('button:has-text("Send")');
    const responseCode = page.locator("code.language-xml");
    await expect(responseCode).toBeVisible();
    return responseCode;
  }

  test("Format XML Response (indent, attributes, escaping, CDATA, comments)", async ({page, extensionId}) => {
    const compact = '<root a="1" b="x&amp;y"><item>text &amp; more</item><empty/><cdata><![CDATA[<raw>]]></cdata>'
      + "<parent>\n   <child>x</child>\n</parent><!-- note --></root>";
    const responseCode = await sendStubbedXml(page, extensionId, compact);

    expect(await responseCode.evaluate(el => el.textContent)).toBe([
      '<root a="1" b="x&amp;y">',
      "  <item>text &amp; more</item>",
      "  <empty/>",
      "  <cdata><![CDATA[<raw>]]></cdata>",
      "  <parent>",
      "    <child>x</child>",
      "  </parent>",
      "  <!-- note -->",
      "</root>"
    ].join("\n"));
  });

  test("Format XML Response returns malformed XML unchanged", async ({page, extensionId}) => {
    const malformed = "<root><unclosed></root>";
    const responseCode = await sendStubbedXml(page, extensionId, malformed);

    expect(await responseCode.evaluate(el => el.textContent)).toBe(malformed);
  });

  test("Request History, Saved Requests And Templates Toolbar", async ({page, context, extensionId}) => {
    const selectSource = (source) => page.locator(`label[for="sfir-query-source-${source}"]`).click();

    await context.addInitScript(version => {
      window.localStorage.setItem("restQueryHistory", JSON.stringify([
        {key: 1, method: "GET", endpoint: `/services/data/v${version}/limits`, body: ""},
        {key: 2, method: "POST", endpoint: `/services/data/v${version}/sobjects/Account/`, body: '{"Name":"Acme"}'}
      ]));
      window.localStorage.setItem("restSavedQueryHistory", JSON.stringify([
        {key: 10, label: "Create Account", method: "POST", endpoint: `/services/data/v${version}/sobjects/Account/`, body: '{"Name":"Saved"}'}
      ]));
    }, apiVersion);

    await page.goto(`chrome-extension://${extensionId}/rest-explore.html?host=${mockHost}`);
    await page.waitForSelector("select.slds-select", {timeout: 1000});

    const endpointInput = page.locator('input[placeholder*="/services/data/v"]');
    const methodSelect = page.locator('select.slds-select:has(option[value="GET"])');
    const bodyInput = page.locator("textarea.slds-textarea");
    const saveBtn = page.getByRole("button", {name: "Save Query"});
    const sendBtn = page.getByRole("button", {name: "Send"});
    const listbox = page.locator("#query-search-listbox");
    const options = listbox.locator("[role='option']");

    // Save Query sits on the Send row, and no inline Clear button clutters the toolbar.
    const saveBox = await saveBtn.boundingBox();
    const sendBox = await sendBtn.boundingBox();
    expect(Math.abs(saveBox.y - sendBox.y), "Save Query sits on the Send row").toBeLessThan(2);
    await expect(page.locator(".sfir-query-toolbar button", {hasText: "Clear"})).toHaveCount(0);

    // 1. All is selected by default and searches across Saved, History, and Templates with group headers.
    const searchAll = page.getByRole("combobox", {name: "Search all"});
    await searchAll.click();
    await expect(listbox.locator(".slds-listbox__option-header")).toHaveText(["Saved", "History", "Templates"]);
    await searchAll.fill("create account");
    await expect(options.first().locator(".slds-badge_inverse")).toHaveText("Create Account");

    // 2. Search History across method and endpoint, with highlighted matches and method badges.
    await selectSource("history");
    const history = page.getByRole("combobox", {name: "Search history"});
    await history.click();
    await expect(options).toHaveCount(2);
    await history.fill("post account");
    await expect(options).toHaveCount(1);
    await expect(options.first().locator(".sfir-query-badge")).toHaveText("POST");
    await expect(options.first().locator(".sfir-search-match")).toHaveText(["POST", "Account"]);

    // Deleting a history item is immediate and does not overwrite the active request.
    await history.fill("");
    await expect(options).toHaveCount(2);
    await options.nth(1).locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(1);

    // 3. Saved requests show label and method badges, restore request fields, and confirm before delete.
    await selectSource("saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    await saved.click();
    await expect(options).toHaveCount(1);
    await expect(options.first().locator(".slds-badge_inverse")).toHaveText("Create Account");
    await options.first().click();
    await expect(methodSelect).toHaveValue("POST");
    await expect(endpointInput).toHaveValue(`/services/data/v${apiVersion}/sobjects/Account/`);
    await expect(bodyInput).toHaveValue('{"Name":"Saved"}');

    await saveBtn.click();
    const modal = page.getByRole("dialog");
    const labelInput = modal.getByLabel("Label (optional)");
    await expect(labelInput).toHaveValue("Create Account");
    await modal.getByRole("button", {name: "Cancel", exact: true}).click();

    await saved.click();
    page.once("dialog", dialog => dialog.dismiss());
    await options.first().locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(1);
    await saved.press("Escape");

    // 4. Empty endpoint disables Save Query; saving via modal shows toast and resets label.
    await endpointInput.fill("");
    await expect(saveBtn).toBeDisabled();

    await methodSelect.selectOption("PATCH");
    await endpointInput.fill(`/services/data/v${apiVersion}/sobjects/Account/001000000000001AAA`);
    await bodyInput.fill('{"Name":"Patched"}');
    await saveBtn.click();
    await labelInput.fill("Patch Account");
    await labelInput.press("Enter");
    await expect(modal).toHaveCount(0);

    const toast = page.locator(".slds-notify_toast[role='status']");
    await expect(toast.getByRole("heading", {name: "Saved"})).toBeVisible();

    // PATCH and DELETE on the same endpoint do not overwrite one another in Saved or History.
    await methodSelect.selectOption("DELETE");
    await bodyInput.fill("");
    await saveBtn.click();
    await expect(labelInput).toHaveValue("");
    await labelInput.fill("Delete Account");
    await modal.getByRole("button", {name: "Save"}).click();
    await saved.click();
    await expect(options).toHaveCount(3);

    // 5. Templates are searchable and read-only.
    await selectSource("templates");
    const templates = page.getByRole("combobox", {name: "Search templates"});
    await templates.fill("limits");
    await expect(options).toHaveCount(1);
    await expect(options.first().locator(".sfir-combobox-delete")).toHaveCount(0);
    await options.first().click();
    await expect(methodSelect).toHaveValue("GET");
    await expect(endpointInput).toHaveValue(`/services/data/v${apiVersion}/limits`);
  });
});
