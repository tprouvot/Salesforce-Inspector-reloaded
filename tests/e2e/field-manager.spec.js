import {test, expect} from "./fixtures";
import {
  TEST_CONSTANTS,
  injectSessionData,
  waitSuccessfulHttpResponse
} from "./test-helpers";
import {routeMock} from "./test-mock";

test.describe("Field Manager", () => {
  const {mockHost, mockToken, apiVersion} = TEST_CONSTANTS;

  /** @desc Initializes the field creator page, waits for objects to load and selects an object */
  async function initPage(page, extensionId, objectName){
    await page.goto(`chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`);
    await page.waitForSelector("#object_select");

    // Wait for objects and entity definitions to load (utils.js fetches sobjects, tooling/sobjects, and EntityDefinition via COUNT + batched queries)
    await Promise.all([
      waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/sobjects/"),
      waitSuccessfulHttpResponse(page, "/services/data/v" + apiVersion + "/tooling/sobjects/"),
      waitSuccessfulHttpResponse(page, "EntityDefinition"),
      waitSuccessfulHttpResponse(page, "PermissionSet"),
    ]);

    //Wait some time to ensure that the responses are processed
    await page.waitForTimeout(350);

    // Select an object first
    await page.locator("#object_select").focus();
    await page.keyboard.type(objectName, {delay: 50});
    await page.waitForTimeout(150);

    await page.waitForSelector("#object-select-listbox [role='option']", {timeout: 2000});
    await page.locator(`#object-select-listbox [role='option']:has-text('${objectName}')`).first().click();
  }

  /** @desc Clicks Retrieve Fields and waits for the retrieved rows to appear in the table */
  async function retrieveFields(page, expectedRowCount) {
    await page.locator("button[aria-label='Retrieve object fields button']").click();
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(expectedRowCount, {timeout: 5000});
  }

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

  test("Load Page and Verify Initial State", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
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
    await expect(page.locator("button[aria-label='Retrieve object fields button']")).toBeVisible();
    await expect(page.locator("button[aria-label='Retrieve object fields button']")).toBeDisabled();
    await expect(page.locator("button:has-text('Deploy Fields')")).toBeVisible();
    await expect(page.locator("button:has-text('Add Row')")).toBeVisible();

    // Verify the "Allow updating existing fields" toggle exists and defaults to off
    const allowUpdatesToggle = page.locator("label.slds-checkbox_toggle:has-text('Allow updating existing fields')");
    await expect(allowUpdatesToggle).toBeVisible();
    await expect(allowUpdatesToggle.locator("input[type='checkbox']")).not.toBeChecked();
  });

  test("Search and Select Object", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Verify object is selected
    await expect(page.locator("#object_select")).toHaveValue("Account");

    // Verify Fields link appears
    await expect(page.locator("a:has-text('(Fields)')")).toBeVisible();

    // Retrieve Fields becomes enabled once an object is selected
    await expect(page.locator("button[aria-label='Retrieve object fields button']")).toBeEnabled();
  });

  test("Add Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
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
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
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
    await initPage(page, extensionId, "Account");

    // Find the type select in the first row
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.slds-select");
    await typeSelect.selectOption("Number");

    // Verify type is changed
    await expect(typeSelect).toHaveValue("Number");
  });

  test("Open Field Options Modal", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Set field label and type
    await page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']").fill("Test Field");

    await page.locator("#fields_table tbody tr").first().locator("select.slds-select").selectOption("Text");

    // Click Options button
    await page.locator("#fields_table tbody tr").first().locator("button:has-text('Options')").click();

    // Verify modal appears
    await expect(page.locator("text=Set Field Options")).toBeVisible();
    await expect(page.locator("label:has-text('Description')")).toBeVisible();
  });

  test("Field Options Modal - Text Field", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Set field type to Text
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.slds-select");
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
    await initPage(page, extensionId, "Account");

    // Set field type to Picklist
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.slds-select");
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
    await initPage(page, extensionId, "Account");

    // Set field label and type
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.slds-select");
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
    const saveButton = page.locator(".slds-modal__footer button:has-text('Save')");
    await saveButton.click();

    // Verify modal closes
    await expect(page.locator("text=Set Field Options")).not.toBeVisible();
  });

  test("Open Field Permissions Modal", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Click Permissions button
    await page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')").click();

    // Verify modal appears
    await expect(page.locator("text=Set Field Permissions")).toBeVisible();
    await expect(page.locator("input[placeholder='Search profiles and permission sets...']")).toBeVisible();
  });

  test("Field Permissions Modal - Search", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Click Permissions button
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();

    // Wait for modal
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".slds-modal__container");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table");
      return tables.length > 0;
    }, {timeout: 2000});

    // Type in search box
    const searchInput = page.locator("input[placeholder='Search profiles and permission sets...']");
    await searchInput.fill("Test");

    // Verify search works (permission sets should be filtered)
    await page.waitForTimeout(250);
    // The table should still be visible
    await expect(page.locator(".slds-modal__container table.slds-table")).toBeVisible();
  });

  test("Field Permissions Modal - Select Permissions", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Wait for objects and permission sets to load
    await page.waitForTimeout(1000);

    // Click Permissions button
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();

    // Wait for modal
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets table to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".slds-modal__container");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table tbody tr");
      return tables.length > 0;
    }, {timeout: 2000});

    // Click a checkbox for Edit permission (first permission set, second column)
    const editCheckbox = page.locator(".slds-modal__container table.slds-table tbody tr").first().locator("td").nth(1).locator("input[type='checkbox']");
    await editCheckbox.click();

    // Verify checkbox is checked
    await expect(editCheckbox).toBeChecked();

    // Click Save button
    const saveButton = page.locator(".slds-modal__footer button:has-text('Save')");
    await saveButton.click();

    // Verify modal closes
    await expect(page.locator("text=Set Field Permissions")).not.toBeVisible();
  });

  test("Delete Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#add_row");

    // Add a row first
    await page.locator("#add_row").click();
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(2);

    // Click delete icon on first row
    const deleteButton = page.locator("#fields_table tbody tr").first().locator("button[aria-label='Delete this field']");
    await deleteButton.click();

    // Verify row is deleted
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(1);
  });

  test("Clone Field Row", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("#fields_table tbody tr");

    // Set field label
    const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
    await labelInput.fill("Test Field");

    // Click clone icon
    const cloneButton = page.locator("#fields_table tbody tr").first().locator("button[aria-label='Clone this field']");
    await cloneButton.click();

    // Verify new row is added with same label
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(2);
    const clonedLabelInput = page.locator("#fields_table tbody tr").nth(1).locator("input[placeholder='Field label...']");
    await expect(clonedLabelInput).toHaveValue("Test Field");
  });

  test("Open Import Modal", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Import')");

    // Click Import button
    const importButton = page.locator("button:has-text('Import')");
    await importButton.click();

    // Verify import modal appears
    await expect(page.locator("text=CSV Import (beta)")).toBeVisible();
    await expect(page.locator("textarea[aria-label='CSV import content']")).toBeVisible();
  });

  test("Import CSV Fields", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Import')");

    // Click Import button
    const importButton = page.locator("button:has-text('Import')");
    await importButton.click();

    // Wait for modal
    await page.waitForSelector("text=CSV Import (beta)");

    // Enter CSV content (Description/HelpText columns are optional)
    const csvTextarea = page.locator("textarea[aria-label='CSV import content']");
    await csvTextarea.fill("Field 1,Field1,Text\nField 2,Field2,Number,A description,Some help text");

    // Click Import button in modal
    const modalImportButton = page.locator(".slds-modal__footer button:has-text('Import')");
    await modalImportButton.click();

    // Verify modal closes and fields are added
    await expect(page.locator("text=CSV Import (beta)")).not.toBeVisible();
    await expect(page.locator("#fields_table tbody tr")).toHaveCount(3); // 1 initial + 2 imported

    // Verify the Description/HelpText columns were applied to the second imported row
    await page.locator("#fields_table tbody tr").nth(2).locator("button:has-text('Options')").click();
    await page.waitForSelector("text=Set Field Options");
    await expect(page.locator("textarea#description")).toHaveValue("A description");
    await expect(page.locator("textarea#helpText")).toHaveValue("Some help text");
  });

  test("Deploy Fields - Success", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Set field label and name
    await page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']").focus();
    await page.keyboard.type("Test Field", {delay: 50});

    // Set permissions
    const permissionsButton = page.locator("#fields_table tbody tr").first().locator("button:has-text('Permissions')");
    await permissionsButton.click();
    await page.waitForSelector("text=Set Field Permissions");

    // Wait for permission sets table to load in modal
    await page.waitForFunction(() => {
      const modal = document.querySelector(".slds-modal__container");
      if (!modal) return false;
      const tables = modal.querySelectorAll("table.slds-table tbody tr");
      return tables.length > 0;
    }, {timeout: 2000});

    //editCheckbox
    await page.locator(".slds-modal__container table.slds-table tbody tr").first().locator("td").nth(1).locator("input[type='checkbox']").click();
    await page.locator(".slds-modal__footer button:has-text('Save')").click();

    // Verify Deploy button is enabled
    const deployButton = page.locator("button:has-text('Deploy Fields')");
    await expect(deployButton).toBeEnabled();

    // Click Deploy Fields button
    await deployButton.click();

    //if mock is enabled, the test must successfully deploy the fields
    if (TEST_CONSTANTS.mockEnabled) {
      // Wait for success status (checkmark icon) - this indicates deployment succeeded
      await page.waitForSelector("#fields_table tbody tr .cursorPointer svg use.fillGreen", {timeout: 2000});
    } else {
      // in real test; the deploy will be successful, but here we will test that it has failed (because the field already exists)
      // so we are checking the error message
      await page.waitForSelector("#fields_table tbody tr .cursorPointer svg use.fillRed", {timeout: 2000});
      await page.locator("#fields_table tbody tr .cursorPointer svg use.fillRed").first().click();

      await expect(page.locator(".slds-notify__content")).toContainText(/DUPLICATE_DEVELOPER_NAME|INVALID_CROSS_REFERENCE_KEY/);
    }
  });

  test("Toggle Managed Package Filter", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Find the managed package toggle label (click on the label instead of checkbox)
    // Scoped by text since the "Allow updating existing fields" toggle also uses slds-checkbox_toggle
    const managedToggleLabel = page.locator("label.slds-checkbox_toggle:has-text('Managed packages')");

    // Verify initial state (should be unchecked by default)
    const checkbox = managedToggleLabel.locator("input[type='checkbox']");
    await expect(checkbox).not.toBeChecked();

    // Click on the label to toggle (this avoids the interception issue)
    await managedToggleLabel.click();

    // Verify it's checked
    await expect(checkbox).toBeChecked();
  });

  test("Deploy Button Disabled Without Object Selection", async ({page, extensionId}) => {
    const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
    await page.goto(creatorUrl);

    await page.waitForSelector("button:has-text('Deploy Fields')");

    // Verify Deploy button is disabled when no object is selected
    const deployButton = page.locator("button:has-text('Deploy Fields')");
    await expect(deployButton).toBeDisabled();
  });

  test("Field Type Validation for Platform Events", async ({page, extensionId}) => {
    await initPage(page, extensionId, "Account");

    // Note: We would need to mock a platform event object for this test
    // For now, we'll test that the field type dropdown exists and works
    const typeSelect = page.locator("#fields_table tbody tr").first().locator("select.slds-select");

    // Verify field types are available
    await expect(typeSelect).toBeVisible();

    // Change to a valid type
    await typeSelect.selectOption("Text");
    await expect(typeSelect).toHaveValue("Text");
  });

  test.describe("Retrieve and Update Existing Fields", () => {
    test("Retrieve Fields button is disabled without object selection", async ({page, extensionId}) => {
      const creatorUrl = `chrome-extension://${extensionId}/field-manager.html?host=${mockHost}`;
      await page.goto(creatorUrl);

      await page.waitForSelector("button[aria-label='Retrieve object fields button']");
      await expect(page.locator("button[aria-label='Retrieve object fields button']")).toBeDisabled();
    });

    test("Retrieve Fields populates existing fields and greys out Name/Type", async ({page, extensionId}) => {
      await initPage(page, extensionId, "Account");

      if (!TEST_CONSTANTS.mockEnabled) {
        // Against a real org the exact retrieved fields are unknown; just verify the action completes without error
        await page.locator("button[aria-label='Retrieve object fields button']").click();
        await page.waitForTimeout(1000);
        return;
      }

      // Initial blank placeholder row is replaced by the 2 mocked retrieved fields
      await retrieveFields(page, 2);

      const rows = page.locator("#fields_table tbody tr");
      await expect(rows).toHaveCount(2);

      // Both rows show the "Existing" badge
      await expect(page.locator("#fields_table tbody tr .slds-badge:has-text('Existing')")).toHaveCount(2);

      // Name and Type are disabled for a retrieved field, Label stays editable
      const firstRow = rows.first();
      await expect(firstRow.locator("input[placeholder='Field name...']")).toBeDisabled();
      await expect(firstRow.locator("select.slds-select")).toBeDisabled();
      await expect(firstRow.locator("input[placeholder='Field label...']")).toBeEditable();

      // Clicking Retrieve again doesn't duplicate already-retrieved fields
      await page.locator("button[aria-label='Retrieve object fields button']").click();
      await page.waitForTimeout(500);
      await expect(rows).toHaveCount(2);
    });

    test("Options modal only allows editing Label/Description/Help Text for a retrieved field", async ({page, extensionId}) => {
      test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Retrieve Fields response");
      await initPage(page, extensionId, "Account");
      await retrieveFields(page, 2);

      // "Existing Text" is retrieved as a Text field - open its Options modal
      const textRow = page.locator("#fields_table tbody tr", {hasText: "Existing Text"});
      await textRow.locator("button:has-text('Options')").click();
      await page.waitForSelector("text=Set Field Options");

      // Info banner explaining the restriction is shown
      await expect(page.locator(".slds-modal__content").locator("text=only Label, Description, and Help Text")).toBeVisible();

      // Description / Help Text remain editable
      await expect(page.locator("textarea#description")).toBeEditable();
      await expect(page.locator("textarea#helpText")).toBeEditable();

      // Type-specific and Required options are disabled
      await expect(page.locator("input#textLength")).toBeDisabled();
      await expect(page.locator("input#required")).toBeDisabled();
      await expect(page.locator("input#unique")).toBeDisabled();
      await expect(page.locator("input#externalId")).toBeDisabled();

      // Editing description and saving works
      await page.locator("textarea#description").fill("Updated description");
      await page.locator(".slds-modal__footer button:has-text('Save')").click();
      await expect(page.locator("text=Set Field Options")).not.toBeVisible();
    });

    test("Deploying edits to an existing field is skipped when updates are not allowed", async ({page, extensionId}) => {
      test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Retrieve Fields response");
      await initPage(page, extensionId, "Account");
      await retrieveFields(page, 2);

      // Remove the second retrieved row so only one pending edit exists, keeping the assertion deterministic
      await page.locator("#fields_table tbody tr").nth(1).locator("button[aria-label='Delete this field']").click();
      await expect(page.locator("#fields_table tbody tr")).toHaveCount(1);

      // Edit the remaining retrieved field's label
      const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
      await labelInput.fill("Updated Label");

      // "Allow updating existing fields" is off by default - deploying should surface an info modal, not call the API
      await page.locator("button:has-text('Deploy Fields')").click();

      await expect(page.locator(".slds-modal__title:has-text('Deploy Fields')")).toBeVisible();
      await expect(page.locator(".slds-modal__content")).toContainText(/pending changes/);
      await page.locator(".slds-modal__footer button:has-text('OK')").click();

      // Nothing was deployed
      await expect(page.locator("#fields_table tbody tr .cursorPointer svg use.fillGreen")).toHaveCount(0);
    });

    test("Enabling updates shows a confirmation before deploying existing field edits", async ({page, extensionId}) => {
      test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Retrieve Fields response");
      await initPage(page, extensionId, "Account");
      await retrieveFields(page, 2);

      await page.locator("#fields_table tbody tr").nth(1).locator("button[aria-label='Delete this field']").click();
      await expect(page.locator("#fields_table tbody tr")).toHaveCount(1);

      const labelInput = page.locator("#fields_table tbody tr").first().locator("input[placeholder='Field label...']");
      await labelInput.fill("Updated Label");

      // Turn on the toggle
      await page.locator("label.slds-checkbox_toggle:has-text('Allow updating existing fields')").click();

      await page.locator("button:has-text('Deploy Fields')").click();

      // Confirmation modal lists the field about to be overwritten
      await expect(page.locator(".slds-modal__title:has-text('Update Existing Fields')")).toBeVisible();
      await expect(page.locator(".slds-modal__content li:has-text('Updated Label')")).toBeVisible();

      // Confirm and let the (mocked) PATCH succeed
      await page.locator(".slds-modal__footer button:has-text('Update')").click();
      await expect(page.locator("#fields_table tbody tr .cursorPointer svg use.fillGreen")).toHaveCount(1, {timeout: 2000});
    });

    test("CSV import updates a retrieved field instead of creating a duplicate row", async ({page, extensionId}) => {
      test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Retrieve Fields response");
      await initPage(page, extensionId, "Account");
      await retrieveFields(page, 2);

      await page.locator("button:has-text('Import')").click();
      await page.waitForSelector("text=CSV Import (beta)");

      // Same Name as the retrieved "Existing_Text" field, with a new Label/Description
      await page.locator("textarea[aria-label='CSV import content']").fill("Renamed Label,Existing_Text,Text,New description,New help text");
      await page.locator(".slds-modal__footer button:has-text('Import')").click();

      // No new row was created
      await expect(page.locator("#fields_table tbody tr")).toHaveCount(2);

      const updatedRow = page.locator("#fields_table tbody tr", {hasText: "Renamed Label"});
      await expect(updatedRow).toHaveCount(1);
      await expect(updatedRow.locator(".slds-badge:has-text('Existing')")).toBeVisible();
    });

    test("Fields table can be sorted by Label", async ({page, extensionId}) => {
      test.skip(!TEST_CONSTANTS.mockEnabled, "Requires the mocked Retrieve Fields response");
      await initPage(page, extensionId, "Account");
      await retrieveFields(page, 2);

      const rows = page.locator("#fields_table tbody tr");
      const firstLabelInput = () => rows.first().locator("input[placeholder='Field label...']");

      // Default order matches retrieval order: "Existing Text" first, "Existing Checkbox" second
      await expect(firstLabelInput()).toHaveValue("Existing Text");

      // Ascending sort by Label puts "Existing Checkbox" first
      await page.locator("#fields_table thead th a:has-text('Label')").click();
      await expect(firstLabelInput()).toHaveValue("Existing Checkbox");

      // Clicking again reverses to descending
      await page.locator("#fields_table thead th a:has-text('Label')").click();
      await expect(firstLabelInput()).toHaveValue("Existing Text");
    });
  });
});
