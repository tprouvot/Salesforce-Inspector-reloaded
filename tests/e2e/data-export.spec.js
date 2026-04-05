import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

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
    // Column 0 is the checkbox cell (added for selective deletion)
    // Column 1 is "_" (record reference), then the queried fields follow
    const headerCells = resultTable.locator("tr").first().locator("td");
    await expect(headerCells.nth(2)).toHaveText("Id");
    await expect(headerCells.nth(3)).toHaveText("Name");
    await expect(headerCells.nth(4)).toHaveText("Type");

    // Check Data
    // The data rows follow the header row
    const firstDataRow = resultTable.locator("tr").nth(1);
    await expect(firstDataRow.locator("td").nth(2)).toHaveText(/^001/);
    await expect(firstDataRow.locator("td").nth(3)).toContainText("Test Account 1");
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

    // Column 0 is checkbox, column 1 is "_", column 2 is "Id", column 3 is "Name"
    const firstRow = resultTable.locator("tr").nth(1);
    const id = await firstRow.locator("td").nth(2).textContent();
    const name = await firstRow.locator("td").nth(3).textContent();

    // Click Copy CSV
    await page.click("button:has-text('Copy (CSV)')");

    // Verify Clipboard Content
    // Get clipboard content after the link/button has been clicked
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
    const clipboardContent = await handle.jsonValue();

    expect(clipboardContent).toContain('"Id","Name"');
    expect(clipboardContent).toContain('"' + id + '","' + name + '"');
  });

  test("Delete button disabled when no records selected", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    // Delete button should be disabled — no rows selected yet
    const deleteBtn = page.locator("button:has-text('Delete Records')");
    await expect(deleteBtn).toBeVisible();
    await expect(deleteBtn).toBeDisabled();
  });

  test("Checkbox column renders after export", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");
    await expect(resultTable).toBeVisible();

    // Header should have Select All checkbox
    const selectAllCb = resultTable.locator("tr").first().locator(".select-all-checkbox");
    await expect(selectAllCb).toBeVisible();
    await expect(selectAllCb).not.toBeChecked();

    // Each data row should have a row checkbox
    const rowCheckboxes = resultTable.locator("tr:not(:first-child) .row-select-checkbox");
    await expect(rowCheckboxes).toHaveCount(2);
    for (const cb of await rowCheckboxes.all()) {
      await expect(cb).not.toBeChecked();
    }
  });

  test("Selecting a row enables delete button with count", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");

    // Select the first data row checkbox
    const firstRowCb = resultTable.locator("tr:nth-child(2) .row-select-checkbox");
    await firstRowCb.check();

    // Delete button should now show count
    await expect(page.locator("button:has-text('Delete 1 Record')")).toBeVisible();
    await expect(page.locator("button:has-text('Delete 1 Record')")).toBeEnabled();

    // Header checkbox should be indeterminate (some but not all selected)
    const selectAllCb = resultTable.locator("tr").first().locator(".select-all-checkbox");
    const isIndeterminate = await selectAllCb.evaluate(el => el.indeterminate);
    expect(isIndeterminate).toBe(true);
  });

  test("Select All selects all rows and updates delete count", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");
    const selectAllCb = resultTable.locator("tr").first().locator(".select-all-checkbox");

    // Click Select All
    await selectAllCb.check();

    // All row checkboxes should be checked
    const rowCheckboxes = resultTable.locator("tr:not(:first-child) .row-select-checkbox");
    for (const cb of await rowCheckboxes.all()) {
      await expect(cb).toBeChecked();
    }

    // Delete button shows total count
    await expect(page.locator("button:has-text('Delete 2 Records')")).toBeVisible();
    await expect(page.locator("button:has-text('Delete 2 Records')")).toBeEnabled();

    // Select All checkbox should be checked (not indeterminate)
    await expect(selectAllCb).toBeChecked();
    const isIndeterminate = await selectAllCb.evaluate(el => el.indeterminate);
    expect(isIndeterminate).toBe(false);
  });

  test("Deselect All disables delete button", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");
    const selectAllCb = resultTable.locator("tr").first().locator(".select-all-checkbox");

    // Select All then Deselect All
    await selectAllCb.check();
    await expect(page.locator("button:has-text('Delete 2 Records')")).toBeEnabled();

    await selectAllCb.uncheck();

    // Delete button should be back to disabled
    await expect(page.locator("button:has-text('Delete Records')")).toBeDisabled();

    // All row checkboxes should be unchecked
    const rowCheckboxes = resultTable.locator("tr:not(:first-child) .row-select-checkbox");
    for (const cb of await rowCheckboxes.all()) {
      await expect(cb).not.toBeChecked();
    }
  });

  test("Selected rows have highlighted background", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    await queryInput.fill("SELECT Id, Name FROM Account WHERE Name like 'Test Account%'");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported 2 records", {timeout: 2000});

    const resultTable = page.locator("#result-area table");

    // Before selection: no row-selected class
    const firstDataRow = resultTable.locator("tr:nth-child(2)");
    await expect(firstDataRow).not.toHaveClass(/row-selected/);

    // Select first row
    await resultTable.locator("tr:nth-child(2) .row-select-checkbox").check();

    // After selection: row-selected class present
    await expect(firstDataRow).toHaveClass(/row-selected/);
  });

});
