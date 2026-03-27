import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

/**
 * Creates a serializable options object for data-export localStorage.
 * Pass to injectSessionData's dataExportOptions (closures are not preserved in addInitScript).
 */
function dataExportOptions(opts) {
  return { ...opts };
}

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

  test("Execute Simple Export", async ({page, context, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);

    // Wait for the query box to appear
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // Enter Query
    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name, Type FROM Account WHERE Name like 'Test Account%'");

    // Click Export
    await page.click("button:has-text('Run Export')");
    //Wait that the response is successful
    await waitSuccessfulHttpResponse(page, mockHost, 1000);

    // Verify Results
    // Wait for the status to show completion
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

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
    await expect(firstDataRow.locator("td").nth(1)).toHaveText(/^001/);
    await expect(firstDataRow.locator("td").nth(2)).toContainText("Test Account 1");
  });

  test("Autocomplete Suggestions", async ({page, context, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");

    // 1. Object Autocomplete
    await queryInput.fill("SELECT Id FROM Acc");

    // Trigger autocomplete (usually automatic on typing, but we might need to wait)
    // The autocomplete-box is always present, we check if it has results
    await expect(page.locator(".autocomplete-box")).toBeVisible();
    await expect(page.locator(".autocomplete-results")).toContainText("Account");

    // Click suggestion - target the link element specifically with title="Account"
    await page.locator(".autocomplete-results a[title='Account']").first().click();

    // Autocomplete adds a trailing space
    await expect(queryInput).toHaveValue("SELECT Id FROM Account ");

    //Wait describe for Account
    await waitSuccessfulHttpResponse(page, `describe`, 10000);

    // 2. Field Autocomplete (clear first, then type to trigger autocomplete as we go)
    await queryInput.fill("");
    await queryInput.pressSequentially("SELECT Id, Nam FROM Account", {delay: 10});

    //The cursor is at the end of the query, so we should display object suggestions
    await expect(page.locator(".autocomplete-header")).toContainText("Objects suggestions", {timeout: 2000});

    // Move cursor from end (27) to position 14 (after "Nam") - ArrowLeft triggers keyup→autocomplete
    await queryInput.focus();
    for (let i = 0; i < (27-14); i++) {
      await page.keyboard.press("ArrowLeft");
    }
    //wait for the autocomplete to be triggered
    await page.waitForTimeout(200);

    //We should display field suggestions for the Account object
    await expect(page.locator(".autocomplete-header")).toContainText("Account fields suggestions", {timeout: 2000});
    await expect(page.locator(".autocomplete-results")).toContainText("Name");

    // Click suggestion - target the link element specifically
    await page.locator(".autocomplete-results a").filter({hasText: "Name"}).first().click();

    // Autocomplete adds ", " after fields when not last?
    // "SELECT Id, Name, FROM Account"
    await expect(queryInput).toHaveValue("SELECT Id, Name FROM Account");
  });

  test("Copy as CSV", async ({page, context, extensionId}) => {
    // Grant clipboard permissions to browser context
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // Run a query first
    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%' ORDER BY Name");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    // Wait for the table to appear (it's inside #result-area)
    const resultTable = page.locator("#result-area table");
    await expect(resultTable).toBeVisible();

    //in the result table extract the first row and get the values of id
    const firstRow = resultTable.locator("tr").nth(1);
    const id = await firstRow.locator("td").nth(1).textContent();
    const name = await firstRow.locator("td").nth(2).textContent();

    // Click Copy CSV
    await page.click("button:has-text('Copy (CSV)')");

    // Verify Clipboard Content
    // Get clipboard content after the link/button has been clicked
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
    const clipboardContent = await handle.jsonValue();

    expect(clipboardContent).toContain('"Id","Name"');
    expect(clipboardContent).toContain('"' + id + '","' + name + '"');
  });

  test("Child relationship autocomplete in subquery", async ({page, context, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    // Query with main FROM Account (parent) and subquery; we type "Con" after FROM in subquery
    const baseQuery = "SELECT Id, (SELECT Id FROM ) FROM Account";
    await queryInput.fill(baseQuery);
    // Position cursor after "FROM " in subquery (pos 27) and type "Con" to trigger autocomplete
    await queryInput.evaluate(el => {
      el.focus();
      el.setSelectionRange(27, 27);
    });
    await queryInput.pressSequentially("Con", {delay: 80});
    await page.waitForTimeout(400);

    // Should show child relationship "Contacts" from Account's childRelationships
    await expect(page.locator(".autocomplete-results")).toContainText("Contacts", {timeout: 3000});
  });

  test("Subquery export with nested Contacts", async ({page, context, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name, (SELECT Id, Name FROM Contacts) FROM Account WHERE Name LIKE 'Test Account%'");

    await page.click("button:has-text('Run Export')");
    await waitSuccessfulHttpResponse(page, mockHost, 1000);

    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");
    await expect(resultTable).toBeVisible();

    // Verify subquery column(s) - Contacts or Contacts.records etc.
    const headerCells = resultTable.locator("tr").first().locator("td");
    const headerText = await headerCells.allTextContents();
    expect(headerText.some(t => t.includes("Contacts"))).toBeTruthy();

    // First Account has 2 Contacts
    const firstDataRow = resultTable.locator("tr").nth(1);
    await expect(firstDataRow.locator("td").nth(1)).toHaveText(/^001/);
  });

  test.describe("Options: Enable SOQL Styling", () => {
    test.beforeEach(async ({context}) => {
      await injectSessionData(context, {
        host: mockHost,
        token: mockToken,
        version: apiVersion,
        dataExportOptions: dataExportOptions({enableSoqlStyling: true})
      });
    });

    test("SOQL Styling enabled - highlight mirror and Pretty Format visible", async ({page, context, extensionId}) => {
      await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
      await page.waitForSelector("textarea#query", {timeout: 2000});

      const queryInput = page.locator("textarea#query");
      await queryInput.fill("SELECT Id, Name FROM Account");

      // When SOQL Styling is enabled: mirror and Pretty Format are rendered (only when enableSoqlStyling is true)
      await expect(page.locator(".query-highlight-mirror")).toBeVisible({timeout: 3000});
      await expect(page.locator("button:has-text('Pretty Format')")).toBeVisible();

      // Keywords should be highlighted (SELECT, FROM) - wait for React render + updateQueryHighlight
      await expect(async () => {
        const html = await page.locator(".query-highlight-code").innerHTML();
        expect(html).toContain("soql-keyword");
      }).toPass({timeout: 3000});
    });
  });

  test.describe("Options: Enable SOQL Comments", () => {
    test.beforeEach(async ({context}) => {
      await injectSessionData(context, {
        host: mockHost,
        token: mockToken,
        version: apiVersion,
        dataExportOptions: dataExportOptions({enableSoqlComments: true})
      });
    });

    test("SOQL Comments - query with comments executes (comments stripped)", async ({page, context, extensionId}) => {
      await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
      await page.waitForSelector("textarea#query", {timeout: 2000});

      const queryInput = page.locator("textarea#query");
      // Query with inline and block comments - removeComments strips them before execution
      await queryInput.fill("SELECT Id, Name FROM Account -- inline comment\nWHERE Name LIKE 'Test Account%'");

      // Capture the query sent to Salesforce when Run Export is clicked
      const [request] = await Promise.all([
        page.waitForRequest(req => {
          const url = req.url();
          return url.includes(mockHost) && url.includes("/query") && url.includes("q=");
        }),
        page.click("button:has-text('Run Export')")
      ]);

      const url = new URL(request.url());
      const sentQuery = url.searchParams.get("q") || "";

      // Validate comments were stripped before sending
      expect(sentQuery).toEqual("SELECT Id, Name FROM Account \nWHERE Name LIKE 'Test Account%'");

      await waitSuccessfulHttpResponse(page, mockHost, 1000);
      await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});
    });
  });

  test.describe("Options: Enable field/object autocomplete popup", () => {
    test.beforeEach(async ({context}) => {
      await injectSessionData(context, {
        host: mockHost,
        token: mockToken,
        version: apiVersion,
        dataExportOptions: dataExportOptions({enableDataExportAutocomplete: true})
      });
    });

    test("Autocomplete popup appears when typing object name", async ({page, context, extensionId}) => {
      await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
      await page.waitForSelector("textarea#query", {timeout: 2000});

      const queryInput = page.locator("textarea#query");
      await queryInput.fill("SELECT Id FROM Acc");

      await page.waitForTimeout(300);

      // Popup (floating) should be visible when option is enabled
      await expect(page.locator(".autocomplete-popup")).toBeVisible({timeout: 2000});
      await expect(page.locator(".autocomplete-popup")).toContainText("Account");

      // Inline autocomplete box also has results
      await expect(page.locator(".autocomplete-results")).toContainText("Account");
    });
  });

  test("Autocomplete popup hidden when option disabled (default)", async ({page, context, extensionId}) => {
    // Default: enableDataExportAutocomplete is false - popup should not appear
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id FROM Acc");

    await page.waitForTimeout(300);

    // Popup should NOT be visible (option disabled by default)
    await expect(page.locator(".autocomplete-popup")).not.toBeVisible();
    // Inline autocomplete results still show
    await expect(page.locator(".autocomplete-results")).toContainText("Account");
  });

});
