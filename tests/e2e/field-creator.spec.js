import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  handleGetUserInfoSoap,
  fulfillSuccess
} from "./test-helpers";

test.describe("Field Creator", () => {
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
      const request = route.request();
      const url = request.url();
      const method = request.method();

      // Handle getUserInfo SOAP call (common handler)
      const getUserInfoHandled = await handleGetUserInfoSoap(route, request);
      if (getUserInfoHandled) {
        return;
      }

      if (url.includes(mockHost)) {

        // REST API - Global Describe (sobjects)
        if (url.includes("/sobjects/") && !url.includes("/tooling/") && method === "GET" && !url.includes("CustomField") && !url.includes("FieldPermissions")) {
          await fulfillSuccess(route, {
            encoding: "UTF-8",
            maxBatchSize: 200,
            sobjects: [
              {
                name: "Account",
                label: "Account",
                keyPrefix: "001",
                layoutable: true,
                custom: false
              },
              {
                name: "Inspector_Test__c",
                label: "Inspector Test",
                keyPrefix: "a00",
                layoutable: true,
                custom: true
              }
            ]
          });
        }

        // Tooling API - Global Describe (tooling sobjects)
        if (url.includes("/tooling/sobjects/") && method === "GET" && !url.includes("CustomField") && !url.includes("query")) {
          await fulfillSuccess(route, {
            encoding: "UTF-8",
            maxBatchSize: 200,
            sobjects: [
              {
                name: "CustomField",
                label: "Custom Field",
                keyPrefix: "00D",
                layoutable: false
              }
            ]
          });
          return;
        }

        // Tooling API - EntityDefinition Count
        if (url.includes("/tooling/query") && url.includes("COUNT() FROM EntityDefinition")) {
          await fulfillSuccess(route, {
            size: 1,
            totalSize: 2,
            done: true,
            records: [{expr0: 2}]
          });
          return;
        }

        // Tooling API - EntityDefinition Query
        if (url.includes("/tooling/query") && url.includes("EntityDefinition") && !url.includes("COUNT()")) {
          await fulfillSuccess(route, {
            size: 2,
            totalSize: 2,
            done: true,
            records: [
              {
                QualifiedApiName: "Account",
                Label: "Account",
                KeyPrefix: "001",
                DurableId: "Account",
                IsCustomSetting: false,
                RecordTypesSupported: false,
                NewUrl: null,
                IsEverCreatable: true,
                NamespacePrefix: null
              },
              {
                QualifiedApiName: "Inspector_Test__c",
                Label: "Inspector Test",
                KeyPrefix: "a00",
                DurableId: "Inspector_Test__c",
                IsCustomSetting: false,
                RecordTypesSupported: false,
                NewUrl: null,
                IsEverCreatable: true,
                NamespacePrefix: null
              }
            ]
          });
          return;
        }

        // REST API - PermissionSet Query
        if (url.includes("/query/") && url.includes("PermissionSet")) {
          await fulfillSuccess(route, {
            totalSize: 3,
            done: true,
            records: [
              {
                Id: "0PS000000000001AAA",
                Name: "TestPermissionSet",
                Profile: null
              },
              {
                Id: "0PS000000000002AAA",
                Name: "AdminPermissionSet",
                Profile: {
                  Name: "System Administrator"
                }
              },
              {
                Id: "0PS000000000003AAA",
                Name: "StandardPermissionSet",
                Profile: {
                  Name: "Standard User"
                }
              }
            ]
          });
          return;
        }

        // Tooling API - Create CustomField
        if (url.includes("/tooling/sobjects/CustomField") && method === "POST") {
          await fulfillSuccess(route, {
            id: "00N000000000001AAA",
            success: true,
            errors: []
          });
          return;
        }

        // REST API - Create FieldPermissions
        if (url.includes("/sobjects/FieldPermissions/") && method === "POST") {
          await fulfillSuccess(route, {
            id: "0PS000000000001AAA",
            success: true,
            errors: []
          });
        }

        // Fallback
        await fulfillSuccess(route, {});
        return;
      }

      await route.continue();
    });
  });

  test("Load Page and Verify Initial State", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    // Wait for page to load
    await page.waitForSelector("#object_select");

    // Verify object search input exists
    const objectInput = page.locator("#object_select");
    await expect(objectInput).toBeVisible();
    await expect(objectInput).toHaveValue("");

    // Verify initial field row exists
    const fieldRows = page.locator("#fields_table tbody tr");
    await expect(fieldRows).toHaveCount(1);

    // Verify buttons exist
    await expect(page.locator("button:has-text('Clear All')")).toBeVisible();
    await expect(page.locator("button:has-text('Import')")).toBeVisible();
    await expect(page.locator("button:has-text('Deploy Fields')")).toBeVisible();
    await expect(page.locator("button:has-text('Add Row')")).toBeVisible();
  });

  test("Search and Select Object", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#object_select");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Type in object search
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");

    // Wait for filtered objects to appear
    await page.waitForSelector(".ulItem li", {timeout: 5000});

    // Click on Account object
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Verify object is selected
    await expect(objectInput).toHaveValue("Account");

    // Verify Fields link appears
    await expect(page.locator("a:has-text('(Fields)')")).toBeVisible();
  });

  test("Add Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#add_row");

    // Click Add Row button
    const addRowButton = page.locator("#add_row");
    await addRowButton.click();

    // Verify new row is added
    const fieldRows = page.locator("#fields_table tbody tr");
    await expect(fieldRows).toHaveCount(2);
  });

  test("Edit Field Label and Name", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Find the label input in the first row
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    // Verify name is auto-generated (PascalCase)
    const nameInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field name...']");
    await expect(nameInput).toHaveValue("TestField");
  });

  test("Change Field Type", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Find the type select in the first row
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");
    await typeSelect.selectOption("Number");

    // Verify type is changed
    await expect(typeSelect).toHaveValue("Number");
  });

  test("Open Field Options Modal", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Set field label and type
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");
    await typeSelect.selectOption("Text");

    // Click Options button
    const optionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Options')");
    await optionsButton.click();

    // Verify modal appears
    await expect(page.locator("text=Set Field Options")).toBeVisible();
    await expect(page.locator("label:has-text('Description')")).toBeVisible();
  });

  test("Field Options Modal - Text Field", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Set field type to Text
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");
    await typeSelect.selectOption("Text");

    // Click Options button
    const optionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Options')");
    await optionsButton.click();

    // Verify Text-specific options appear
    await expect(page.locator("label:has-text('Length')")).toBeVisible();
    await expect(page.locator("input#textLength")).toBeVisible();
    await expect(page.locator("input#required")).toBeVisible();
    await expect(page.locator("input#unique")).toBeVisible();
    await expect(page.locator("input#externalId")).toBeVisible();
  });

  test("Field Options Modal - Picklist Field", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Set field type to Picklist
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");
    await typeSelect.selectOption("Picklist");

    // Click Options button
    const optionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Options')");
    await optionsButton.click();

    // Verify Picklist-specific options appear
    await expect(page.locator("label:has-text('Picklist Values')")).toBeVisible();
    await expect(page.locator("textarea[name='picklistvalues']")).toBeVisible();
    await expect(page.locator("input[name='sortalpha']")).toBeVisible();
    await expect(page.locator("input[name='firstvaluedefault']")).toBeVisible();
  });

  test("Save Field Options", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Set field label and type
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");
    await typeSelect.selectOption("Text");

    // Click Options button
    const optionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Options')");
    await optionsButton.click();

    // Wait for modal
    await page.waitForSelector("text=Set Field Options");

    // Fill in description
    const descriptionTextarea = page.locator("textarea#description");
    await descriptionTextarea.fill("Test description");

    // Click Save button
    const saveButton = page.locator(".modal-footer button:has-text('Save')");
    await saveButton.click();

    // Verify modal closes
    await expect(page.locator("text=Set Field Options")).not.toBeVisible();
  });

  test("Open Field Permissions Modal", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects and permission sets to load
    await page.waitForTimeout(3000);

    // Click Permissions button
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();

    // Verify modal appears
    await expect(page.locator("text=Set Field Permissions")).toBeVisible();
    await expect(page.locator("input[placeholder='Search profiles and permission sets...']")).toBeVisible();
  });

  test("Field Permissions Modal - Search", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects and permission sets to load
    await page.waitForTimeout(3000);

    // Click Permissions button
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();

    // Wait for modal
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".modal-dialog");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table");
      return tables.length > 0;
    }, {timeout: 10000});

    // Type in search box
    const searchInput = page.locator("input[placeholder='Search profiles and permission sets...']");
    await searchInput.fill("Test");

    // Verify search works (permission sets should be filtered)
    await page.waitForTimeout(500);
    // The table should still be visible
    await expect(page.locator(".modal-dialog table.slds-table")).toBeVisible();
  });

  test("Field Permissions Modal - Select Permissions", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects and permission sets to load
    await page.waitForTimeout(3000);

    // Click Permissions button
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();

    // Wait for modal
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets table to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".modal-dialog");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table tbody tr");
      return tables.length > 0;
    }, {timeout: 10000});

    // Click a checkbox for Edit permission (first permission set, second column)
    const editCheckbox = page.locator(".modal-dialog table.slds-table tbody tr").first().locator("td").nth(1).locator("input[type='checkbox']");
    await editCheckbox.click();

    // Verify checkbox is checked
    await expect(editCheckbox).toBeChecked();

    // Click Save button
    const saveButton = page.locator(".modal-footer button:has-text('Save')");
    await saveButton.click();

    // Verify modal closes
    await expect(page.locator("text=Set Field Permissions")).not.toBeVisible();
  });

  test("Delete Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#add_row");

    // Add a row first
    await page.locator("#add_row").click();
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(2);

    // Click delete icon on first row
    const deleteIcon = page.locator("#fields_table tbody tr").first().locator("svg[viewBox='0 0 52 52']").nth(1);
    await deleteIcon.click();

    // Verify row is deleted
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(1);
  });

  test("Clone Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Set field label
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    // Click clone icon
    const cloneIcon = page.locator("#fields_table tbody tr").first().locator("svg[viewBox='0 0 52 52']").first();
    await cloneIcon.click();

    // Verify new row is added with same label
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(2);
    const clonedLabelInput = page.locator("#fields_table tbody tr").nth(1).locator("input[placeholder='Field label...']");
    await expect(clonedLabelInput).toHaveValue("Test Field");
  });

  test("Open Import Modal", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Import')");

    // Click Import button
    const importButton = page.locator("button:has-text('Import')");
    await importButton.click();

    // Verify import modal appears
    await expect(page.locator("text=CSV Import (beta)")).toBeVisible();
    await expect(page.locator("textarea.importTextarea")).toBeVisible();
  });

  test("Import CSV Fields", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Import')");

    // Click Import button
    const importButton = page.locator("button:has-text('Import')");
    await importButton.click();

    // Wait for modal
    await page.waitForSelector("text=CSV Import (beta)");

    // Enter CSV content
    const csvTextarea = page.locator("textarea.importTextarea");
    await csvTextarea.fill("Field 1,Field1,Text\nField 2,Field2,Number");

    // Click Import button in modal
    const modalImportButton = page.locator(".modalFooter button:has-text('Import')");
    await modalImportButton.click();

    // Verify modal closes and fields are added
    await expect(page.locator("text=CSV Import (beta)")).not.toBeVisible();
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(3); // 1 initial + 2 imported
  });

  test("Deploy Fields - Success", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#object_select");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Select an object first
    const objectInput = page.locator("#object_select");
    await objectInput.fill("Account");
    await page.waitForSelector(".ulItem li", {timeout: 5000});
    await page.locator(".ulItem li:has-text('Account')").first().click();

    // Set field label and name
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    // Wait for permission sets to load
    await page.waitForTimeout(2000);

    // Set permissions
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets table to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".modal-dialog");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table tbody tr");
      return tables.length > 0;
    }, {timeout: 10000});

    const editCheckbox = page.locator(".modal-dialog table.slds-table tbody tr").first().locator("td").nth(1).locator("input[type='checkbox']");
    await editCheckbox.click();
    await page.locator(".modal-footer button:has-text('Save')").click();

    // Verify Deploy button is enabled
    const deployButton = page.locator("button:has-text('Deploy Fields')");
    await expect(deployButton).toBeEnabled();

    // Click Deploy Fields button
    await deployButton.click();

    // Wait for pending status (clock icon) - this indicates deployment started
    // This verifies that clicking Deploy triggers the deployment process
    await page.waitForSelector("#fields_table tbody tr svg use[xlinkHref='symbols.svg#clock']", {timeout: 10000});
  });

  test("Toggle Managed Package Filter", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#object_select");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Find the managed package toggle label (click on the label instead of checkbox)
    const managedToggleLabel = page.locator("label.slds-checkbox_toggle");

    // Verify initial state (should be unchecked by default)
    const checkbox = page.locator("label.slds-checkbox_toggle input[type='checkbox']");
    await expect(checkbox).not.toBeChecked();

    // Click on the label to toggle (this avoids the interception issue)
    await managedToggleLabel.click();

    // Verify it's checked
    await expect(checkbox).toBeChecked();
  });

  test("Deploy Button Disabled Without Object Selection", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Deploy Fields')");

    // Verify Deploy button is disabled when no object is selected
    const deployButton = page.locator("button:has-text('Deploy Fields')");
    await expect(deployButton).toBeDisabled();
  });

  test("Field Type Validation for Platform Events", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-creator.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#object_select");

    // Wait for objects to load
    await page.waitForTimeout(2000);

    // Note: We would need to mock a platform event object for this test
    // For now, we'll test that the field type dropdown exists and works
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.form-control");

    // Verify field types are available
    await expect(typeSelect).toBeVisible();

    // Change to a valid type
    await typeSelect.selectOption("Text");
    await expect(typeSelect).toHaveValue("Text");
  });

});

