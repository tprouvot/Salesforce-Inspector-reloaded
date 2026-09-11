import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Data Export", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  // The Queries section shows one source at a time, picked with a radio button group.
  const selectQuerySource = (page, source) => page.locator(`label[for="sfir-query-source-${source}"]`).click();

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

  test("Query History Search", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id, Status FROM Case WHERE IsClosed = false", useToolingApi: false},
        {query: "SELECT Id, ClosedDate FROM Opportunity", useToolingApi: false},
        {query: "SELECT Id, Name FROM Account", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const history = page.getByRole("combobox", {name: "Search history"});
    const listbox = page.locator("#query-search-listbox");
    const options = listbox.locator("[role='option']");

    await history.click();
    await expect(options).toHaveCount(3);

    // Every term must match: "closed" hits two entries, "status closed" only one.
    await history.fill("closed");
    await expect(options).toHaveCount(2);
    await history.fill("status closed");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("FROM Case");

    // "?" is the only way to reach object filtering.
    await history.fill("?");
    await expect(options).toHaveText(["account", "case", "opportunity"]);
    await history.fill("?opp");
    await expect(options).toHaveText(["opportunity"]);
    // A trailing space commits the object and switches back to listing its queries.
    await history.fill("?opportunity ");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("ClosedDate");

    // Escape closes the dropdown even when nothing matched.
    await history.fill("zzz");
    await expect(options).toHaveCount(0);
    await expect(listbox).toContainText("No results found");
    await history.press("Escape");
    await expect(listbox).toHaveCount(0);
  });

  test("Saved Query Labels", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Open Cases:SELECT Id, Subject FROM Case", useToolingApi: false},
        {query: "SELECT Id FROM Case WHERE CreatedDate > 2026-01-01T00:00:00Z", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    const options = page.locator("#query-search-listbox [role='option']");

    await saved.click();
    await expect(options).toHaveCount(2);

    // "label:query" is split, and the label shown as a badge.
    const labelled = options.filter({hasText: "Open Cases"});
    await expect(labelled.locator(".slds-badge")).toHaveText("Open Cases");

    // A colon inside a query (here a datetime literal) is not a label.
    await expect(options.filter({hasText: "2026-01-01"}).locator(".slds-badge")).toHaveCount(0);

    // Selecting restores the query without its label, and the label input with it.
    await labelled.click();
    await expect(page.locator("textarea#query")).toHaveValue("SELECT Id, Subject FROM Case");
    await expect(page.getByLabel("Save as")).toHaveValue("Open Cases");
  });

  test("Delete Query History Entries", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        // A long query, so the dropdown reaches its maximum width. A narrow one
        // would not catch the dropdown being positioned off the window edge.
        {query: "SELECT AllManagedPackageMemberId, AnalyticsWorkspaceId, CreatedById, CreatedDate, Description, DeveloperName, Id, IsDeleted, Language, LastDraftModifiedDate, LastModifiedById, ManageableState, MasterLabel, ModuleNamespace, NamespacePrefix, OwnerId, Style, SystemModstamp, Version FROM AnalyticsDashboard", useToolingApi: false},
        {query: "SELECT Id, Name FROM Account", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const history = page.getByRole("combobox", {name: "Search history"});
    const options = page.locator("#query-search-listbox [role='option']");
    const query = page.locator("textarea#query");

    // The dropdown must stay inside the window, otherwise the query text is clipped
    // and the trash icon lands off screen where it cannot be clicked at all.
    await history.click();
    const listbox = await page.locator("#query-search-listbox").boundingBox();
    const viewport = page.viewportSize();
    expect(listbox.x, "left edge on screen").toBeGreaterThanOrEqual(0);
    expect(listbox.x + listbox.width, "right edge on screen").toBeLessThanOrEqual(viewport.width);

    // Clicking the trash icon deletes without also selecting the entry.
    // The page pre-fills the query box from history, so compare against a sentinel.
    await query.fill("SENTINEL");
    await history.click();
    await options.first().locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(1);
    await expect(query).toHaveValue("SENTINEL");

    // Delete removes the highlighted entry, no confirmation for history.
    await history.press("ArrowDown");
    await history.press("Delete");
    await expect(options).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextQueryHistory")))).toHaveLength(0);
  });

  test("Delete Saved Query Asks For Confirmation", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Mine:SELECT Id FROM Account", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    const options = page.locator("#query-search-listbox [role='option']");
    await saved.click();

    // Dismissing keeps the entry, accepting removes it.
    page.once("dialog", dialog => dialog.dismiss());
    await options.first().locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(1);

    page.once("dialog", dialog => dialog.accept());
    await options.first().locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(0);
  });

  test("Query Source Switch Keeps Layout Stable", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const geometry = () => page.evaluate(() => {
      const box = (selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return Math.round(rect.x) + "x" + Math.round(rect.width);
      };
      return {
        picker: box(".slds-radio_button-group"),
        search: box(".slds-combobox__input"),
        browse: box(".sfir-query-section__browse"),
        save: box(".sfir-query-section__save"),
        section: box(".sfir-query-section")
      };
    });

    await selectQuerySource(page, "history");
    const stable = await geometry();

    // Switching source must not shift the controls out from under the pointer,
    // so the actions beside the picker are deliberately source independent.
    for (const source of ["saved", "templates"]) {
      await selectQuerySource(page, source);
      expect(await geometry(), `layout moved on ${source}`).toEqual(stable);
    }

    // The picker is a real radio group, so arrow keys select as well as clicks.
    await page.locator("#sfir-query-source-history").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("combobox", {name: "Search saved"})).toBeVisible();

    // DOM and visual order agree: the top-row toggles precede the second-row Queries controls.
    expect(await page.evaluate(() => {
      const toggle = document.querySelector("[name='checkbox-toggle-tooling']");
      const querySource = document.getElementById("sfir-query-source-history");
      return Boolean(toggle.compareDocumentPosition(querySource) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
  });

  test("Clear Selected Query Source", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id FROM Account", useToolingApi: false}
      ]));
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Saved:SELECT Id FROM Contact", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const clearList = page.locator(".sfir-query-clear");
    await expect(clearList).toBeEnabled();
    await expect(clearList).toHaveText("Clear list");
    await expect(clearList).toHaveAccessibleName("Clear list of query history");
    await expect(clearList).toHaveAttribute("title", "Clear Query History");
    page.once("dialog", dialog => dialog.accept());
    await clearList.click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextQueryHistory")) || [])).toHaveLength(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")))).toHaveLength(1);
    await expect(clearList).toBeDisabled();
    await expect(page.locator("#sfir-query-source-history")).toBeFocused();

    await selectQuerySource(page, "saved");
    await expect(clearList).toBeEnabled();
    await expect(clearList).toHaveAccessibleName("Clear list of saved queries");
    await expect(clearList).toHaveAttribute("title", "Clear Saved Queries");
    page.once("dialog", dialog => dialog.accept());
    await clearList.click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")) || [])).toHaveLength(0);
    await expect(clearList).toBeDisabled();
    await expect(page.locator("#sfir-query-source-saved")).toBeFocused();

    await selectQuerySource(page, "templates");
    await expect(clearList).toBeDisabled();
    await expect(clearList).toHaveAccessibleName("Clear list");
    await expect(clearList).toHaveAttribute("title", "Clear list");
  });

  test("Empty Editor Cannot Be Saved", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem("insextSavedQueryHistory");
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await page.locator("textarea#query").fill("");
    await page.getByLabel("Save as").fill("Only a label");
    const save = page.getByRole("button", {name: "Save Query"});
    await expect(save).toBeDisabled();

    // Bypass the DOM-disabled state to prove the model guard also rejects it.
    await save.evaluate(button => {
      button.disabled = false;
      button.click();
    });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")) || [])).toHaveLength(0);
  });

  for (const width of [800, 1024, 1280]) {
    test(`Queries Section Fits At ${width}px`, async ({page, extensionId}) => {
      await page.setViewportSize({width, height: 760});
      await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
      await page.waitForSelector("textarea#query", {timeout: 2000});

      const section = page.locator(".sfir-query-section");
      const bounds = await section.boundingBox();
      expect(bounds.x, "left edge on screen").toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, "right edge on screen").toBeLessThanOrEqual(width);
      expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth), "section content does not overflow").toBe(true);

      const heading = await page.getByRole("heading", {name: "Export Query"}).boundingBox();
      expect(bounds.y, "Queries section occupies the second row").toBeGreaterThan(heading.y);

      const browse = await page.locator(".sfir-query-section__browse").boundingBox();
      const save = await page.locator(".sfir-query-section__save").boundingBox();
      if (width <= 1024) {
        expect(save.y, "save group wraps as a unit").toBeGreaterThan(browse.y);
      } else {
        expect(Math.abs(save.y - browse.y), "groups remain on one row").toBeLessThan(2);
      }
    });
  }

  test("Templates Source Loads A Template", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "templates");
    const search = page.getByRole("combobox", {name: "Search templates"});
    const options = page.locator("#query-search-listbox [role='option']");

    await search.click();
    await expect(options.first()).toContainText("SELECT Id FROM");

    // Templates are configuration, so they offer no per-entry delete.
    await expect(options.first().locator(".sfir-combobox-delete")).toHaveCount(0);

    await options.first().click();
    await expect(page.locator("textarea#query")).toHaveValue("SELECT Id FROM ");
  });

  test("Result Column Filter Stays Open", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await page.locator("textarea#query").fill("SELECT Id, Name, Type FROM Account");
    await page.click("button:has-text('Run Export')");
    await expect(page.locator(".result-status")).toContainText("Exported", {timeout: 2000});

    await page.click("button[title='Show More Filters']");
    const menu = page.locator(".dropdown-menu");
    await expect(menu).toBeVisible();

    // Two consecutive column selections must both register with the panel still open.
    await menu.locator(".dropdown-item").nth(0).click();
    await expect(menu).toBeVisible();
    await menu.locator(".dropdown-item").nth(1).click();
    await expect(menu).toBeVisible();
    await expect(menu.locator(".dropdown-item.selected")).toHaveCount(2);
  });

});
