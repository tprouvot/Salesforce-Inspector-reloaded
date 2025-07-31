# Data Export

## Select all fields in a query

This functionality already exists in the legacy version but since many users don't know about it, I would like to document it.
When on the export page, put the cursor between `SELECT` and `FROM` and press `Ctrl + space` for inserting all fields (if you don't have the rights for a particular field, it wont' be added).
If you want to insert only custom fields, enter `__c` between `SELECT` and `FROM`, for date fields enter `date`.
The search is made on the field label and name.

![2024-04-16_08-53-32 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/ef7ba7a0-c9c4-4573-9aaa-b72e64430f64)

## Multiple Query Tabs

<img width="1428" alt="Multiple Query tabs" src="https://github.com/user-attachments/assets/2e48a0b9-998e-436e-87cf-5a28fba3db58" />

The Data Export page now supports multiple query tabs, allowing you to work on several queries at once without losing context.

- **Automatic Tab Naming**: When you write a SOQL query, the tab will be automatically renamed based on the SObject name detected in the `FROM` clause. For example, `SELECT Id FROM Account` will rename the tab to "Account".
- **Handling Duplicate Names**: If you open a new tab for an SObject that already has a tab, a number will be appended to the name to keep them unique (e.g., "Account (1)", "Account (2)").
- **Preserved Context**: Each tab remembers its own query and the results from the last time it was run. When you switch between tabs, the query and its results are instantly restored.

A new tab can be created by clicking the `+` button in the tab bar.

## Disable query input autofocus

Option available in Data Export tab

<img width="809" alt="Disable query input" src="https://github.com/user-attachments/assets/6f928f58-e437-47aa-b2d2-378f534e7a08">

## Add custom query templates

Enter value in "Query Templates" option with your custom queries separated by "//" character.
Example:

`SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE`

<img width="895" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/16490965-ec4f-42d7-a534-8f24febe1ee3">

## Customize Select all fields in a query shortcut

If the default `Ctrl + space` shortcut is already used by another extension or app, you can customize it in `chrome://extensions/shortcuts` and choose the one you prefer.

<img width="1133" alt="Customize Select all fields in a query shortcut" src="https://github.com/user-attachments/assets/f0bca12a-7c92-4fbe-9ca4-a8db51b050e9">

## Exclude formula fields from data export autocomplete

You can exclude formula fields to be included in the autocomplete by disable the toogle

<img width="898" alt="Exclude formula fields from autocomplete" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/aa9db6c4-099d-49ea-a343-7c64e472450d">

## Convert times from data export to local time

You can configure Data Export to convert times to local time. Navigate to Options -> Data Export and enable "Show local time".

<img width="898" alt="Show local time in data export checkbox option" src="../assets/images/how-to/show-local-time.png?raw=true">

## Display query performance in Data Export

To enable performance metrics for queries on the data export page, open the Options screen and select the Data Export tab,
then set "Display Query Execution Time" to enabled. Total time for the query to process and, when applicable, batch stats (Total Number of Batches, Min/Max/Avg Batch Time)
are displayed.


## Hide additional columns in query results

After running a query in the "Data Export" page, you can hide additional columns in the query results. These columns represent the name of the objects included in your query. They are useful to automatically map the fields to the correct object in the "Data Import" page. The columns are hidden in the exported files (CSV or Excel) as well. You can set a default value, using the 'Hide additionnal Object Name Columns by default on Data Export' option ("Options" -> "Data Export" tab).

![2024-05-16_17-54-24 (1)](https://github.com/guillaumeSF/Salesforce-Inspector-reloaded/assets/166603639/45fda19b-b426-4b11-91cb-4f0fbc5c47d7)

## Download Event Log Files

To make your life easier and avoid third party tools or login to ELF website, we implemented the download option from the data export page.
When quering EventLogFile, add the "LogFile" field in the query and click on the value to download corresponding log.

![2023-11-15_14-32-44 (1)](https://github.com/Annubis45/Salesforce-Inspector-reloaded/assets/35368290/ba1fcbed-8428-495e-b03b-7816320d95df)

## Hide some buttons in Data Export

Since the extension offers more features, the number of button is increasing.
Some of the users may don't need some of those, to make the UI lighter some of the buttons can be hidden:
- Delete Records
- Export Query
- Agentforce icon

## Generate SOQL queries with Agentforce

> **Prerequisite**
> Agentforce needs to be enabled.
> The prompt GenerateSOQL needs to be deployed in the org.

You can use Agentforce to generate SOQL queries directly from the Data Export page. This feature leverages Salesforce's Prompt Templates to help you write queries more efficiently.

> **Note**
> The standard Salesforce 'Prompt Template User' permission is required to use this feature.

By default, the Agentforce button is hidden. To enable it:
1. Go to Options -> Data Export
2. Enable "Show Agentforce button"
3. Optionally, you can customize the prompt template name that will be used for generating queries

<img width="1443" alt="Agentforce SOQL builder" src="https://github.com/user-attachments/assets/deab54b8-df9a-4b74-ab81-b27aea5be800" />


GenerateSOQL.genAiPromptTemplate meta content:

``` xml
<?xml version="1.0" encoding="UTF-8"?>
<GenAiPromptTemplate xmlns="http://soap.sforce.com/2006/04/metadata">
    <activeVersionIdentifier>anEjRSM7QudV59rn+lQuKa5VlLkCpKFNWwKc0odntGw=_1</activeVersionIdentifier>
    <description>Prompt used to generate a SOQL query based on a description.</description>
    <developerName>GenerateSOQL</developerName>
    <masterLabel>Generate SOQL</masterLabel>
    <templateVersions>
        <content>As a Salesforce expert in SOQL, return a SOQL query based on this description : {!$Input:Description}.

Instructions:** 
1. Based on the description, construct a Salesforce SOQL that adheres to the specified SObject and make sure this object exists and is queryable. 
2. Ensure the SOQL is syntactically correct, keep in mind the query plan statement and use a maximum of indexed fields for the filters if needed.
3. Output the generated Salesforce SOQL query clearly enclosed within `&lt;soql&gt;` tags.
4. Output if the tooling api needs to be used for this query  `<toolingApi>true</toolingApi>` 
</content>
        <inputs>
            <apiName>Description</apiName>
            <definition>primitive://String</definition>
            <masterLabel>Description</masterLabel>
            <referenceName>Input:Description</referenceName>
            <required>true</required>
        </inputs>
        <primaryModel>sfdc_ai__DefaultOpenAIGPT4</primaryModel>
        <status>Published</status>
        <versionIdentifier>anEjRSM7QudV59rn+lQuKa5VlLkCpKFNWwKc0odntGw=_1</versionIdentifier>
    </templateVersions>
    <type>einstein_gpt__flex</type>
    <visibility>Global</visibility>
</GenAiPromptTemplate>
```