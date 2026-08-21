import {test, expect} from "./fixtures";
import {TEST_CONSTANTS, injectSessionData, fulfillSuccess} from "./test-helpers";

test.describe("Debug Log Viewer", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

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
          body: [
            "12:00:00.0|USER_DEBUG|First message",
            "12:00:00.1|FATAL_ERROR|Something failed",
            "12:00:00.2|USER_DEBUG|Second message"
          ].join("\n")
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
        await fulfillSuccess(route, {
          records: [{
            Id: "07L000000000001AAA",
            Operation: "EXECUTION_STARTED",
            Request: "API",
            Status: "Success",
            StartTime: "2026-08-21T12:00:00.000Z",
            LogUserId: "005000000000001AAA",
            Application: "Unknown",
            Location: "Unknown",
            LogLength: 128
          }]
        });
        return;
      }

      await fulfillSuccess(route, {records: []});
    });
  });

  test("keeps focus while applying a debounced preview filter", async ({page, extensionId}) => {
    await page.goto(`chrome-extension://${extensionId}/debug-log.html?host=${mockHost}`);

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
});
