# Data Export

Salesforce Inspector Reloaded enhances Salesforce's data export capabilities by allowing users to run SOQL, SOSL and GraphQL queries and export results efficiently.


## Migrate saved queries from legacy extension to Salesforce Inspector Reloaded

1. Open data export page on legacy extension
   <img alt="Inspect legacy" src="../assets/images/how-to/inspect-legacy.png?raw=true" height="300">
2. Get saved queries from `insextSavedQueryHistory` property
   <img alt="Inspect legacy" src="../assets/images/how-to/query-history.png?raw=true" height="300">
3. Open it in VS Code, you should have a JSON like this one:

   ```json
   [
     { "query": "select Id from Contact limit 10", "useToolingApi": false },
     { "query": "select Id from Account limit 10", "useToolingApi": false }
   ]
   ```

   From there you have two options

   Import the queries by adding a label for each one with the label in query property suffixed by ":"
   ie.

   ```json
   [
     {
       "query": "Contacts:select Id from Contact limit 10",
       "useToolingApi": false
     },
     {
       "query": "Accounts:select Id from Account limit 10",
       "useToolingApi": false
     }
   ]
   ```

Re-import this json in the new extension (with the same key `insextSavedQueryHistory`)

## Disable query input autofocus

Option available in Data Export tab

<img width="809" alt="Disable query input" src="https://github.com/user-attachments/assets/6f928f58-e437-47aa-b2d2-378f534e7a08">

## Add custom query templates

Enter value in "Query Templates" option with your custom queries separated by "//" character.
Example:

`SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE`

<img width="895" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/16490965-ec4f-42d7-a534-8f24febe1ee3">

## Download Event Log Files

To make your life easier and avoid third party tools or login to ELF website, we implemented the download option from the data export page.
When quering EventLogFile, add the "LogFile" field in the query and click on the value to download corresponding log.

![2023-11-15_14-32-44 (1)](https://github.com/Annubis45/Salesforce-Inspector-reloaded/assets/35368290/ba1fcbed-8428-495e-b03b-7816320d95df)

## Display query performance in Data Export

To enable performance metrics for queries on the data export page, open the Options screen and select the Data Export tab,
then set "Display Query Execution Time" to enabled. Total time for the query to process and, when applicable, batch stats (Total Number of Batches, Min/Max/Avg Batch Time)
are displayed.

## Select all fields in a query

This functionality already exists in the legacy version but since many users don't know about it, I would like to document it.
When on the export page, put the cursor between `SELECT` and `FROM` and press `Ctrl + space` for inserting all fields (if you don't have the rights for a particular field, it wont' be added).
If you want to insert only custom fields, enter `__c` between `SELECT` and `FROM`.

![2024-04-16_08-53-32 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/ef7ba7a0-c9c4-4573-9aaa-b72e64430f64)

## Customize Select all fields in a query shortcut

If the default `Ctrl + space` shortcut is already used by another extension or app, you can customize it in `chrome://extensions/shortcuts` and choose the one you prefer.

<img width="1133" alt="Customize Select all fields in a query shortcut" src="https://github.com/user-attachments/assets/f0bca12a-7c92-4fbe-9ca4-a8db51b050e9">

## Exclude formula fields from data export autocomplete

You can exclude formula fields to be included in the autocomplete by disable the toogle

<img width="898" alt="Exclude formula fields from autocomplete" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/aa9db6c4-099d-49ea-a343-7c64e472450d">

## Convert times from data export to local time

You can configure Data Export to convert times to local time. Navigate to Options -> Data Export and enable "Show local time".

<img width="898" alt="Show local time in data export checkbox option" src="../assets/images/how-to/show-local-time.png?raw=true">

## Hide additional columns in query results

After running a query in the "Data Export" page, you can hide additional columns in the query results. These columns represent the name of the objects included in your query. They are useful to automatically map the fields to the correct object in the "Data Import" page. The columns are hidden in the exported files (CSV or Excel) as well. You can set a default value, using the 'Hide additionnal Object Name Columns by default on Data Export' option ("Options" -> "Data Export" tab).

![2024-05-16_17-54-24 (1)](https://github.com/guillaumeSF/Salesforce-Inspector-reloaded/assets/166603639/45fda19b-b426-4b11-91cb-4f0fbc5c47d7)

## Hide some buttons

Since the extension offers more features, the number of button is increasing.
Some of the users may don't need some of those, to make the experience smoother, some of the buttons can be hidden in the Data Export tab of the Option page.

Currently the buttons that can be hidden are:
- Delete Records
- Export Query
