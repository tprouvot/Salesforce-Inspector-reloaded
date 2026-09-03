import {test, expect} from "./fixtures";
import {TEST_CONSTANTS, injectSessionData, fulfillSuccess} from "./test-helpers";

test.describe("Debug Log Viewer", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  const LOG_BODY = [
    "12:00:00.0|USER_DEBUG|First message",
    "12:00:00.1|FATAL_ERROR|Something failed",
    "12:00:00.2|USER_DEBUG|Second message"
  ].join("\n");

  const MOCK_LOG = {
    Id: "07L000000000001AAA",
    Operation: "EXECUTION_STARTED",
    Request: "API",
    Status: "Success",
    StartTime: "2026-08-21T12:00:00.000Z",
    LogUserId: "005000000000001AAA",
    Application: "Unknown",
    Location: "Unknown",
    LogLength: 128
  };

  test.beforeEach(async ({context}) => {
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion
    });

    await context.route("**/*", async route => {
      const url = route.request().url();
      if (!url.includes(mockHost)) {
        await route.continue();
        return;
      }

      if (url.includes("/tooling/sobjects/ApexLog/07L000000000001AAA/Body")) {
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: LOG_BODY
        });
        return;
      }

      const decodedUrl = decodeURIComponent(url);
      if (decodedUrl.includes("SELECT COUNT() FROM ApexLog")) {
        await fulfillSuccess(route, {totalSize: 1, records: []});
        return;
      }

      if (decodedUrl.includes("SELECT LogUserId, LogUser.Name")) {
        await fulfillSuccess(route, {
          records: [{
            LogUserId: "005000000000001AAA",
            LogUser: {Name: "Test User", Profile: {Name: "System Administrator"}}
          }]
        });
        return;
      }

      if (decodedUrl.includes("FROM ApexLog")) {
        await fulfillSuccess(route, {records: [MOCK_LOG]});
        return;
      }

      await fulfillSuccess(route, {records: []});
    });
  });

  const gotoPage = (page, extensionId) =>
    page.goto(`chrome-extension://${extensionId}/debug-log.html?host=${mockHost}`);

  const openPreview = async (page, extensionId) => {
    await gotoPage(page, extensionId);
    await page.getByRole("button", {name: "Preview"}).click();
    await expect(page.locator(".sfir-preview-code-block")).toBeVisible();
  };

  // ── Log list ────────────────────────────────────────────────────────────────

  test("Display Fetched Logs in Table", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.getByRole("button", {name: "Preview"})).toBeVisible();
    await expect(page.getByRole("table").getByText("Test User")).toBeVisible();
    await expect(page.getByRole("table").getByText("Success")).toBeVisible();
    await expect(page.locator(".slds-card__header-title")).toContainText("Logs (1 of 1)");
  });

  test("Delete Selected Button Disabled Until Row is Checked", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.getByRole("button", {name: "Preview"})).toBeVisible();
    await expect(page.getByRole("button", {name: /Delete Selected/})).toBeDisabled();
    await page.locator("thead input[type='checkbox']").check();
    await expect(page.getByRole("button", {name: /Delete Selected/})).toBeEnabled();
  });

  test("Delete Single Log Opens Confirmation Modal", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.getByRole("button", {name: "Preview"})).toBeVisible();
    await page.getByTitle("Delete").click();
    await expect(page.getByText("Are you sure you want to delete this log?")).toBeVisible();
    await page.getByRole("button", {name: "Cancel", exact: true}).click();
    await expect(page.getByText("Are you sure you want to delete this log?")).not.toBeVisible();
  });

  test("Page Size Selector Updates Displayed Value", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.locator("#sfir-page-size")).toHaveValue("15");
    await page.locator("#sfir-page-size").selectOption("25");
    await expect(page.locator("#sfir-page-size")).toHaveValue("25");
  });

  test("Sort Column Header Applies Ascending Sort Indicator", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.getByRole("button", {name: "Preview"})).toBeVisible();
    // "Start Time" is already the default sort (DESC); clicking once should toggle it to ASC
    await page.locator("th.slds-is-sortable").filter({hasText: "Start Time"}).locator("a.slds-th__action").click();
    await expect(page.locator("th.slds-is-sortable").filter({hasText: "Start Time"})).toHaveClass(/slds-is-sorted_asc/);
  });

  test("Date Filter Inputs Retain Selected Values", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    const fromInput = page.locator("input[type='datetime-local']").first();
    const toInput = page.locator("input[type='datetime-local']").last();
    await fromInput.fill("2026-08-21T10:00");
    await toInput.fill("2026-08-21T23:59");
    await expect(fromInput).toHaveValue("2026-08-21T10:00");
    await expect(toInput).toHaveValue("2026-08-21T23:59");
  });

  test("Disable Fetch Bodies Hides Log Search Input", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);
    await expect(page.getByPlaceholder("Search in logs...")).toBeVisible();
    // SLDS toggle widget: the visual span intercepts pointer events, use force to reach the input
    await page.locator("input[aria-describedby='fetch-bodies-toggle']").click({force: true});
    await expect(page.getByPlaceholder("Search in logs...")).not.toBeVisible();
  });

  // ── Preview modal ───────────────────────────────────────────────────────────

  test("Keep Focus While Applying Debounced Preview Filter", async ({page, extensionId}) => {
    await gotoPage(page, extensionId);

    await page.getByRole("button", {name: "Preview"}).click();
    const filterInput = page.locator("#sfir-log-filter-custom");
    await expect(filterInput).toBeVisible();

    await filterInput.pressSequentially("USER_DEBUG", {delay: 30});
    await expect(filterInput).toHaveValue("USER_DEBUG");
    await expect(filterInput).toBeFocused();

    const preview = page.locator(".sfir-preview-code-block");
    await expect(preview).toContainText("First message");
    await expect(preview).toContainText("Second message");
    await expect(preview).not.toContainText("Something failed");
    await expect(filterInput).toBeFocused();
  });

  test("Preview Modal Opens with Full Log Body and Closes", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    const preview = page.locator(".sfir-preview-code-block");
    await expect(preview).toContainText("First message");
    await expect(preview).toContainText("Something failed");
    await expect(preview).toContainText("Second message");
    await page.getByRole("button", {name: "Close", exact: true}).click();
    await expect(preview).not.toBeVisible();
  });

  test("Ctrl+F Refocuses Search Input Inside Preview", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    // Move focus away from search input
    await page.locator("#sfir-log-filter-custom").focus();
    await expect(page.locator("#sfir-log-filter-custom")).toBeFocused();
    await page.keyboard.press("Control+f");
    await expect(page.locator(".sfir-preview-search-input")).toBeFocused();
  });

  test("Search Within Preview Shows Match Count and Navigates Matches", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    const searchInput = page.locator(".sfir-preview-search-input");
    await searchInput.fill("USER_DEBUG");
    // Wait for the 200 ms debounce to commit the search term
    const counter = page.locator(".sfir-search-counter");
    await expect(counter).toContainText("1 / 2");

    await page.getByTitle("Next match").click();
    await expect(counter).toContainText("2 / 2");

    await page.getByTitle("Previous match").click();
    await expect(counter).toContainText("1 / 2");
  });

  test("Select Filter Template Hides Non-Matching Lines", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    // "Exceptions" template filters for EXCEPTION_THROWN|FATAL_ERROR
    await page.locator("#sfir-log-filter-template").selectOption("EXCEPTION_THROWN|FATAL_ERROR");
    const preview = page.locator(".sfir-preview-code-block");
    await expect(preview).toContainText("Something failed");
    await expect(preview).not.toContainText("First message");
    await expect(preview).not.toContainText("Second message");
  });

  test("Custom Filter with Pipe OR Shows All Matching Types", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    const filterInput = page.locator("#sfir-log-filter-custom");
    await filterInput.fill("USER_DEBUG|FATAL_ERROR");
    const preview = page.locator(".sfir-preview-code-block");
    await expect(preview).toContainText("First message");
    await expect(preview).toContainText("Something failed");
    await expect(preview).toContainText("Second message");
  });

  test("Clear Custom Filter Restores All Log Lines", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    const filterInput = page.locator("#sfir-log-filter-custom");
    await filterInput.fill("FATAL_ERROR");
    await expect(page.locator(".sfir-preview-code-block")).not.toContainText("First message");

    await filterInput.clear();
    // Trigger onChange to notify React of the cleared value
    await filterInput.dispatchEvent("change");
    await expect(page.locator(".sfir-preview-code-block")).toContainText("First message");
  });

  test("Select No Filter Template Restores All Log Lines", async ({page, extensionId}) => {
    await openPreview(page, extensionId);
    await page.locator("#sfir-log-filter-template").selectOption("EXCEPTION_THROWN|FATAL_ERROR");
    await expect(page.locator(".sfir-preview-code-block")).not.toContainText("First message");

    await page.locator("#sfir-log-filter-template").selectOption("");
    await expect(page.locator(".sfir-preview-code-block")).toContainText("First message");
    await expect(page.locator(".sfir-preview-code-block")).toContainText("Second message");
  });
});
