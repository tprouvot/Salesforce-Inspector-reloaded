import {test, expect} from "./fixtures";
import {TEST_CONSTANTS, injectSessionData, createSuccessResponse} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Data Import object access", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;
  const objectName = "ImportAccessTest__c";
  const readOnlyObject = {name: objectName, createable: false, updateable: false, deletable: false, undeletable: false};
  const writableObject = {...readOnlyObject, createable: true, updateable: true};

  test.skip(!TEST_CONSTANTS.mockEnabled, "Object access scenarios require mocked profiles");

  test.beforeEach(async ({context}) => {
    await injectSessionData(context, {host: mockHost, token: mockToken, version: apiVersion});
    await context.route("**/*", async route => {
      if (!await routeMock(route, mockHost)) {
        await route.continue();
      }
    });
  });

  async function openImport(page, context, extensionId, {objects = [writableObject], toolingObjects = [], cachedObjects, status = 200, waitForDescribe} = {}) {
    if (cachedObjects) {
      await context.serviceWorkers()[0].evaluate(async ({host, objects}) => {
        await chrome.storage.local.set({
          [host + "_cache_sobjectsList"]: {data: objects, timestamp: Date.now(), lastFetch: Date.now(), durationHours: 168}
        });
      }, {host: mockHost, objects: cachedObjects});
      await context.addInitScript(() => localStorage.setItem("preloadSobjectsBeforePopup", "true"));
    }
    await context.route(`https://${mockHost}/services/data/**`, async route => {
      const path = new URL(route.request().url()).pathname;
      const isTooling = path.includes("/tooling/");
      if (path.endsWith("/sobjects/")) {
        if (waitForDescribe && !isTooling) await waitForDescribe;
        const sobjects = (isTooling ? toolingObjects : objects).map(object => ({
          ...object,
          urls: {describe: `/services/data/v${apiVersion}/${isTooling ? "tooling/" : ""}sobjects/${object.name}/describe`}
        }));
        await route.fulfill(createSuccessResponse(status == 200 ? {sobjects} : [{errorCode: "API_DISABLED_FOR_ORG", message: "API access denied"}], status));
      } else if (/\/sobjects\/[^/]+\/describe$/.test(path)) {
        await route.fulfill(createSuccessResponse({
          name: path.split("/").at(-2),
          fields: [
            {name: "Id", idLookup: true, referenceTo: []},
            {name: "Name", createable: true, updateable: true, referenceTo: []}
          ]}));
      } else if (path.includes("/tooling/query")) {
        await route.fulfill(createSuccessResponse([{errorCode: "INSUFFICIENT_ACCESS", message: "No metadata access"}], 403));
      } else {
        await route.fallback();
      }
    });
    await page.goto(`chrome-extension://${extensionId}/data-import.html?host=${mockHost}&sobject=${objectName}`);
    await expect(page.locator("#form-search-object")).toHaveValue(objectName);
  }

  test("accepts a non-admin's writable object missing from the shared cache", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {
      cachedObjects: [{name: "Account", availableApis: ["regularApi"], createable: true}]
    });
    await expect(page.locator(`#sobjectlist option[value='${objectName}']`)).toHaveCount(1);
    await expect(page.locator("#error-search-object")).toBeHidden();
  });

  test("does not reuse a cached admin's write permissions", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {
      objects: [readOnlyObject],
      cachedObjects: [{...writableObject, availableApis: ["regularApi"]}]
    });
    await expect(page.locator("#error-search-object")).toHaveText("Object is not writable for this user in the selected API. Check object permissions.");
    await expect(page.locator(`#sobjectlist option[value='${objectName}']`)).toHaveCount(0);
  });

  test("distinguishes a read-only object from an unknown object", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {objects: [readOnlyObject]});
    await expect(page.locator("#error-search-object")).toContainText("Object is not writable");
    await page.locator("#form-search-object").fill("MissingObject__c");
    await expect(page.locator("#error-search-object")).toHaveText("Unknown object or unavailable to this user in the selected API");
  });

  test("reports failed object discovery instead of waiting indefinitely", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {status: 403});
    await expect(page.locator("#error-search-object")).toHaveText("Unable to load objects. Check API access and reload the page.");
  });

  test("keeps permissions separate when switching APIs", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {objects: [readOnlyObject], toolingObjects: [writableObject]});
    await expect(page.locator("#error-search-object")).toContainText("Object is not writable");
    await page.locator("#form-api-type").selectOption("Tooling");
    await expect(page.locator(`#sobjectlist option[value='${objectName}']`)).toHaveCount(1);
    await expect(page.locator("#error-search-object")).toBeHidden();
    await page.locator("#form-api-type").selectOption("Enterprise");
    await expect(page.locator("#error-search-object")).toContainText("Object is not writable");
  });

  test("preserves custom metadata, report deletion, and undelete suggestions", async ({page, context, extensionId}) => {
    await openImport(page, context, extensionId, {objects: [
      {...readOnlyObject, name: "Settings__mdt"},
      {...readOnlyObject, name: "Report", keyPrefix: "00O"},
      {...readOnlyObject, name: "Dashboard", keyPrefix: "01Z"},
      {...readOnlyObject, undeletable: true}
    ]});
    await expect(page.locator(`#sobjectlist option[value='${objectName}']`)).toHaveCount(1);
    await expect(page.locator("#sobjectlist option[value='Report']")).toHaveCount(1);
    await expect(page.locator("#sobjectlist option[value='Dashboard']")).toHaveCount(1);
    await page.locator("#form-api-type").selectOption("Metadata");
    await page.locator("#form-search-object").fill("Settings__mdt");
    await expect(page.locator("#error-search-object")).toBeHidden();
    await expect(page.locator("#sobjectlist option")).toHaveCount(1);
  });

  test("does not show an unknown object error while discovery is pending", async ({page, context, extensionId}) => {
    let finishDescribe;
    const waitForDescribe = new Promise(resolve => { finishDescribe = resolve; });
    try {
      await openImport(page, context, extensionId, {waitForDescribe});
      await expect(page.locator("#error-search-object")).toBeHidden();
    } finally {
      finishDescribe();
    }
    await expect(page.locator(`#sobjectlist option[value='${objectName}']`)).toHaveCount(1);
    await expect(page.locator("#error-search-object")).toBeHidden();
  });
});
