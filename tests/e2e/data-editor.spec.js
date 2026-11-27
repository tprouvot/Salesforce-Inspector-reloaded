import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  pasteData,
  fulfillSuccess,
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Data Editor", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context, page}) => {
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });

    await context.route("**/*", async route => {
      if (!TEST_CONSTANTS.mockEnabled) {
        await route.continue();
        return;
      }
      if (await routeMock(route, mockHost)) {
        return;
      }
      await route.continue();
    });
    // The editor's own Account describe (page routes run before the context's generic mock)
    await page.route(/\/sobjects\/Account\/describe(\?|$)/, route => fulfillSuccess(route, accountDescribe));
  });

  const picklist = values => values.map(value => ({value, label: value, active: true}));
  const accountDescribe = {
    name: "Account",
    createable: true,
    updateable: true,
    fields: [
      {name: "Id", type: "id", createable: false, updateable: false, nillable: false, referenceTo: []},
      {name: "Name", type: "string", length: 20, createable: true, updateable: true, nillable: false, referenceTo: []},
      {name: "Industry",
        type: "picklist",
        length: 255,
        createable: true,
        updateable: true,
        nillable: true,
        picklistValues: picklist(["Banking", "Energy", "Insurance", "Media", "Retail"]),
        referenceTo: []},
      {name: "NumberOfEmployees", type: "int", createable: true, updateable: true, nillable: true, referenceTo: []},
      {name: "Description", type: "textarea", length: 32000, createable: true, updateable: true, nillable: true, referenceTo: []},
      {name: "Site", type: "string", length: 80, createable: true, updateable: false, nillable: true, referenceTo: []},
      {name: "CreatedDate", type: "datetime", createable: false, updateable: false, nillable: false, referenceTo: []}
    ]
  };

  const header = ["_", "Id", "Name", "Industry"];
  const rows = [
    ["[Account]", "001000000000001AAA", "Acme", "Energy"],
    ["[Account]", "001000000000002AAA", "Globex", "Banking"],
    ["[Account]", "001000000000003AAA", "Initech", ""],
  ];

  async function openWithData(page, extensionId, data = {header, rows}) {
    // Seed the handoff store the same way Data Export does, then open the editor with its key
    await page.goto(`chrome-extension://${extensionId}/data-editor.html?host=${mockHost}`);
    const key = await page.evaluate(async payload => {
      const {saveHandoff} = await import("./data-editor-handoff.js");
      return saveHandoff(payload);
    }, {...data, apiType: "Enterprise"});
    await page.goto(`chrome-extension://${extensionId}/data-editor.html?host=${mockHost}&handoff=${key}`);
    if (data.rows.length > 0) {
      await expect(cell(page, 0, 0)).toHaveText(data.rows[0][0]);
    }
    if (data.header[2] == "Name") {
      // The describe is loaded: the Name header shows its type
      await expect(page.locator(".de-grid thead th").nth(3)).toHaveAttribute("title", /^Name \(string\)/);
    }
  }

  async function sentPayload(page, context, buttonName) {
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", {name: buttonName}).click()
    ]);
    await popup.waitForURL(/data-import.html/);
    const importUrl = popup.url();
    // Extension APIs are not available in tabs opened by window.open under Playwright, so read the payload here
    await popup.close();
    const payload = await page.evaluate(async key => {
      const {loadHandoff} = await import("./data-editor-handoff.js");
      return loadHandoff(key);
    }, new URL(importUrl).searchParams.get("handoff"));
    return {payload, importUrl};
  }

  function cell(page, r, c) {
    return page.locator(`.de-grid td[data-r="${r}"][data-c="${c}"]`);
  }

  test("Shows the paste prompt and loads pasted data", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-editor.html?host=${mockHost}`);
    await expect(page.locator(".de-empty")).toContainText("Paste data here");

    await pasteData(page, ".de-empty", "Name\tCity\nAcme\tParis\nGlobex\tLyon\n");

    await expect(page.locator(".de-grid thead th")).toHaveText(["#", "Name", "City"]);
    await expect(cell(page, 1, 1)).toHaveText("Lyon");
    await expect(page.locator(".de-stats")).toContainText("Rows: 2");
  });

  test("Edits a cell by typing, then undo and redo", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 2).click();
    await page.keyboard.type("Acme Corp");
    await page.keyboard.press("Enter");

    await expect(cell(page, 0, 2)).toHaveText("Acme Corp");
    await expect(cell(page, 0, 2)).toHaveClass(/de-dirty/);
    await expect(page.locator(".de-stats")).toContainText("edited: 1");
    // Enter moves the selection down
    await expect(cell(page, 1, 2)).toHaveClass(/de-active/);

    await page.keyboard.press("Control+z");
    await expect(cell(page, 0, 2)).toHaveText("Acme");
    await expect(page.locator(".de-stats")).toContainText("edited: 0");

    await page.keyboard.press("Control+y");
    await expect(cell(page, 0, 2)).toHaveText("Acme Corp");
  });

  test("Id and record type columns are read-only", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 1).dblclick();
    await expect(page.locator(".de-grid td input")).toHaveCount(0);
    await page.keyboard.type("x");
    await expect(cell(page, 0, 1)).toHaveText("001000000000001AAA");
  });

  test("Fills a selection with Ctrl+Enter and pastes a single value into a range", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 3).click();
    await cell(page, 2, 3).click({modifiers: ["Shift"]});
    await page.keyboard.type("Retail");
    await page.keyboard.press("Control+Enter");
    for (let r = 0; r < 3; r++) {
      await expect(cell(page, r, 3)).toHaveText("Retail");
    }
    await expect(page.locator(".de-stats")).toContainText("edited: 3");

    await pasteData(page, ".de-grid", "Media");
    for (let r = 0; r < 3; r++) {
      await expect(cell(page, r, 3)).toHaveText("Media");
    }
  });

  test("Adds and deletes rows, sorts and filters", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 2, 2).click();
    await page.getByRole("button", {name: "Row", exact: true}).click();
    await expect(page.locator(".de-stats")).toContainText("Rows: 4");
    await expect(page.locator(".de-stats")).toContainText("edited: 1");
    // New rows keep the record type so Data Import can detect the object
    await expect(cell(page, 3, 0)).toHaveText("[Account]");

    await page.getByRole("button", {name: "Delete rows"}).click();
    await expect(page.locator(".de-stats")).toContainText("Rows: 3");

    await page.locator(".de-grid thead th", {hasText: "Name"}).click();
    await page.locator(".de-grid thead th", {hasText: "Name"}).click();
    await expect(cell(page, 0, 2)).toHaveText("Initech");

    await page.getByPlaceholder("Filter rows").fill("glob");
    await expect(page.locator(".de-stats")).toContainText("Rows: 1 of 3");
    await expect(cell(page, 0, 2)).toHaveText("Globex");
  });

  test("Keeps changes hidden by the filter and pastes into an empty filtered view", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 3).click();
    await page.keyboard.type("Media");
    await page.keyboard.press("Enter");

    await page.getByPlaceholder("Filter rows").fill("glob");
    await expect(page.getByRole("button", {name: "Send to Data Import"})).toBeEnabled();

    await page.getByPlaceholder("Filter rows").fill("no match");
    await expect(page.locator(".de-stats")).toContainText("Rows: 0 of 3");
    await pasteData(page, ".de-grid", "x");
    await expect(page.locator(".de-stats")).toContainText("Rows: 1 of 4");

    // Undo/redo restores the pasted row where it was, even though it does not match the filter
    await page.keyboard.press("Control+z");
    await expect(page.locator(".de-stats")).toContainText("Rows: 0 of 3");
    await page.keyboard.press("Control+y");
    await expect(page.locator(".de-stats")).toContainText("Rows: 1 of 4");
  });

  test("Keeps an added row in place on undo and redo while sorted", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await page.locator(".de-grid thead th", {hasText: "Name"}).click();
    await cell(page, 0, 2).click();
    await page.getByRole("button", {name: "Row", exact: true}).click();
    const newRowNumber = page.locator(".de-grid tbody tr.de-new td.de-rownum");
    await expect(newRowNumber).toHaveText("2");

    await page.keyboard.press("Control+z");
    await expect(newRowNumber).toHaveCount(0);
    await page.keyboard.press("Control+y");
    await expect(newRowNumber).toHaveText("2");
  });

  test("Finds and replaces, skipping read-only columns", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 2).click();
    await page.keyboard.press("Control+h");
    await page.getByLabel("Find", {exact: true}).fill("a");
    await page.getByLabel("Replace with").fill("x");
    await page.getByRole("button", {name: "Replace all"}).click();
    // Case-insensitive, in all the rows; "[Account]" and the Ids are read-only
    await expect(page.locator(".de-replacebar")).toContainText("Replaced in 2 cells");
    await expect(cell(page, 0, 2)).toHaveText("xcme");
    await expect(cell(page, 1, 3)).toHaveText("Bxnking");
    await expect(cell(page, 0, 0)).toHaveText("[Account]");

    // Only in the selection when several cells are selected
    await cell(page, 0, 3).click();
    await cell(page, 1, 3).click({modifiers: ["Shift"]});
    await page.getByLabel("Find", {exact: true}).fill("n");
    await page.getByLabel("Replace with").fill("N");
    await page.keyboard.press("Enter");
    await expect(cell(page, 0, 3)).toHaveText("ENergy");
    await expect(cell(page, 2, 2)).toHaveText("Initech");

    // One undo per replace
    await page.getByRole("button", {name: "Undo (Ctrl+Z)"}).click();
    await page.getByRole("button", {name: "Undo (Ctrl+Z)"}).click();
    await expect(cell(page, 0, 2)).toHaveText("Acme");
    await expect(cell(page, 0, 3)).toHaveText("Energy");
  });

  test("Adds a column and sends it with the changes", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    // Only fields that can be written are accepted
    page.once("dialog", dialog => dialog.accept("Foo__c"));
    await page.getByRole("button", {name: "Column", exact: true}).click();
    await expect(page.getByRole("alert")).toContainText("Not a field of Account");

    page.once("dialog", dialog => dialog.accept("description"));
    await page.getByRole("button", {name: "Column", exact: true}).click();
    await expect(page.locator(".de-grid thead th").last()).toHaveText("Description");
    await expect(cell(page, 0, 4)).toHaveClass(/de-active/);

    await page.keyboard.type("Key account");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", {name: "Send to Data Import"})).toBeEnabled();

    // Undo the edit and the column
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect(page.locator(".de-grid thead th")).toHaveText(["#", "_", "Id", "Name", "Industry"]);
  });

  test("Greys out the columns that cannot be written", async ({page, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "Site", "CreatedDate", "Owner.Name"],
      rows: [
        ["[Account]", "001000000000001AAA", "Acme", "Paris", "2024-01-01T10:00:00.000+0000", "Ann"],
        ["[Account]", "001000000000002AAA", "Globex", "Lyon", "2024-01-02T10:00:00.000+0000", "Bob"],
      ]
    });

    await expect(cell(page, 0, 2)).not.toHaveClass(/de-locked/);
    await expect(cell(page, 0, 4)).toHaveClass(/de-locked/);
    await expect(cell(page, 0, 4)).toHaveAttribute("title", /Read-only field/);
    await expect(cell(page, 0, 5)).toHaveClass(/de-locked/);
    await expect(cell(page, 0, 5)).toHaveAttribute("title", /related record/);
    await expect(page.locator(".de-grid thead th", {hasText: "Owner.Name"})).toHaveClass(/de-locked/);

    await cell(page, 0, 5).click();
    await page.keyboard.type("x");
    await expect(cell(page, 0, 5)).toHaveText("Ann");

    // A create-only field is locked on existing rows, editable on new rows
    await expect(cell(page, 0, 3)).toHaveClass(/de-locked/);
    await cell(page, 1, 3).click();
    await page.getByRole("button", {name: "Row", exact: true}).click();
    await expect(cell(page, 2, 3)).not.toHaveClass(/de-locked/);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("Nice");
    await page.keyboard.press("Enter");
    await expect(cell(page, 2, 3)).toHaveText("Nice");
  });

  test("Warns about edited values that do not match the field type", async ({page, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "Industry", "NumberOfEmployees"],
      rows: [
        ["[Account]", "001000000000001AAA", "Acme", "Energy", "10"],
        ["[Account]", "001000000000002AAA", "Globex", "Banking", "20"],
      ]
    });

    const edit = async (r, c, value) => {
      await cell(page, r, c).click();
      await page.keyboard.press("F2");
      await page.keyboard.press("Control+a");
      await page.keyboard.type(value);
      await page.keyboard.press("Enter");
    };

    await edit(0, 4, "12k");
    await expect(cell(page, 0, 4)).toHaveClass(/de-warning/);
    await expect(cell(page, 0, 4)).toHaveAttribute("title", "Expected a whole number");
    await expect(cell(page, 0, 4).locator(".de-warning-icon")).toBeVisible();
    await expect(page.locator(".de-stats")).toContainText("Warning: 1");

    await edit(1, 3, "Retial");
    await expect(cell(page, 1, 3)).toHaveAttribute("title", "Not an active value of this picklist: Retial (accepted, the picklist is not restricted)");
    await edit(0, 2, "A name longer than twenty characters");
    await expect(cell(page, 0, 2)).toHaveAttribute("title", /Too long/);
    await cell(page, 1, 2).click();
    await page.keyboard.press("Delete");
    await expect(cell(page, 1, 2)).toHaveAttribute("title", "Required field");
    await expect(page.locator(".de-stats")).toContainText("Warning: 4");
    // The value bar explains the active cell
    await expect(page.locator(".de-cellnote")).toHaveText("Required field");

    await edit(0, 4, "12000");
    await expect(cell(page, 0, 4)).not.toHaveClass(/de-warning/);
    await expect(page.locator(".de-stats")).toContainText("Warning: 3");
  });

  test("Deletes columns and undoes it", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    await cell(page, 0, 3).click();
    await page.keyboard.type("Media");
    await page.keyboard.press("Enter");

    await page.locator(".de-grid thead th", {hasText: "Industry"}).click();
    await cell(page, 0, 2).click();
    await cell(page, 0, 3).click({modifiers: ["Shift"]});
    await page.getByRole("button", {name: "Delete columns"}).click();
    await expect(page.locator(".de-grid thead th")).toHaveText(["#", "_", "Id"]);

    // Undo restores the columns, their values and the sort
    await page.keyboard.press("Control+z");
    await expect(page.locator(".de-grid thead th")).toHaveText(["#", "_", "Id", "Name", "Industry▲"]);
    // Sorted by Industry: Banking, Media (the edited cell), then the empty value
    await expect(page.locator(".de-grid td.de-dirty")).toHaveText("Media");
    await expect(cell(page, 0, 3)).toHaveText("Banking");

    // The keys stay
    await cell(page, 0, 1).click();
    await page.getByRole("button", {name: "Delete columns"}).click();
    await expect(page.getByRole("alert")).toContainText("cannot be deleted");
    await expect(page.locator(".de-grid thead th")).toHaveCount(5);
  });

  test("Renders only the visible columns of a wide table", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-editor.html?host=${mockHost}`);
    const names = Array.from({length: 150}, (_, i) => "Field" + i + "__c");
    const values = names.map((_, i) => "value" + i);
    await pasteData(page, ".de-empty", names.join("\t") + "\n" + values.join("\t") + "\n");
    await expect(cell(page, 0, 0)).toHaveText("value0");

    expect(await page.locator(".de-grid thead th:not(.de-gap)").count()).toBeLessThan(60);
    await expect(cell(page, 0, 149)).toHaveCount(0);

    await cell(page, 0, 0).click();
    await page.keyboard.press("End");
    await expect(cell(page, 0, 149)).toHaveText("value149");
    await expect(cell(page, 0, 0)).toHaveCount(0);
  });

  test("Sends only the changes to Data Import", async ({page, context, extensionId}) => {
    test.slow();
    await openWithData(page, extensionId);

    await cell(page, 1, 3).click();
    await page.keyboard.type("Insurance");
    await page.keyboard.press("Enter");

    // Only the record type, the Id and the edited column are sent
    const {payload, importUrl} = await sentPayload(page, context, "Send to Data Import");
    expect(payload.text).toBe("\"_\"\t\"Id\"\t\"Industry\"\r\n\"[Account]\"\t\"001000000000002AAA\"\t\"Insurance\"");

    // Data Import loads the rows with Update preselected
    await page.goto(importUrl);
    await expect(page.locator("button:has-text('Run Update')")).toBeVisible();
  });

  test("Locks display values and sends read-only columns as skipped", async ({page, context, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "Industry", "Owner.Name"],
      rows: [["[Account]", "001000000000001AAA", "Acme", "Énergie", "Ann"]],
      query: "SELECT Id, Name, toLabel(Industry), Owner.Name FROM Account WHERE FORMAT(Name) != null"
    });

    await expect(cell(page, 0, 3)).toHaveClass(/de-locked/);
    await expect(cell(page, 0, 3)).toHaveAttribute("title", /Display value/);
    // Only the SELECT clause counts
    await expect(cell(page, 0, 2)).not.toHaveClass(/de-locked/);

    await page.getByText("Changes only").click();
    const {payload} = await sentPayload(page, context, "Send to Data Import");
    expect(payload.text.split("\r\n")[0]).toBe("\"_\"\t\"Id\"\t\"Name\"\t\"_Industry\"\t\"_Owner.Name\"");
  });

  test("Locks aggregate query results", async ({page, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Industry", "expr0"],
      rows: [["[AggregateResult]", "Energy", "5"]]
    });

    await expect(cell(page, 0, 2)).toHaveAttribute("title", "Aggregate query results cannot be imported");
    await page.getByText("Changes only").click();
    await expect(page.getByRole("button", {name: "Send to Data Import"})).toBeDisabled();
  });

  test("Unfocuses the selected cell when clicking outside or pressing Escape", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    // Select a cell
    await cell(page, 0, 2).click();
    await expect(cell(page, 0, 2)).toHaveClass(/de-active/);
    await expect(page.locator(".de-valuebar")).toBeVisible();
    await expect(page.locator(".de-valuebar input")).toBeEnabled();

    // Click outside on the footer
    await page.locator(".de-footer").click();
    await expect(cell(page, 0, 2)).not.toHaveClass(/de-active/);
    await expect(page.locator(".de-valuebar")).toBeVisible();
    await expect(page.locator(".de-valuebar input")).toBeDisabled();

    // Select again
    await cell(page, 1, 2).click();
    await expect(cell(page, 1, 2)).toHaveClass(/de-active/);
    await expect(page.locator(".de-valuebar input")).toBeEnabled();

    // Press Escape to unfocus
    await page.keyboard.press("Escape");
    await expect(cell(page, 1, 2)).not.toHaveClass(/de-active/);
    await expect(page.locator(".de-valuebar")).toBeVisible();
    await expect(page.locator(".de-valuebar input")).toBeDisabled();
  });

  test("Displays error banner when navigating without host parameter", async ({page, extensionId}) => {
    let unhandledErrors = [];
    page.on("pageerror", err => unhandledErrors.push(err.message));
    await page.goto(`chrome-extension://${extensionId}/data-editor.html`);
    await expect(page.getByRole("alert")).toContainText("No Salesforce organization specified");
    expect(unhandledErrors).toEqual([]);
  });

  test("Handles subquery columns with numbers and booleans safely during copy and export", async ({page, extensionId}) => {
    let unhandledErrors = [];
    page.on("pageerror", err => unhandledErrors.push(err.message));

    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "Contacts.totalSize", "Contacts.done"],
      rows: [
        ["[Account]", "001000000000001AAA", "Acme", 2, true],
        ["[Account]", "001000000000002AAA", "Globex", 0, false]
      ]
    });

    await expect(cell(page, 0, 3)).toHaveText("2");
    await expect(cell(page, 0, 4)).toHaveText("true");

    // Copy selection including numbers and booleans via keyboard (triggers onCopy -> selectionAsTsv)
    await cell(page, 0, 2).click();
    await cell(page, 1, 4).click({modifiers: ["Shift"]});
    await page.keyboard.press("Control+c");

    // Also verify Copy button (calls serialize)
    await page.getByRole("button", {name: "Copy", exact: true}).click();

    expect(unhandledErrors).toEqual([]);
  });

  test("Closes Find & Replace on Escape key even when focus is on a button or container", async ({page, extensionId}) => {
    await openWithData(page, extensionId);

    // Open Replace with Ctrl+H
    await cell(page, 0, 2).click();
    await page.keyboard.press("Control+h");
    await expect(page.locator(".de-replacebar")).toBeVisible();

    // Click "Replace all" button so focus is on button, not inside an input
    await page.getByLabel("Find", {exact: true}).fill("Acme");
    await page.getByRole("button", {name: "Replace all"}).click();
    await expect(page.locator(".de-replacebar")).toBeVisible();

    // Press Escape to dismiss replace bar
    await page.keyboard.press("Escape");
    await expect(page.locator(".de-replacebar")).toHaveCount(0);
  });

  test("Displays error banner gracefully when handoff key is missing or invalid", async ({page, extensionId}) => {
    let unhandledErrors = [];
    page.on("pageerror", err => unhandledErrors.push(err.message));

    // Non-existent handoff key
    await page.goto(`chrome-extension://${extensionId}/data-editor.html?host=${mockHost}&handoff=nonexistent-key-12345`);
    await expect(page.getByRole("alert")).toContainText("The data is no longer available");
    expect(unhandledErrors).toEqual([]);
  });

  test("Infers sobject from query when opening empty export result and sets type on new rows", async ({page, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "Industry"],
      rows: [],
      query: "SELECT Id, Name, Industry FROM Account WHERE Name = 'Empty'"
    });

    // The describe is loaded for Account and header shows type
    await expect(page.locator(".de-grid thead th").nth(3)).toHaveAttribute("title", /^Name \(string\)/);

    // Clicking "+ Row" adds a row with [Account] prefilled
    await page.getByRole("button", {name: "Row", exact: true}).click();
    await expect(cell(page, 0, 0)).toHaveText("[Account]");
    await expect(page.locator(".de-stats")).toContainText("Rows: 1");
  });

  test("Filters and sorts safely across mixed string, numeric, and boolean columns", async ({page, extensionId}) => {
    await openWithData(page, extensionId, {
      header: ["_", "Id", "Name", "NumberOfEmployees", "Contacts.done"],
      rows: [
        ["[Account]", "001000000000001AAA", "Acme", 50, true],
        ["[Account]", "001000000000002AAA", "Globex", 1500, false],
        ["[Account]", "001000000000003AAA", "Initech", 20, false]
      ]
    });

    // Filter by boolean text
    await page.getByPlaceholder("Filter rows").fill("true");
    await expect(page.locator(".de-stats")).toContainText("Rows: 1 of 3");
    await expect(cell(page, 0, 2)).toHaveText("Acme");

    // Clear filter
    await page.getByPlaceholder("Filter rows").fill("");
    await expect(page.locator(".de-stats")).toContainText("Rows: 3");

    // Sort by NumberOfEmployees
    await page.locator(".de-grid thead th", {hasText: "NumberOfEmployees"}).click();
    // Numeric collation: 20 < 50 < 1500
    await expect(cell(page, 0, 2)).toHaveText("Initech");
    await expect(cell(page, 1, 2)).toHaveText("Acme");
    await expect(cell(page, 2, 2)).toHaveText("Globex");
  });
});
