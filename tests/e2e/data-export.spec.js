import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createSuccessResponse,
  handleGetUserInfoSoap
} from "./test-helpers";

test.describe("Data Export", () => {
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

      // Handle getUserInfo SOAP call (common handler)
      const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
      if (getUserInfoHandled) {
        return;
      }

      if (url.includes(mockHost)) {
        const success = (body = {}, status = 200) => route.fulfill(createSuccessResponse(body, status));

        // Global Describe (SObjects)
        if (url.includes("/sobjects/") && !url.includes("sobjects/Account")) {
          await success({
            sobjects: [
              {name: "Account", label: "Account", keyPrefix: "001", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Account/describe`}},
              {name: "Contact", label: "Contact", keyPrefix: "003", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Contact/describe`}},
              {name: "Inspector_Test__c", label: "Inspector Test", keyPrefix: "a00", queryable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/describe`}}
            ]
          });
          return;
        }

        // Account Describe (Fields)
        if (url.includes("/sobjects/Account/describe")) {
          await success({
            name: "Account",
            fields: [
              {name: "Id", label: "Account ID", type: "id"},
              {name: "Name", label: "Account Name", type: "string"},
              {name: "Type",
                label: "Account Type",
                type: "picklist",
                picklistValues: [
                  {value: "Customer - Channel", label: "Customer - Channel", active: true},
                  {value: "Customer - Direct", label: "Customer - Direct", active: true}
                ]}
            ]
          });
          return;
        }

        // SOQL Query
        if (url.includes("/query/?q=")) {
          const query = decodeURIComponent(url.split("q=")[1]);

          if (query.toLowerCase().includes("from account")) {
            await success({
              totalSize: 2,
              done: true,
              records: [
                {
                  attributes: {type: "Account", url: `/services/data/v${apiVersion}/sobjects/Account/001000000000001AAA`},
                  Id: "001000000000001AAA",
                  Name: "Test Account 1",
                  Type: "Customer - Direct"
                },
                {
                  attributes: {type: "Account", url: `/services/data/v${apiVersion}/sobjects/Account/001000000000002AAA`},
                  Id: "001000000000002AAA",
                  Name: "Test Account 2",
                  Type: "Customer - Channel"
                }
              ]
            });
            return;
          }

          await success({totalSize: 0, done: true, records: []});
          return;
        }

        // Fallback
        await success({});
        return;
      }

      await route.continue();
    });
  });

  test("Execute Simple Export", async ({page, extensionId}) => {
    const exportUrl = `chrome-extension://${extensionId}/data-export.html?host=${mockHost}`;
    await page.goto(exportUrl);

    // Wait for the query box to appear
    await page.waitForSelector("textarea#query");

    // Enter Query
    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name, Type FROM Account");

    // Click Export
    await page.click("button:has-text('Run Export')");

    // Verify Results
    // Wait for the status to show completion
    await expect(page.locator(".result-status")).toContainText("Exported 2 records");

    // Wait for the table to appear (it's inside #result-area)
    const resultTable = page.locator("#result-area table");
    await expect(resultTable).toBeVisible();

    // Check Headers
    // The table is virtualized and uses <td> for headers in the first row, not <th>
    const headerCells = resultTable.locator("tr").first().locator("td");
    await expect(headerCells.nth(1)).toHaveText("Id");
    await expect(headerCells.nth(2)).toHaveText("Name");
    await expect(headerCells.nth(3)).toHaveText("Type");

    // Check Data
    // The data rows follow the header row
    const firstDataRow = resultTable.locator("tr").nth(1);
    await expect(firstDataRow.locator("td").nth(1)).toContainText("001000000000001AAA");
    await expect(firstDataRow.locator("td").nth(2)).toContainText("Test Account 1");
  });

  test("Autocomplete Suggestions", async ({page, extensionId}) => {
    const exportUrl = `chrome-extension://${extensionId}/data-export.html?host=${mockHost}`;
    await page.goto(exportUrl);
    await page.waitForSelector("textarea#query");

    const queryInput = page.locator("textarea#query");

    // 1. Object Autocomplete
    await queryInput.fill("SELECT Id FROM Acc");
    // Trigger autocomplete (usually automatic on typing, but we might need to wait)
    // The autocomplete-box is always present, we check if it has results
    await expect(page.locator(".autocomplete-box")).toBeVisible();
    await expect(page.locator(".autocomplete-results")).toContainText("Account");

    // Click suggestion - target the link element specifically
    await page.locator(".autocomplete-results a").filter({hasText: "Account"}).click();

    // Autocomplete adds a trailing space
    await expect(queryInput).toHaveValue("SELECT Id FROM Account ");

    // 2. Field Autocomplete
    // Position cursor after "Id, "
    await queryInput.fill("SELECT Id, Nam FROM Account");
    // Move cursor to end to trigger autocomplete logic
    // Note: The cursor needs to be at the end of "Nam"
    // "SELECT Id, Nam".length is 14.
    // But we filled the whole string.
    // The autocomplete logic looks at cursor position.
    // "SELECT Id, Nam FROM Account"
    // Cursor at end -> context is "Account" (word after FROM)? No.
    // The code looks for the token at cursor.
    // If cursor at end, token is "Account".
    // We want to autocomplete "Nam". We need to put cursor after "Nam".

    // Let's set the value and move cursor to position 14 (after Nam)
    await queryInput.fill("SELECT Id, Nam FROM Account");
    // Calculate position: "SELECT Id, Nam".length = 14
    await page.evaluate(() => {
      const el = document.querySelector("textarea#query");
      el.selectionStart = 14;
      el.selectionEnd = 14;
      // Trigger input event to notify app
      el.dispatchEvent(new Event("input", {bubbles: true}));
    });

    // Now wait for field suggestions
    await expect(page.locator(".autocomplete-header")).toContainText("Account fields suggestions");

    await expect(page.locator(".autocomplete-results")).toContainText("Name");
    // Click suggestion - target the link element specifically
    await page.locator(".autocomplete-results a").filter({hasText: "Name"}).first().click();

    // Autocomplete adds ", " after fields when not last?
    // "SELECT Id, Name,  FROM Account"
    await expect(queryInput).toHaveValue("SELECT Id, Name FROM Account");
  });

  test("Copy as CSV", async ({page, extensionId}) => {
    const exportUrl = `chrome-extension://${extensionId}/data-export.html?host=${mockHost}`;
    await page.goto(exportUrl);
    await page.waitForSelector("textarea#query");

    // Run a query first
    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records");

    // Click Copy CSV
    await page.click("button:has-text('Copy (CSV)')");

    // Verify Clipboard Content
    // We access the window.testClipboardValue variable we injected
    const clipboardContent = await page.evaluate(() => window.testClipboardValue);

    expect(clipboardContent).toContain('"Id","Name"');
    expect(clipboardContent).toContain('"001000000000001AAA","Test Account 1"');
  });

});
