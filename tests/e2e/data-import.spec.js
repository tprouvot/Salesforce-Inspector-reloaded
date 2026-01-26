import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  createSuccessResponse,
  createSoapSuccessResponse,
  handleGetUserInfoSoap,
  createModelExposureSetup,
  fulfillSuccess,
  fulfillSoapSuccess
} from "./test-helpers";

test.describe("Data Import", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  test.beforeEach(async ({context}) => {
    // 1. Inject Fake Session Data with model exposure setup
    await injectSessionData(context, {
      host: mockHost,
      token: mockToken,
      version: apiVersion,
      additionalSetup: createModelExposureSetup()
    });

    // 2. Mock Salesforce API Calls
    await context.route("**/*", async route => {
      const request = route.request();
      const url = request.url();
      const method = request.method();

      // Handle getUserInfo SOAP call (common handler)
      const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
      if (getUserInfoHandled) {
        return;
      }

      if (url.includes(mockHost)) {
        const success = (body = {}, status = 200) => route.fulfill(createSuccessResponse(body, status));
        const soapSuccess = (soapBody) => route.fulfill(createSoapSuccessResponse(soapBody));

        // SOAP DML Operations (create, update, delete, upsert)
        if (url.includes("/services/Soap/") && method === "POST") {
          const requestBody = await request.postData();
          if (requestBody) {
            // Create operation
            if (requestBody.includes("<create>") || requestBody.includes(":create")) {
              // Extract number of records from request
              const sObjectsMatch = requestBody.match(/<sObjects[^>]*>/);
              let recordCount = 1;
              if (sObjectsMatch) {
                const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
                recordCount = sObjectMatches ? sObjectMatches.length : 1;
              }

              const results = [];
              for (let i = 0; i < recordCount; i++) {
                results.push(`
                  <result>
                    <id>a0000000000000${i + 1}AAA</id>
                    <success>true</success>
                    <created>true</created>
                    <errors/>
                  </result>
                `);
              }

              await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                  <soapenv:Body>
                    <createResponse>
                      ${results.join("")}
                    </createResponse>
                  </soapenv:Body>
                </soapenv:Envelope>
              `);
              return;
            }

            // Update operation
            if (requestBody.includes("<update>") || requestBody.includes(":update")) {
              const results = [];
              // Extract number of records (simplified - assume batch size)
              const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
              const recordCount = sObjectMatches ? sObjectMatches.length : 1;

              for (let i = 0; i < recordCount; i++) {
                results.push(`
                  <result>
                    <id>a0000000000000${i + 1}AAA</id>
                    <success>true</success>
                    <created>false</created>
                    <errors/>
                  </result>
                `);
              }

              await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                  <soapenv:Body>
                    <updateResponse>
                      ${results.join("")}
                    </updateResponse>
                  </soapenv:Body>
                </soapenv:Envelope>
              `);
              return;
            }

            // Delete operation
            if (requestBody.includes("<delete>") || requestBody.includes(":delete")) {
              const results = [];
              // Extract IDs from request
              const idMatches = requestBody.match(/<ID>([^<]+)<\/ID>/g);
              const recordCount = idMatches ? idMatches.length : 1;

              for (let i = 0; i < recordCount; i++) {
                results.push(`
                  <result>
                    <id>a0000000000000${i + 1}AAA</id>
                    <success>true</success>
                    <errors/>
                  </result>
                `);
              }

              await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                  <soapenv:Body>
                    <deleteResponse>
                      ${results.join("")}
                    </deleteResponse>
                  </soapenv:Body>
                </soapenv:Envelope>
              `);
              return;
            }

            // Upsert operation
            if (requestBody.includes("<upsert>") || requestBody.includes(":upsert")) {
              const results = [];
              // Extract number of records
              const sObjectMatches = requestBody.match(/<sObjects[^>]*>/g);
              const recordCount = sObjectMatches ? sObjectMatches.length : 1;

              // First record updates existing, second creates new
              for (let i = 0; i < recordCount; i++) {
                const isUpdate = i === 0; // First record updates
                results.push(`
                  <result>
                    <id>a0000000000000${i + 1}AAA</id>
                    <success>true</success>
                    <created>${isUpdate ? "false" : "true"}</created>
                    <errors/>
                  </result>
                `);
              }

              await fulfillSoapSuccess(route, `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
                  <soapenv:Body>
                    <upsertResponse>
                      ${results.join("")}
                    </upsertResponse>
                  </soapenv:Body>
                </soapenv:Envelope>
              `);
              return;
            }
          }
        }

        // Global Describe (SObjects)
        if (url.includes("/sobjects/") && !url.includes("sobjects/Inspector_Test__c") && !url.includes("sobjects/Account")) {
          await fulfillSuccess(route, {
            sobjects: [
              {name: "Account", label: "Account", keyPrefix: "001", queryable: true, createable: true, updateable: true, deletable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Account/describe`}},
              {name: "Contact", label: "Contact", keyPrefix: "003", queryable: true, createable: true, updateable: true, deletable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Contact/describe`}},
              {name: "Inspector_Test__c", label: "Inspector Test", keyPrefix: "a00", queryable: true, createable: true, updateable: true, deletable: true, urls: {describe: `/services/data/v${apiVersion}/sobjects/Inspector_Test__c/describe`}}
            ]
          });
          return;
        }

        // Inspector_Test__c Describe (Fields)
        if (url.includes("/sobjects/Inspector_Test__c/describe")) {
          await fulfillSuccess(route, {
            name: "Inspector_Test__c",
            fields: [
              {name: "Id", label: "Record ID", type: "id", idLookup: true, createable: false, updateable: false, referenceTo: []},
              {name: "Name", label: "Name", type: "string", idLookup: true, createable: true, updateable: true, referenceTo: []},
              {name: "Checkbox__c", label: "Checkbox", type: "boolean", createable: true, updateable: true, referenceTo: []},
              {name: "Number__c", label: "Number", type: "double", createable: true, updateable: true, referenceTo: []},
              {name: "Lookup__c", label: "Lookup", type: "reference", referenceTo: ["Inspector_Test__c"], createable: true, updateable: true, relationshipName: "Lookup__r"},
              {name: "OwnerId", label: "Owner ID", type: "reference", referenceTo: ["User", "Group"], createable: true, updateable: true}
            ]
          });
          return;
        }

        // Account Describe (Fields)
        if (url.includes("/sobjects/Account/describe")) {
          await fulfillSuccess(route, {
            name: "Account",
            fields: [
              {name: "Id", label: "Account ID", type: "id", idLookup: true, createable: false, updateable: false, referenceTo: []},
              {name: "Name", label: "Account Name", type: "string", createable: true, updateable: true, referenceTo: []}
            ]
          });
          return;
        }

        // SOQL Query
        if (url.includes("/query/?q=")) {
          const query = decodeURIComponent(url.split("q=")[1]);

          if (query.toLowerCase().includes("from inspector_test__c")) {
            await fulfillSuccess(route, {
              totalSize: 0,
              done: true,
              records: []
            });
            return;
          }

          await fulfillSuccess(route, {totalSize: 0, done: true, records: []});
          return;
        }

        // Fallback
        await fulfillSuccess(route, {});
        return;
      }

      await route.continue();
    });
  });

  // Helper function to paste data using the model
  async function pasteData(page, data) {
    // Wait for model to be exposed
    await page.waitForFunction(() => window.insextTestModel !== undefined, {timeout: 10000});

    // Access model and call setData directly
    await page.evaluate((data) => {
      if (window.insextTestModel) {
        window.insextTestModel.setData(data);
        // Refresh columns to ensure they're validated against the current action's columnList
        window.insextTestModel.refreshColumn();
        window.insextTestModel.didUpdate();
      }
    }, data);
  }

  test("Load Page and Verify Autocomplete Lists", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    // Wait for page to load
    await page.waitForSelector("#form-search-object");

    // Set import type to Inspector_Test__c
    const objectInput = page.locator("#form-search-object");
    await objectInput.fill("Inspector_Test__c");
    await objectInput.press("Enter");

    // Wait for spinner to finish
    await page.waitForTimeout(1000);

    // Verify the object input has the value
    await expect(objectInput).toHaveValue("Inspector_Test__c");
  });

  test("Create Records from CSV", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Insert
    await page.locator("#form-import-action").selectOption("create");

    // Paste CSV data using helper
    const csvData = '"Name","Checkbox__c","Number__c"\r\ntest3,false,300.03\r\ntest4,true,400.04';
    await pasteData(page, csvData);

    // Wait for data to be parsed and field mapping to be validated
    // First wait for the field mapping section to appear (indicates data was parsed)
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 5000});
    // Then wait for the button to be enabled
    await page.waitForSelector("button:has-text('Run Insert'):not([disabled])", {timeout: 10000});

    // Click Run Insert button
    await page.click("button:has-text('Run Insert')");

    // Confirm dialog should appear
    await expect(page.locator(".slds-modal")).toBeVisible();
    await expect(page.locator(".slds-modal")).toContainText("records will be created");

    // Click confirm button inside the modal (more specific selector)
    await page.locator(".slds-modal button:has-text('Insert')").click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify status counts
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Update Records from CSV", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Update - update model first, then sync select element
    // IMPORTANT: Set importActionSelected = true to prevent setData from auto-changing the action
    await page.evaluate(() => {
      if (window.insextTestModel) {
        const model = window.insextTestModel;
        model.importAction = "update";
        model.importActionName = "Update";
        model.importActionSelected = true; // This prevents setData from auto-changing action
        model.didUpdate();
      }
    });
    // Now update the select element to match
    const actionSelect = page.locator("#form-import-action");
    await actionSelect.selectOption("update");
    // Wait for React to sync and verify model is still "update"
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      return model.importAction === "update" && model.importActionSelected === true;
    }, {timeout: 5000});
    // Wait for React to re-render and columnList to be recalculated
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      // Check that columnList includes "Id" for update action
      const columnList = Array.from(model.columnList());
      return columnList.includes("Id");
    }, {timeout: 10000});
    await page.waitForTimeout(500);

    // Paste CSV data with Id column
    const csvData = "Id,Name,Number__c\r\na00000000000001AAA,test5update,500.50";
    await pasteData(page, csvData);
    // Ensure action is still "update" after pasting (setData might have changed it)
    await page.evaluate(() => {
      if (window.insextTestModel) {
        const model = window.insextTestModel;
        if (model.importAction !== "update") {
          model.importAction = "update";
          model.importActionName = "Update";
          model.importActionSelected = true;
          model.refreshColumn(); // Refresh columns to recalculate columnList
          model.didUpdate();
        }
      }
    });
    // Wait for columnList to include "Id" for update action
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      const columnList = Array.from(model.columnList());
      return model.importAction === "update" && columnList.includes("Id");
    }, {timeout: 5000});
    await page.waitForTimeout(500);
    // Wait for React to process the data
    await page.waitForTimeout(500);

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 5000});

    // Wait for button to be enabled - with debugging info
    try {
      await page.waitForSelector("button:has-text('Run Update'):not([disabled])", {timeout: 15000});
    } catch (e) {
      // If it fails, log the model state for debugging
      const debugInfo = await page.evaluate(() => {
        if (!window.insextTestModel) return {error: "Model not found"};
        const model = window.insextTestModel;
        const columnList = Array.from(model.columnList());
        return {
          importAction: model.importAction,
          invalidInput: model.invalidInput(),
          isWorking: model.isWorking(),
          queued: model.importCounts().Queued,
          hasData: !!model.importData?.importTable,
          columnList,
          columnListIncludesId: columnList.some(col => col.toLowerCase() === "id"),
          columns: model.importData?.importTable?.header?.map(col => ({
            name: col.columnValue,
            originalName: col.columnOriginalValue,
            ignored: col.columnIgnore(),
            valid: col.columnValid(),
            error: col.columnError(),
            inColumnList: columnList.some(cl => cl.toLowerCase() === col.columnValue.toLowerCase())
          })) || []
        };
      });
      console.log("Debug info:", JSON.stringify(debugInfo, null, 2));
      throw e;
    }

    // Click Run Update button
    await page.click("button:has-text('Run Update')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Update')").click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Delete Records from CSV", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Delete - update model first, then sync select element
    // IMPORTANT: Set importActionSelected = true to prevent setData from auto-changing the action
    await page.evaluate(() => {
      if (window.insextTestModel) {
        const model = window.insextTestModel;
        model.importAction = "delete";
        model.importActionName = "Delete";
        model.importActionSelected = true; // This prevents setData from auto-changing action
        model.didUpdate();
      }
    });
    // Now update the select element to match
    const actionSelect = page.locator("#form-import-action");
    await actionSelect.selectOption("delete");
    // Wait for React to sync and verify model is still "delete"
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      return model.importAction === "delete" && model.importActionSelected === true;
    }, {timeout: 5000});
    // Wait for React to re-render and columnList to be recalculated
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      // Check that columnList includes "Id" for delete action
      const columnList = Array.from(model.columnList());
      return columnList.includes("Id");
    }, {timeout: 10000});
    await page.waitForTimeout(500);

    // Paste CSV data with Id column and ignored column
    const csvData = "Id,_foo*\r\na00000000000001AAA,foo";
    await pasteData(page, csvData);
    // Ensure action is still "delete" after pasting (setData might have changed it to "update" because of Id column)
    await page.evaluate(() => {
      if (window.insextTestModel) {
        const model = window.insextTestModel;
        if (model.importAction !== "delete") {
          model.importAction = "delete";
          model.importActionName = "Delete";
          model.importActionSelected = true;
          model.refreshColumn(); // Refresh columns to recalculate columnList
          model.didUpdate();
        }
      }
    });
    // Wait for columnList to include "Id" for delete action
    await page.waitForFunction(() => {
      if (!window.insextTestModel) return false;
      const model = window.insextTestModel;
      const columnList = Array.from(model.columnList());
      return model.importAction === "delete" && columnList.includes("Id");
    }, {timeout: 5000});
    await page.waitForTimeout(500);
    // Wait for React to process the data
    await page.waitForTimeout(500);

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 5000});

    // Wait for button to be enabled - with debugging info
    try {
      await page.waitForSelector("button:has-text('Run Delete'):not([disabled])", {timeout: 15000});
    } catch (e) {
      // If it fails, log the model state for debugging
      const debugInfo = await page.evaluate(() => {
        if (!window.insextTestModel) return {error: "Model not found"};
        const model = window.insextTestModel;
        const columnList = Array.from(model.columnList());
        return {
          importAction: model.importAction,
          invalidInput: model.invalidInput(),
          isWorking: model.isWorking(),
          queued: model.importCounts().Queued,
          hasData: !!model.importData?.importTable,
          columnList,
          columnListIncludesId: columnList.some(col => col.toLowerCase() === "id"),
          columns: model.importData?.importTable?.header?.map(col => ({
            name: col.columnValue,
            originalName: col.columnOriginalValue,
            ignored: col.columnIgnore(),
            valid: col.columnValid(),
            error: col.columnError(),
            inColumnList: columnList.some(cl => cl.toLowerCase() === col.columnValue.toLowerCase())
          })) || []
        };
      });
      console.log("Debug info:", JSON.stringify(debugInfo, null, 2));
      throw e;
    }

    // Click Run Delete button
    await page.click("button:has-text('Run Delete')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Delete')").click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Upsert Records from CSV", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Upsert
    await page.locator("#form-import-action").selectOption("upsert");

    // Wait for external ID field to be visible (it's conditionally rendered when upsert is selected)
    // The parent div has hidden attribute, so we wait for the input to be visible
    const externalIdField = page.locator("#form-external-id");
    await externalIdField.waitFor({state: "visible", timeout: 5000});

    // Set external ID field
    await page.locator("#form-external-id").fill("Name");
    await page.waitForTimeout(1000); // Wait for validation

    // Paste CSV data
    const csvData = "Name,Number__c\r\ntest2,222\r\ntest6,666";
    await pasteData(page, csvData);

    // Wait for data to be parsed
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 5000});
    // Wait for button to be enabled
    await page.waitForSelector("button:has-text('Run Upsert'):not([disabled])", {timeout: 10000});

    // Click Run Upsert button
    await page.click("button:has-text('Run Upsert')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Upsert')").click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Create Records from Excel Format", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Insert
    await page.locator("#form-import-action").selectOption("create");
    await page.waitForTimeout(500);

    // Paste Excel data (tab-separated) - make sure tabs are actual tab characters
    const excelData = '"Name"\t"Number__c"\r\ntest6\t600.06\r\ntest7\t700.07';
    await pasteData(page, excelData);
    // Wait for React to process the data
    await page.waitForTimeout(500);

    // Wait for data to be parsed and field mapping to appear
    await page.waitForSelector(".slds-card__body_inner input[list='columnlist']", {timeout: 5000});

    // Wait for field validation to complete
    await page.waitForFunction(() => {
      if (!window.insextTestModel || !window.insextTestModel.importData || !window.insextTestModel.importData.importTable) {
        return false;
      }
      const model = window.insextTestModel;
      const allValid = model.importData.importTable.header.every(col => col.columnIgnore() || col.columnValid());
      const noMissingFields = model.getRequiredMissingFields().length === 0;
      return allValid && noMissingFields && !model.invalidInput();
    }, {timeout: 10000});

    // Wait for button to be enabled
    await page.waitForSelector("button:has-text('Run Insert'):not([disabled])", {timeout: 5000});

    // Click Run Insert button
    await page.click("button:has-text('Run Insert')");

    // Confirm and execute
    await expect(page.locator(".slds-modal")).toBeVisible();
    await page.locator(".slds-modal button:has-text('Insert')").click();

    // Wait for import to complete
    await page.waitForTimeout(3000);

    // Verify status
    await expect(page.locator("text=/\\d+ Succeeded/")).toBeVisible();
  });

  test("Copy Options", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Set action to Update
    await page.locator("#form-import-action").selectOption("update");

    // Click Copy Options button
    await page.click("button:has-text('Copy Options')");

    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => window.testClipboardValue);
    expect(clipboardContent).toContain("salesforce-inspector-import-options");
    expect(clipboardContent).toContain("apiType=Enterprise");
    expect(clipboardContent).toContain("action=update");
    expect(clipboardContent).toContain("object=Inspector_Test__c");
  });

  test("Validation Errors - Empty Data", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Try to paste empty data
    await pasteData(page, "");

    await page.waitForTimeout(500);

    // Verify error message appears (check if error div is visible or contains text)
    const errorDiv = page.locator("#error-data-paste");
    await expect(errorDiv).not.toHaveAttribute("hidden", "");
  });

  test("Validation Errors - Invalid Field Name", async ({page, extensionId}) => {
    const importUrl = `chrome-extension://${extensionId}/data-import.html?host=${mockHost}`;
    await page.goto(importUrl);

    await page.waitForSelector("#form-search-object");

    // Set object type
    await page.locator("#form-search-object").fill("Inspector_Test__c");
    await page.locator("#form-search-object").press("Enter");
    // Wait for SObject describe to load (spinner to finish)
    await page.waitForFunction(() => {
      const spinner = document.querySelector(".slds-spinner");
      return !spinner || spinner.style.display === "none" || !spinner.classList.contains("slds-spinner");
    }, {timeout: 10000});
    await page.waitForTimeout(500); // Additional wait for React to update

    // Paste data with invalid field name
    const csvData = "Na*me\r\ntest0";
    await pasteData(page, csvData);

    await page.waitForTimeout(1000);

    // Verify field mapping shows error (check in the field mapping section)
    // The error should appear next to the field input
    await expect(page.locator(".slds-text-color_error:has-text('Invalid field name')")).toBeVisible();
  });

});

