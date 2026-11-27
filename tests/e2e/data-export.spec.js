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
    const suggestions = page.locator(".autocomplete-results");
    const header = page.locator(".autocomplete-header");

    // On initial load (before interacting with the query editor), field suggestion pills stay
    // hidden so they do not shrink the result table, while object Field Info is still resolved.
    await expect(suggestions).toHaveCount(0);
    await expect(header).not.toContainText("suggestions");
    await expect(page.locator("a", {hasText: "Account Field Info"})).toBeVisible();

    // 1. Object Autocomplete
    await queryInput.fill("SELECT Id FROM Acc");
    await expect(page.locator(".autocomplete-box")).toBeVisible();
    await expect(suggestions).toContainText("Account");

    // Click suggestion - target the link element specifically with title="Account"
    await page.locator(".autocomplete-results a[title='Account']").first().click();

    // Autocomplete adds a trailing space
    await expect(queryInput).toHaveValue("SELECT Id FROM Account ");

    // 2. Field Autocomplete
    await queryInput.fill("SELECT Id, Nam FROM Account");
    await page.evaluate(() => {
      const el = document.querySelector("textarea#query");
      el.selectionStart = 14;
      el.selectionEnd = 14;
      el.dispatchEvent(new Event("input", {bubbles: true}));
    });

    // Now wait for field suggestions
    await expect(header).toContainText("Account fields suggestions");
    await expect(suggestions).toContainText("Name");
    await page.locator(".autocomplete-results a").filter({hasText: "Name"}).first().click();
    await expect(queryInput).toHaveValue("SELECT Id, Name FROM Account");

    // Clicking outside the editor/autocomplete collapses suggestions; clicking back in #query restores them.
    await page.getByRole("heading", {name: "Export Query"}).click();
    await expect(suggestions).toHaveCount(0);
    await expect(header).not.toContainText("suggestions");

    await queryInput.click();
    await expect(suggestions).toBeVisible();

    // Running Export collapses suggestions so the result table gets full vertical space.
    await page.click("button:has-text('Run Export')");
    await expect(suggestions).toHaveCount(0);

    // Switching tabs keeps suggestions collapsed and updates the Field Info button to the active tab's object.
    await queryInput.click();
    await expect(suggestions).toBeVisible();
    await page.locator(".add-tab-button").click();
    await expect(suggestions).toHaveCount(0);
    await queryInput.fill("SELECT Id FROM Contact LIMIT 1");
    await expect(page.locator("a", {hasText: "Contact Field Info"})).toBeVisible();
    await page.locator(".query-tab").first().click();
    await expect(suggestions).toHaveCount(0);
    await expect(page.locator("a", {hasText: "Account Field Info"})).toBeVisible();
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

  test("Query Editor Uses SOQL, SOSL and GraphQL Colouring", async ({page, context, extensionId}) => {
    // The editor opens on the latest history entry, so this checks the colouring on load,
    // before anything is typed.
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id, Status FROM Case ORDER BY Type", useToolingApi: false}
      ]));
    });
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // Objects get their own token and field names that clash with SQL keywords stay plain.
    const query = page.locator("textarea#query");
    await expect(query).toHaveValue("SELECT Id, Status FROM Case ORDER BY Type");
    const highlight = page.locator(".query-highlight");
    await expect(highlight.locator(".token.sobject")).toHaveText("Case");
    await expect(highlight.locator(".token.keyword")).toHaveText(["SELECT", "FROM", "ORDER BY"]);

    // Metadata is a field outside WITH METADATA, and a SOQL function after "), " is
    // not a further object the way it is in SOSL RETURNING.
    await query.fill("SELECT Metadata, toLabel(Status), convertCurrency(Amount) FROM Opportunity");
    await expect(highlight.locator(".token.sobject")).toHaveText(["Opportunity"]);
    await expect(highlight.locator(".token.keyword")).toHaveText(["SELECT", "toLabel", "convertCurrency", "FROM"]);

    await query.fill("FIND {Acme} IN ALL FIELDS RETURNING Account(Id), Contact(Id)");
    await expect(highlight.locator(".token.sobject")).toHaveText(["Account", "Contact"]);

    // A query starting with "{" is sent to the GraphQL endpoint, so it uses the GraphQL grammar, not SQL's
    await query.fill("{\n\tuiapi {\n\t\tquery {\n\t\t\tContact {\n\t\t\t\tedges {\n\t\t\t\t\tnode {\n\t\t\t\t\t\tId\n\t\t\t\t\t\tName { value }\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}");
    await expect(highlight.locator(".token.keyword")).toHaveText(["query"]);
    await expect(highlight.locator(".token.property")).toHaveText(["Id", "value"]);
    await expect(highlight.locator(".token.sobject")).toHaveCount(0);

    // A full operation, as in the Salesforce GraphQL examples, is GraphQL too
    await query.fill("query accounts {\n\tuiapi {\n\t\tquery {\n\t\t\tAccount {\n\t\t\t\tedges {\n\t\t\t\t\tnode {\n\t\t\t\t\t\tId\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t}\n}");
    await expect(highlight.locator(".token.keyword")).toHaveText(["query", "query"]);
    await expect(highlight.locator(".token.property")).toHaveText(["Id"]);
  });

  test("Execute GraphQL Export, shorthand and full operation", async ({page, context, extensionId}) => {
    const sentQueries = [];
    // Registered after the generic mock, so it takes precedence for the GraphQL endpoint (requests carry a "?cache=" parameter)
    await context.route(new RegExp(`/services/data/v${apiVersion}/graphql(\\?|$)`), async route => {
      sentQueries.push(route.request().postDataJSON().query);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({data: {uiapi: {query: {Account: {edges: [{node: {Id: "001000000000001AAA", Name: {value: "Acme"}}}]}}}}, errors: []})
      });
    });
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    const selection = "uiapi { query { Account { edges { node { Id Name { value } } } } } }";
    const queries = [
      // Query template shorthand: the extension adds the operation name
      {typed: `{ ${selection} }`, sent: `query objects { ${selection} }`},
      // Salesforce documentation example: sent unchanged
      {typed: `query accounts { ${selection} }`, sent: `query accounts { ${selection} }`}
    ];
    for (const {typed, sent} of queries) {
      await page.locator("textarea#query").fill(typed);
      await page.click("button:has-text('Run Export')");

      await expect(page.locator(".result-status")).toContainText("Exported 1 record", {timeout: 2000});
      await expect(page.locator("#result-area table tr").nth(1).locator("td").nth(2)).toHaveText("Acme");
      expect(sentQueries.at(-1)).toBe(sent);
    }
    expect(sentQueries).toHaveLength(2);
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

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const listbox = page.locator("#query-search-listbox");
    const options = listbox.locator("[role='option']");

    await history.click();
    await expect(options).toHaveCount(3);
    // Query colouring comes from the Prism SQL grammar bundled with the extension.
    await expect(options.first().locator(".token.keyword").first()).toHaveText("SELECT");
    // SOQL object names override conflicting SQL keywords such as CASE.
    await expect(options.first().locator(".token.sobject")).toHaveText("Case");

    // Strong matches rank before forgiving partial matches.
    await history.fill("closed");
    await expect(options).toHaveCount(2);
    await history.fill("status closed");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("FROM Case");
    await expect(options.first().locator(".sfir-search-match")).toHaveText(["Status", "Closed"]);

    // Partial matching is a fallback only when no query contains every term.
    await history.fill("status opportunity");
    await expect(options).toHaveCount(2);
    await expect(options.first()).toContainText("FROM Case");
    await expect(options.nth(1)).toContainText("Opportunity");

    // Field names that clash with SQL keywords keep the plain identifier colour.
    await expect(options.first().locator(".token.keyword")).toHaveText(["SELECT", "FROM", "WHERE"]);

    // "?" is the only way to reach object filtering.
    await history.fill("?");
    await expect(options).toHaveText(["account", "case", "opportunity"]);
    await history.fill("?opp");
    await expect(options).toHaveText(["opportunity"]);
    await expect(options.locator(".sfir-search-match")).toHaveText("opp");
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

  test("Object Filter Lists Only Queried Objects", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        // A subquery FROM target is a child relationship, not an object.
        {query: "SELECT Id, (SELECT Id FROM Contacts) FROM Account", useToolingApi: false},
        // "from office" sits inside a string literal and must not count.
        {query: "SELECT Id FROM Case WHERE Subject = 'mail from office'", useToolingApi: false},
        // SOSL names its objects after RETURNING instead of FROM; a function inside
        // the field list is not an object.
        {query: "FIND {Acme} IN ALL FIELDS RETURNING Lead(Id), Opportunity(Id, toLabel(StageName))", useToolingApi: false},
        // A function after a comma must not hide the FROM object that follows it.
        {query: "SELECT Name, COUNT(Id) FROM Campaign GROUP BY Name", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const options = page.locator("#query-search-listbox [role='option']");

    await history.fill("?");
    await expect(options).toHaveText(["account", "campaign", "case", "lead", "opportunity"]);

    // Selecting a SOSL object still finds the query that returns it.
    await history.fill("?opportunity ");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("RETURNING");
  });

  test("Search Highlights Across Prism Tokens", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id, Account.Name FROM Contact WHERE CreatedDate > 2026-01-01T00:00:00Z", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const matches = page.locator("#query-search-listbox .sfir-search-match");

    // Prism splits dotted fields and dates into several tokens; highlighting ranges
    // are computed against the full query so the visible fragments still join up.
    await history.fill("account.name");
    expect((await matches.allTextContents()).join("")).toBe("Account.Name");

    await history.fill("2026-01-01");
    expect((await matches.allTextContents()).join("")).toBe("2026-01-01");
  });

  test("Query History Dropdown Scrolls", async ({page, context, extensionId}) => {
    await page.setViewportSize({width: 800, height: 760});
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify(
        Array.from({length: 40}, (_, i) => ({
          query: i === 0
            ? `SELECT ${"Name, ".repeat(80)}Id FROM Account`
            : `SELECT Id, Name, CreatedDate FROM Account WHERE Name LIKE 'Account ${i}%' ORDER BY CreatedDate DESC`,
          useToolingApi: false
        }))
      ));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const listbox = page.locator("#query-search-listbox");
    await history.click();
    const options = listbox.locator("[role='option']");
    const queryText = options.first().locator(".sfir-query-text");
    const queryStyle = await queryText.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        marginBottom: style.marginBottom,
        padding: style.padding,
        lineClamp: style.webkitLineClamp
      };
    });
    expect(queryStyle).toEqual({marginBottom: "0px", padding: "0px", lineClamp: "2"});
    await expect(queryText).toHaveAttribute("title", `SELECT ${"Name, ".repeat(80)}Id FROM Account`);

    const firstOption = await options.first().boundingBox();
    expect(firstOption.height, "long queries clamp to at most two lines").toBeLessThan(60);
    const secondOption = await options.nth(1).boundingBox();
    expect(Math.abs(secondOption.y - firstOption.y - firstOption.height), "option hover boxes are flush").toBeLessThan(1);
    const initialBounds = await listbox.boundingBox();
    expect(initialBounds.x, "left edge on screen").toBeGreaterThanOrEqual(0);
    expect(initialBounds.x + initialBounds.width, "right edge on screen").toBeLessThanOrEqual(800);

    const deleteIcon = await options.first().locator(".sfir-combobox-delete").boundingBox();
    const deleteCenter = deleteIcon.y + (deleteIcon.height / 2);
    const optionCenter = firstOption.y + (firstOption.height / 2);
    expect(
      Math.abs(deleteCenter - optionCenter),
      "delete icon is vertically centred"
    ).toBeLessThan(2);

    const metrics = await listbox.evaluate(element => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
    expect(metrics.clientHeight, "native dropdown has a bounded scroll area").toBeLessThanOrEqual(320);

    const bounds = await listbox.boundingBox();
    await page.mouse.move(bounds.x + (bounds.width / 2), bounds.y + (bounds.height / 2));
    await page.mouse.wheel(0, 500);
    await expect.poll(() => listbox.evaluate(element => element.scrollTop)).toBeGreaterThan(0);

    // Keyboard navigation also keeps the active option inside the native scroll area.
    await listbox.evaluate(element => { element.scrollTop = 0; });
    await history.focus();
    for (let i = 0; i < 12; i++) {
      await history.press("ArrowDown");
    }
    await expect.poll(() => listbox.evaluate(element => element.scrollTop)).toBeGreaterThan(0);

    // The resize handle must resize instead of selecting the entry, and its height
    // survives a reload while remaining inside the viewport.
    const query = page.locator("textarea#query");
    await query.fill("SENTINEL");
    const originalBounds = await listbox.boundingBox();
    await page.mouse.move(originalBounds.x + originalBounds.width - 2, originalBounds.y + originalBounds.height - 2);
    await page.mouse.down();
    await page.mouse.move(originalBounds.x + originalBounds.width - 2, originalBounds.y + originalBounds.height + 78, {steps: 5});
    await page.mouse.up();
    const resizedBounds = await listbox.boundingBox();
    expect(resizedBounds.height).toBeGreaterThan(originalBounds.height + 50);
    await expect(query).toHaveValue("SENTINEL");
    await expect.poll(() => page.evaluate(
      () => localStorage.getItem("sfirComboboxHeight_query-search")
    )).not.toBeNull();
    const storedHeight = await page.evaluate(() => localStorage.getItem("sfirComboboxHeight_query-search"));

    await page.reload();
    await page.waitForSelector("textarea#query", {timeout: 2000});
    await selectQuerySource(page, "history");
    await history.click();
    const restoredBounds = await listbox.boundingBox();
    expect(Math.abs(restoredBounds.height - resizedBounds.height), "resized height is restored").toBeLessThan(2);

    // Ordinary clicks in the bottom padding keep focus and do not overwrite the preference.
    await page.mouse.click(restoredBounds.x + (restoredBounds.width / 2), restoredBounds.y + restoredBounds.height - 2);
    await expect(history).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem("sfirComboboxHeight_query-search"))).toBe(storedHeight);

    const shortenedViewportHeight = Math.ceil(restoredBounds.y + restoredBounds.height - 50);
    await page.setViewportSize({width: 800, height: shortenedViewportHeight});
    await page.reload();
    await page.waitForSelector("textarea#query", {timeout: 2000});
    await selectQuerySource(page, "history");
    await history.click();
    const clampedBounds = await listbox.boundingBox();
    expect(clampedBounds.y + clampedBounds.height).toBeLessThanOrEqual(shortenedViewportHeight);
    expect(clampedBounds.height).toBeLessThan(restoredBounds.height);
    expect(await page.evaluate(() => localStorage.getItem("sfirComboboxHeight_query-search"))).toBe(storedHeight);
    await page.mouse.click(clampedBounds.x + clampedBounds.width - 2, clampedBounds.y + clampedBounds.height - 2);
    expect(await page.evaluate(() => localStorage.getItem("sfirComboboxHeight_query-search"))).toBe(storedHeight);

    await page.setViewportSize({width: 800, height: 760});
    await page.reload();
    await page.waitForSelector("textarea#query", {timeout: 2000});
    await selectQuerySource(page, "history");
    await history.click();
    expect(Math.abs((await listbox.boundingBox()).height - resizedBounds.height), "clicking the resize corner preserves the preferred height").toBeLessThan(2);

    // Filtering down to one entry shrinks the dropdown to fit its content instead of
    // leaving blank space from the stored maxHeight, and has no extra bottom gap.
    await history.fill("Account 19");
    await expect(options).toHaveCount(1);
    const singleBounds = await listbox.boundingBox();
    const singleOptionBounds = await options.first().boundingBox();
    expect(singleBounds.height, "short list hugs its content").toBeLessThan(80);
    expect(
      (singleBounds.y + singleBounds.height) - (singleOptionBounds.y + singleOptionBounds.height),
      "no extra bottom spacing after the last entry"
    ).toBeLessThanOrEqual(6);

    // Empty-state interaction retains focus, while the native scrollbar remains on
    // the outer div and is not covered by this mousedown handler.
    await history.fill("no query matches this");
    await page.getByText("No results found").click();
    await expect(history).toBeFocused();

    const emptyBounds = await listbox.boundingBox();
    await page.mouse.click(emptyBounds.x + (emptyBounds.width / 2), emptyBounds.y + 2);
    await expect(history).toBeFocused();
  });

  test("Saved Query Labels", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Open Cases:SELECT Id, Subject FROM Case", useToolingApi: false},
        {query: "SELECT Id FROM Case WHERE CreatedDate > 2026-01-01T00:00:00Z", useToolingApi: false},
        // A label may start with a query keyword.
        {query: "Find duplicates:SELECT Id FROM Contact", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    const options = page.locator("#query-search-listbox [role='option']");

    await saved.click();
    await expect(options).toHaveCount(3);
    await expect(options.filter({hasText: "FROM Contact"}).locator(".slds-badge")).toHaveText("Find duplicates");

    // "label:query" is split, and the label shown as a badge.
    await saved.fill("open");
    const labelled = options.filter({hasText: "Open Cases"});
    await expect(options).toHaveCount(1);
    await expect(labelled.locator(".slds-badge")).toHaveText("Open Cases");
    await expect(labelled.locator(".slds-badge .sfir-search-match")).toHaveText("Open");

    // A colon inside a query (here a datetime literal) is not a label.
    await saved.fill("");
    const datetimeQuery = options.filter({hasText: "2026-01-01"});
    await expect(datetimeQuery).toHaveCount(1);
    await expect(datetimeQuery.locator(".slds-badge")).toHaveCount(0);

    // Selecting restores the query without its label, and pre-fills the Save Query modal label.
    await labelled.click();
    await expect(page.locator("textarea#query")).toHaveValue("SELECT Id, Subject FROM Case");
    await page.getByRole("button", {name: "Save Query"}).click();
    await expect(page.getByLabel("Label (optional)")).toHaveValue("Open Cases");
    await page.getByRole("button", {name: "Cancel", exact: true}).click();

    await saved.fill("2026");
    await options.click();
    await page.getByRole("button", {name: "Save Query"}).click();
    await expect(page.getByLabel("Label (optional)")).toHaveValue("");
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
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

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const options = page.locator("#query-search-listbox [role='option']");
    const query = page.locator("textarea#query");

    // The dropdown must stay inside the window, otherwise the query text is clipped
    // and the trash icon lands off screen where it cannot be clicked at all.
    await history.click();
    await expect(options.first().locator(".sfir-combobox-delete")).toHaveClass(/slds-button_icon/);
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

  test("All Scope Groups Sources, Filters Objects And Preserves Delete Rules", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id, Name FROM Account", useToolingApi: false}
      ]));
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Pinned:SELECT Id, Subject FROM Case", useToolingApi: false}
      ]));
      window.localStorage.setItem("queryTemplates", "SELECT Id FROM Opportunity//SELECT Id FROM WHERE");
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // All is selected by default, and no inline Clear button clutters the toolbar.
    const searchAll = page.getByRole("combobox", {name: "Search all"});
    const listbox = page.locator("#query-search-listbox");
    const options = listbox.locator("[role='option']");
    await expect(page.locator("#sfir-query-source-all")).toBeChecked();
    await expect(page.locator(".sfir-query-toolbar button", {hasText: "Clear"})).toHaveCount(0);

    await searchAll.click();
    await expect(listbox.locator(".slds-listbox__option-header")).toHaveText(["History", "Saved", "Templates"]);
    await expect(options).toHaveCount(4);

    // History and Saved entries show delete affordances; Templates do not.
    await expect(options.nth(0).locator(".sfir-combobox-delete")).toHaveCount(1);
    await expect(options.nth(1).locator(".sfir-combobox-delete")).toHaveCount(1);
    await expect(options.nth(2).locator(".sfir-combobox-delete")).toHaveCount(0);

    // Saved asks for confirmation; History deletes immediately.
    page.once("dialog", dialog => dialog.dismiss());
    await options.nth(1).locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(4);

    await options.nth(0).locator(".sfir-combobox-delete").click();
    await expect(options).toHaveCount(3);
    await expect(listbox.locator(".slds-listbox__option-header")).toHaveText(["Saved", "Templates"]);

    // "?" unions objects across remaining sources (Case from Saved + Opportunity from Templates),
    // and short suggestion items still match at least the search input width while staying left-aligned.
    await searchAll.fill("?");
    await expect(options).toHaveText(["case", "opportunity"]);
    const inputBounds = await searchAll.boundingBox();
    const suggestListboxBounds = await listbox.boundingBox();
    expect(Math.abs(suggestListboxBounds.x - inputBounds.x), "dropdown left-aligns with the search input").toBeLessThan(2);
    expect(suggestListboxBounds.width, "short suggestions never shrink narrower than the input").toBeGreaterThanOrEqual(inputBounds.width - 1);
    await searchAll.fill("?opportunity ");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toContainText("FROM Opportunity");
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
        toolbar: box(".sfir-query-toolbar")
      };
    });

    const stable = await geometry();

    // Switching source must not shift the controls out from under the pointer,
    // so the actions beside the picker are deliberately source independent.
    for (const source of ["history", "saved", "templates", "all"]) {
      await selectQuerySource(page, source);
      expect(await geometry(), `layout moved on ${source}`).toEqual(stable);
    }

    // The picker is a real radio group, so arrow keys select as well as clicks.
    await page.locator("#sfir-query-source-all").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("combobox", {name: "Search history"})).toBeVisible();

    // DOM and visual order agree: the inline Queries controls precede the right-side toggles.
    expect(await page.evaluate(() => {
      const toggle = document.querySelector("[name='checkbox-toggle-tooling']");
      const querySource = document.getElementById("sfir-query-source-all");
      return Boolean(querySource.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);

    // The widened search input is roomy enough for multi-word queries.
    const searchBox = await page.locator(".sfir-query-search").boundingBox();
    expect(searchBox.width, "search input is widened").toBeGreaterThanOrEqual(220);
  });

  test("Empty Editor Cannot Be Saved", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem("insextSavedQueryHistory");
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await page.locator("textarea#query").fill("");
    const save = page.getByRole("button", {name: "Save Query"});
    await expect(save).toBeDisabled();

    // Bypass the DOM-disabled state to prove the guard also rejects opening/saving an empty query.
    await save.evaluate(button => {
      button.disabled = false;
      button.click();
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")) || [])).toHaveLength(0);
  });

  test("Discarded Saved Query Does Not Show Success", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("numberOfQueriesSaved", "1");
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "Alpha:SELECT Id FROM Account", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await page.locator("textarea#query").fill("SELECT Id FROM Contact");
    await page.getByRole("button", {name: "Save Query"}).click();
    await page.getByLabel("Label (optional)").fill("Zulu");
    await page.getByRole("dialog").getByRole("button", {name: "Save"}).click();

    await expect(page.locator(".slds-notify_toast")).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")))).toEqual([
      {query: "Alpha:SELECT Id FROM Account", useToolingApi: false}
    ]);
  });

  test("Saving A Query Confirms Via Modal And Resets Label", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.removeItem("insextSavedQueryHistory");
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // Save Query sits immediately after Run Export on the action row.
    const runExportBox = await page.getByRole("button", {name: "Run Export"}).boundingBox();
    const saveQueryBox = await page.getByRole("button", {name: "Save Query"}).boundingBox();
    expect(Math.abs(saveQueryBox.y - runExportBox.y), "Save Query is on the Run Export row").toBeLessThan(2);
    expect(saveQueryBox.x, "Save Query follows Run Export").toBeGreaterThan(runExportBox.x);

    const query = page.locator("textarea#query");
    await query.fill("SELECT Id FROM Account");

    // Escape dismisses the modal without saving.
    await page.getByRole("button", {name: "Save Query"}).click();
    const modal = page.getByRole("dialog");
    const labelInput = modal.getByLabel("Label (optional)");
    await expect(labelInput).toBeFocused();
    await labelInput.fill("Dismissed");
    await labelInput.press("Escape");
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")) || [])).toHaveLength(0);

    // Pressing Enter inside the modal saves with the optional label and shows a toast.
    await page.getByRole("button", {name: "Save Query"}).click();
    await expect(labelInput).toHaveValue("");
    await labelInput.fill("Accounts");
    await labelInput.press("Enter");
    await expect(modal).toHaveCount(0);

    const toast = page.locator(".slds-notify_toast[role='status']");
    await expect(toast.getByRole("heading", {name: "Saved"})).toBeVisible();
    await expect(toast).toContainText("Query saved successfully.");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory"))[0].query)).toBe("Accounts:SELECT Id FROM Account");
    await expect(toast).toHaveCount(0, {timeout: 3000});

    // Loading the saved query pre-fills its label on Save Query, while switching tabs clears it.
    await selectQuerySource(page, "saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    await saved.click();
    await page.locator("#query-search-listbox [role='option']").click();
    await page.getByRole("button", {name: "Save Query"}).click();
    await expect(labelInput).toHaveValue("Accounts");
    await page.getByRole("button", {name: "Cancel", exact: true}).click();

    await page.locator(".add-tab-button").click();
    await query.fill("SELECT Id FROM Contact");
    await page.getByRole("button", {name: "Save Query"}).click();
    await expect(labelInput).toHaveValue("");
    await modal.getByRole("button", {name: "Save"}).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("insextSavedQueryHistory")).map(e => e.query))).toContain("SELECT Id FROM Contact");
  });

  for (const width of [800, 1024, 1280, 1440]) {
    test(`Queries Toolbar Fits At ${width}px`, async ({page, extensionId}) => {
      await page.setViewportSize({width, height: 760});
      await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
      await page.waitForSelector("textarea#query", {timeout: 2000});

      const toolbar = page.locator(".sfir-query-toolbar");
      const bounds = await toolbar.boundingBox();
      expect(bounds.x, "left edge on screen").toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, "right edge on screen").toBeLessThanOrEqual(width);
      expect(await toolbar.evaluate(element => element.scrollWidth <= element.clientWidth), "toolbar content does not overflow").toBe(true);

      // "Deleted/Archived Records" text must remain on a single row, matching "Tooling API".
      const deletedLabel = await page.locator(".sfir-inline-toggle .slds-form-element__label", {hasText: "Deleted/Archived Records"}).boundingBox();
      const toolingLabel = await page.locator(".sfir-inline-toggle .slds-form-element__label", {hasText: "Tooling API"}).boundingBox();
      expect(deletedLabel.height, "Deleted/Archived Records stays on one line").toBeLessThanOrEqual(24);
      expect(Math.abs(deletedLabel.height - toolingLabel.height), "toggle labels have identical single-line height").toBeLessThan(2);

      const heading = await page.getByRole("heading", {name: "Export Query"}).boundingBox();
      const toggle = await page.locator("label", {hasText: "Tooling API"}).boundingBox();

      if (width >= 1024) {
        const headingCenter = heading.y + (heading.height / 2);
        const toolbarCenter = bounds.y + (bounds.height / 2);
        expect(Math.abs(toolbarCenter - headingCenter), "toolbar is inline with Export Query").toBeLessThan(6);
        expect(bounds.x - (heading.x + heading.width), "toolbar sits directly after Export Query").toBeLessThan(24);
      }
      if (width >= 1280) {
        const toolbarCenter = bounds.y + (bounds.height / 2);
        const toggleCenter = toggle.y + (toggle.height / 2);
        expect(Math.abs(toggleCenter - toolbarCenter), "toggles are inline with toolbar").toBeLessThan(6);
      }
    });
  }

  test("Dropdown Row Alignment, Operator Hover Background And Progressive Batching", async ({page, context, extensionId}) => {
    const hugeQuery = `SELECT Id FROM Account WHERE Id IN (${Array.from({length: 400}, (_, i) => `'001000000000${String(i).padStart(3, "0")}AAA'`).join(", ")}) AND External_Id__c != 'DEEP_TARGET_99'`;
    await context.addInitScript(longQuery => {
      window.localStorage.setItem("numberOfQueriesInHistory", "150");
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: longQuery, useToolingApi: false},
        ...Array.from({length: 119}, (_, i) => ({
          query: `SELECT Id FROM Account WHERE Name = 'Batch ${i}' AND Type != 'Other'`,
          useToolingApi: false
        }))
      ]));
      window.localStorage.setItem("insextSavedQueryHistory", JSON.stringify([
        {query: "test:SELECT Id FROM Account WHERE Id = '001Ws000062hgiwIAB'", useToolingApi: false}
      ]));
    }, hugeQuery);

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // 1. Saved single-line row: operator has transparent background on hover, and query text is vertically centred with badge and delete icon.
    await selectQuerySource(page, "saved");
    const saved = page.getByRole("combobox", {name: "Search saved"});
    await saved.click();
    const savedOption = page.locator("#query-search-listbox [role='option']").first();
    await savedOption.hover();

    const operatorBg = await savedOption.locator(".token.operator").first().evaluate(el => getComputedStyle(el).backgroundColor);
    expect(operatorBg, "operator token has no contrasting background box on hover").toBe("rgba(0, 0, 0, 0)");

    const savedOptionBox = await savedOption.boundingBox();
    const savedTextBox = await savedOption.locator(".sfir-query-text").boundingBox();
    const savedBadgeBox = await savedOption.locator(".sfir-query-badge").boundingBox();
    expect(
      Math.abs((savedTextBox.y + (savedTextBox.height / 2)) - (savedOptionBox.y + (savedOptionBox.height / 2))),
      "single-line query text is vertically centred in its row"
    ).toBeLessThan(2);
    expect(
      Math.abs((savedBadgeBox.y + (savedBadgeBox.height / 2)) - (savedOptionBox.y + (savedOptionBox.height / 2))),
      "label badge is vertically centred in its row"
    ).toBeLessThan(2);

    // 2. Large history progressive rendering & capped tokenization.
    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const listbox = page.locator("#query-search-listbox");
    const options = listbox.locator("[role='option']");

    await history.click();
    await expect(options, "renders only the initial page of entries on open").toHaveCount(30);
    const tokenCount = await options.first().locator(".token").count();
    expect(tokenCount, "multi-KB query tokenization is capped").toBeLessThan(120);

    // Scrolling near the bottom progressively mounts the next batch.
    await listbox.evaluate(el => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll"));
    });
    await expect(options).toHaveCount(60);

    // ArrowUp from the unhighlighted state still wraps to the final entry (index 119) and renders it.
    await history.fill("");
    await history.press("Escape");
    await history.press("ArrowUp");
    await history.press("ArrowUp");
    await expect(options).toHaveCount(120);
    await expect(options.nth(119)).toHaveAttribute("aria-selected", "true");

    // Searching a term deep inside a multi-KB query windows the preview onto the match.
    await history.fill("DEEP_TARGET_99");
    await expect(options).toHaveCount(1);
    await expect(options.first().locator(".sfir-search-match")).toHaveText("DEEP_TARGET_99");
  });

  test("Templates Source Loads A Template", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "templates");
    const search = page.getByRole("combobox", {name: "Search templates"});
    const options = page.locator("#query-search-listbox [role='option']");

    await search.click();
    await expect(options.first()).toContainText("SELECT Id FROM");
    await expect(options.nth(1).locator(".token.sobject")).toHaveText("Contact");

    // Templates are configuration, so they offer no per-entry delete.
    await expect(options.first().locator(".sfir-combobox-delete")).toHaveCount(0);

    await options.first().click();
    await expect(page.locator("textarea#query")).toHaveValue("SELECT Id FROM ");
  });

  test("Keyboard Never Acts On A Hidden List", async ({page, context, extensionId}) => {
    await context.addInitScript(() => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([
        {query: "SELECT Id FROM Account", useToolingApi: false},
        {query: "SELECT Id FROM Contact", useToolingApi: false}
      ]));
    });

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    await selectQuerySource(page, "history");
    const history = page.getByRole("combobox", {name: "Search history"});
    const listbox = page.locator("#query-search-listbox");
    const query = page.locator("textarea#query");
    await query.fill("SENTINEL");

    // With the list closed, ArrowUp only opens it, so Enter and Delete have nothing to act on.
    await history.click();
    await history.press("Escape");
    await expect(listbox).toHaveCount(0);
    await history.press("ArrowUp");
    await expect(listbox).toBeVisible();
    await expect(listbox.locator("[aria-selected='true']")).toHaveCount(0);
    await history.press("Delete");
    await history.press("Enter");
    await expect(listbox.locator("[role='option']")).toHaveCount(2);
    await expect(query).toHaveValue("SENTINEL");

    // Tab moves focus away and closes the list instead of leaving it over the editor.
    await history.press("Tab");
    await expect(listbox).toHaveCount(0);
    await expect(query).toHaveValue("SENTINEL");
  });

  test("GraphQL Queries Use The GraphQL Grammar", async ({page, context, extensionId}) => {
    const graphql = "{ uiapi { query { Contact(first: 10, orderBy: { Name: { order: ASC } }) { edges { node { Id } } } } } }";
    await context.addInitScript(query => {
      window.localStorage.setItem("insextQueryHistory", JSON.stringify([{query, useToolingApi: false}]));
    }, graphql);

    await page.goto(`chrome-extension://${extensionId}/data-export.html?host=${mockHost}`);
    await page.waitForSelector("textarea#query", {timeout: 2000});

    // GraphQL arguments such as first and order are not SQL keywords, in the list or in the
    // editor, which opens on this history entry.
    await expect(page.locator("textarea#query")).toHaveValue(graphql);
    const editor = page.locator(".query-highlight");
    await expect(editor.locator(".token.keyword")).toHaveText(["query"]);
    await expect(editor.locator(".token.attr-name")).toHaveText(["first", "orderBy", "Name", "order"]);

    await selectQuerySource(page, "history");
    await page.getByRole("combobox", {name: "Search history"}).click();
    const option = page.locator("#query-search-listbox [role='option']").first();
    await expect(option.locator(".token.keyword")).toHaveText(["query"]);
    await expect(option.locator(".token.attr-name")).toHaveText(["first", "orderBy", "Name", "order"]);
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
