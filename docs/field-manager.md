# Field Manager

![image](https://github.com/user-attachments/assets/5dfe73a1-b218-471a-93b5-0f281a90ba44)

## Eligible Objects

The Field Manager supports creating fields for the following types of objects:

- **Standard Objects** - Objects that support page layouts (Account, Contact, Opportunity, etc.)
- **Custom Objects** - User-defined objects ending with `__c`
- **Platform Events** - Event objects ending with `__e` for real-time event processing
- **Custom Metadata Types** - Configuration objects ending with `__mdt`

> **Note**: The field types available and permissions behavior may vary depending on the object type selected. For example, Platform Events have limited field type support and do not use field-level security.

## Supported Field Types

The Field Manager feature supports the following field types:

### For Standard Objects and Custom Objects
- **Checkbox**
- **Currency**
- **Number**
- **Percent**
- **Date**
- **DateTime**
- **Email**
- **Phone**
- **Url**
- **Location**
- **Picklist**
- **Multiselect Picklist**
- **Text**
- **TextArea**
- **LongTextArea**
- **Html**

### For Platform Events (Limited Support)
- **Checkbox**
- **Date**
- **DateTime**
- **Number**
- **Text**
- **LongTextArea**

> **Platform Event Limitations**: Platform Events do not support Help Text, Unique constraints, or External ID options. Only the Description field property is available.

## Getting Started

1. Open the Field Manager through the pop-up.

 <img width="200" src="https://github.com/user-attachments/assets/da2f92fa-97a9-437b-82bd-cd71a9248964">

2. Select the object you want to create fields for from the dropdown menu.
3. Use the managed package toggle to include/exclude objects from managed packages in the object selector.

<img width="450" src="https://github.com/user-attachments/assets/d7a48850-4756-43f9-bddd-ad9d8dd0da5d">


## Creating Fields

1. Click "Add Row" to add a new field.
2. Fill in the Label, API Name, and select the Field Type.
3. Click "Options" to set additional field properties (This modal will be dynamic depending on the field type).
4. Click "Permissions" to set field-level security, use the "Apply to All Fields" option in the Permissions modal to quickly set permissions for all fields.

   <img width="450" height="500" src="https://github.com/user-attachments/assets/972b8558-e745-4d37-b980-cb07b0482e10">

   <img width="450" height="500" src="https://github.com/user-attachments/assets/f05a1130-c9b3-462f-8558-0aae9b2e0275">



## Retrieving and Editing Existing Fields

Besides creating brand new fields, the Field Manager can also pull in an object's existing custom fields so you can update their Label, Description, and Help Text.

1. Select an object, then click "Retrieve Fields" to pull that object's existing custom fields via the Tooling API.
2. Retrieved fields are added to the table with an "Existing" badge. All attributes other than Label, Description, and Help Text are shown read-only, to prevent accidental changes to the field's type, length, picklist values, etc.
3. Edit the Label, Description, and/or Help Text directly in the table or through the "Options" modal, then click "Deploy Fields" as usual.

> **Note**: "Retrieve Fields" is not available for Platform Events.

### Allow Updating Existing Fields

Updates to existing fields are gated behind a dedicated toggle so they can't happen by accident:

- The "Allow updating existing fields" toggle must be turned on for any edits to retrieved fields to be saved on deploy. When it's off, those fields are skipped during deploy instead of being overwritten.
- When it's on and you deploy, a confirmation modal lists every existing field that will be overwritten before anything is sent to your org. This cannot be undone from this tool.

## Bulk Import

<img width="450" src="https://github.com/user-attachments/assets/e4582af0-c6b9-4d6c-bae2-b97a5dfe85d3">


1. Click "Import" to open the import modal.
2. Enter separated values in the format: Label, Name, Type, Description, HelpText (the last two are optional). The separator (comma, semicolon, tab, or pipe) is auto-detected, so you can also paste data copied directly from Excel.
3. Click "Import" to add the fields to your list. Rows whose Name matches a field already in the table via "Retrieve Fields" update that field's Label, Description, and Help Text instead of creating a duplicate row.

## Exporting and Copying Fields

Use the buttons above the fields table to get your field list out of the tool:

- "Download CSV" saves the current field list as a CSV file.
- "Copy CSV" copies the current field list to the clipboard as comma-separated values.
- "Copy Excel" copies the current field list to the clipboard as tab-separated values, so it pastes directly into Excel/Google Sheets with one column per cell.

All three use the same Label, Name, Type, Description, HelpText format as Bulk Import, so a copied/downloaded list can be pasted straight back into the Import modal later (e.g. on another object or another org).

## Deploying Fields

1. Review your field list for accuracy.
2. Click "Deploy Fields" to create (or, for retrieved fields with "Allow updating existing fields" on, update) the fields in your Salesforce org. The button is disabled until an object is selected and while "Retrieve Fields" is running.
3. Check the deployment status icon for each field.

<img width="750" src="https://github.com/user-attachments/assets/e2e7122f-f052-420e-8f30-84db6ffac4ba">


## Additional Features

- Use "Clone" to duplicate a field row.
- Use "Delete" to remove a field row.
- Click "Clear All" to reset the entire field list.
- Click a column header (Label, Name, or Type) to sort the fields table by that column; click again to reverse the sort direction.

<img width="450" src="https://github.com/user-attachments/assets/e820d160-1183-48d2-82fd-e1fd376a0109">


## Available Options
- You can choose the default naming convention ('PascalCase' or 'Underscore') for the API Name of the fields.
- You can configure whether to include managed package objects in the object selector (disabled by default).

<img width="1258" alt="Field Naming Convention" src="https://github.com/user-attachments/assets/06df73b8-e936-4133-847c-6ddca48ddc42">