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

  test("Caret Autocomplete Popup With Keyboard", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    const popup = page.locator(".caret-popup");
    await queryInput.fill("");
    await queryInput.focus();

    // 1. Object name: typing opens the popup at the caret, Enter inserts the highlighted suggestion
    await queryInput.pressSequentially("SELECT Id FROM Acc");
    await expect(popup).toBeVisible();
    await expect(popup.locator(".caret-popup-item.active")).toContainText("Account");
    await expect(queryInput).toHaveAttribute("aria-expanded", "true");
    await queryInput.press("Enter");
    await expect(queryInput).toHaveValue("SELECT Id FROM Account ");
    // No word is being typed after the inserted suggestion, so the popup closes and Enter is a plain newline again
    await expect(popup).toBeHidden();

    // 2. Field name: arrow keys move the highlight, Tab inserts it
    await queryInput.fill("SELECT Id FROM Account");
    await page.evaluate(() => {
      const el = document.querySelector("textarea#query");
      el.setSelectionRange("SELECT Id".length, "SELECT Id".length);
    });
    await queryInput.pressSequentially(", Nam");
    await expect(popup).toBeVisible();
    const items = popup.locator(".caret-popup-item");
    const first = await items.nth(0).locator(".caret-popup-value").textContent();
    if (await items.count() > 1) {
      await queryInput.press("ArrowDown");
      await expect(items.nth(1)).toHaveClass(/active/);
      await queryInput.press("ArrowUp");
    }
    await expect(items.nth(0)).toHaveClass(/active/);
    await queryInput.press("Tab");
    await expect(queryInput).toHaveValue(`SELECT Id, ${first} FROM Account`);
    await expect(queryInput).toBeFocused();

    // 3. Escape closes the popup without changing the query
    await queryInput.pressSequentially(", Ty");
    await expect(popup).toBeVisible();
    await queryInput.press("Escape");
    await expect(popup).toBeHidden();
    await expect(queryInput).toHaveValue(`SELECT Id, ${first}, Ty FROM Account`);
  });

  test("Caret Autocomplete Keywords And Operators", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const queryInput = page.locator("textarea#query");
    const popup = page.locator(".caret-popup");
    const values = popup.locator(".caret-popup-value");
    await queryInput.fill("");
    await queryInput.focus();

    // 1. After the object name: clause keywords, in SOQL clause order
    await queryInput.pressSequentially("SELECT Id FROM Account ");
    await expect(popup).toBeHidden(); // Enter must still insert a newline here
    await queryInput.pressSequentially("w");
    await expect(popup.locator(".caret-popup-item.active")).toContainText("WHERE");
    await expect(values).toHaveText(["WHERE", "WITH"]);
    await queryInput.press("Enter");
    await expect(queryInput).toHaveValue("SELECT Id FROM Account WHERE ");

    // 2. Field name, then the operators applicable to its type open without typing
    await queryInput.pressSequentially("Ty");
    await expect(popup.locator(".caret-popup-item.active")).toContainText("Type");
    await queryInput.press("Enter");
    await expect(queryInput).toHaveValue("SELECT Id FROM Account WHERE Type ");
    await expect(popup).toBeVisible();
    await expect(page.locator(".autocomplete-header")).toContainText("Type (picklist) operator suggestions");
    await expect(values).toContainText(["=", "!=", "LIKE '%%'", "IN ()", "NOT IN ()", "= null", "!= null"]);
    await expect(values.filter({hasText: "INCLUDES"})).toHaveCount(0); // multi-select picklists only

    // 3. Operator, then the picklist values open without typing
    await queryInput.press("Enter");
    await expect(queryInput).toHaveValue("SELECT Id FROM Account WHERE Type = ");
    await expect(popup).toBeVisible();
    await expect(values.first()).toHaveText(/^'.+'$/);
    await queryInput.press("Enter");
    await expect(queryInput).toHaveValue(/^SELECT Id FROM Account WHERE Type = '[^']+' $/);

    // 4. After a complete condition: logical operators first, then the clauses that may follow WHERE
    await queryInput.pressSequentially("o");
    await expect(values).toHaveText(["OR", "ORDER BY", "OFFSET"]);
    await queryInput.press("Escape");
    await queryInput.press("Backspace");
    await queryInput.pressSequentially("a");
    await expect(values).toHaveText(["AND"]);
    await queryInput.press("Tab");
    await expect(queryInput).toHaveValue(/ AND $/);

    // 5. String field: no "= null" (not nillable), LIKE puts the caret between the % signs
    await queryInput.pressSequentially("Name ");
    await expect(page.locator(".autocomplete-header")).toContainText("Name (string) operator suggestions");
    await expect(values.filter({hasText: "null"})).toHaveCount(0);
    await queryInput.pressSequentially("l");
    await expect(values).toHaveText(["LIKE '%%'"]);
    await queryInput.press("Enter");
    await queryInput.pressSequentially("Acme");
    await expect(queryInput).toHaveValue(/ AND Name LIKE '%Acme%'$/);
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

});
