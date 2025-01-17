# How to

## Use Sf Inspector with a connected app

---

### For Chrome and Edge users

If you enabled "API client whitelisting" (a.k.a "API Access Control") in your org, SF Inspector may not work anymore.

To secure the extension usage, you can use a OAuth 2.0 flow to get an access token, linked to a connected app installed in your org.

1. Open the extension and scroll down to the “Generate Access Token” button.
2. You should see the “OAUTH_APP_BLOCKED” error which is normal at this stage.
3. Go to “Connected Apps OAuth Usage” in setup and search for “Salesforce Inspector reloaded”.
4. Click “Install” and then confirm installation.
5. Now configure the profiles or permissions sets which will have the right to use the extension.
6. Go back to “Connected Apps OAuth Usage” and click “Unblock” next to “Salesforce Inspector reloaded”
7. Once again, open the extension and scroll down to the “Generate Access Token” button

![2024-05-28_16-12-29 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/1cb41271-ea61-4e25-9c68-2a50764c4cec)

This is it ! You can use the extension with the default connected app.

From now when the token will be expired, this banner will show up and provide a link to re-generate the access token

<img width="274" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/856c3635-008b-4b91-8160-019d1d701ba9">

> **Warning**
> Don't forget to grant access to the users by selecting the related profile(s) or permission set(s).

If you are a Firefox user, or if you want to have full control over the connected app settings, you can also use your own connected app by following these instructions:

### For Firefox users

1. Create a connected app under Setup | App Manager > New Connected App.
2. Set callback url to `chrome-extension://chromeExtensionId/data-export.html` (replace `chromeExtensionId` by the actual ID of the extension in your web browser). Make sure the "Manage user data via APIs (api)" scope is selected. You can leave other settings to their default values.

   > **Warning**
   > Don't forget to replace "chromeExtensionId" with your current extension Id
   > <img alt="Connected App" src="https://github.com/tprouvot/Chrome-Salesforce-inspector/blob/master/docs/screenshots/connectedApp.png?raw=true" height="300">

3. Get Consumer Key and save it in the Options page

   <img alt="Option button" width="276" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/14cc8aac-5ffc-4747-9da1-ba892231ace1">

4. Enter the consumer key

   <img alt="Client Id" width="849" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/b1edfea1-5a56-4f42-8945-e452a7ab5cf5">

5. Refresh page and generate new token

   <img width="275" alt="Generate Token" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/931df75d-42ac-4667-ab3f-35f6b6b65a66">

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

## Define a CSV separator

Add a new property `csvSeparator` containing the needed separator for CSV files

   <img alt="Update csv separator" src="../assets/images/how-to/csv-separator.png?raw=true" height="300">

## Disable query input autofocus

Option available in Data Export tab

<img width="809" alt="Disable query input" src="https://github.com/user-attachments/assets/6f928f58-e437-47aa-b2d2-378f534e7a08">

## Add custom query templates

Enter value in "Query Templates" option with your custom queries separated by "//" character.
Example:

`SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE`

<img width="895" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/16490965-ec4f-42d7-a534-8f24febe1ee3">

## Open links in a new tab

If you want to _always_ open extension's links in a new tab, you can set the `openLinksInNewTab` property to `true`

<img width="904" alt="Open link in a new tab" src="https://github.com/user-attachments/assets/c2586ae8-49e9-4e3f-8a3f-31b2a3689ea1">

If you want to open popup keyboard shortcuts, you can use the 'ctrl' (windows) or 'command' (mac) key with the corresponding key.
Example:

- Data <ins>E</ins>xport : e
- Data <ins>I</ins>mport : i
- Org <ins>L</ins>imits : l
- <ins>D</ins>ownload Metadata : d
- E<ins>x</ins>plore API : x
- Event <ins>M</ins>onitor : m
- <ins>F</ins>ield Creator : f

## Disable metadata search from Shortcut tab

By default when you enter keyword in the Shortcut tab, the search is performed on the Setup link shortcuts _AND_ metadata (Flows, PermissionSets and Profiles).
If you want to disable the search on the metadata, update related option:

<img width="892" alt="image" src="https://github.com/user-attachments/assets/2541fc22-9f1b-4cd1-90cd-d4615b313d96">

## Enable / Disable Flow scrollability

Go on a Salesforce flow and check / uncheck the checbox to update navigation scrollability on the Flow Builder

![2023-09-29_16-01-14 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/91845a31-8f53-4ea1-b895-4cb036d1bed0)

## Add custom links to "Shortcut" tab

Because one of the main use case for custom links is to refer to a record in your org, those links are stored under a property prefixed by the org host url.
You can find the value by checking the property `_isSandbox`

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/319585eb-03a3-4c16-948f-fa721214ba14)

Then copy the url and add `_orgLinks` for the property name.
Now you can enter the custom links following this convention:

```json
[
  {
    "label": "Test myLink",
    "link": "/lightning/setup/SetupOneHome/home",
    "section": "Custom",
    "prod": false
  },
  {
    "label": "EnhancedProfiles",
    "section": "Custom",
    "link": "/lightning/setup/EnhancedProfiles/home",
    "prod": false
  }
]
```

ET VOILA !

<img width="271" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/02066229-3af1-435d-9370-1dab91760940">

## Enable summary view of PermissionSet / PermissionSetGroups from shortcut tab

Since Winter 24, there is a beta functionality to view a summary of the PermissionSet / PermissionSetGroups

<img width="718" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/36448cd1-260e-49bd-9dfd-c61910f813f4">

You can enable this view for the Shortcut search by enabling the option as shown below.

<img width="883" alt="Enable Summary" src="https://github.com/user-attachments/assets/4487d0a4-8ed0-4467-993a-17900bc79ce6">

Then when you click on a PermissionSet / PermissionSetGroups search result, you'll be redirected to the summary.

## Customize Create / Update rest callout headers (to prevent execution of auto assignment rules for Accounts, Cases, or Leads)

[Assignment Rule Header](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_autoassign.htm)

From the popup, click on "Options" button and select the API tab.

<img width="846" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/fba23a19-0b11-4275-b4d9-52e9e6ac1bd9">

If you want to prevent auto assignment rules, set the `createUpdateRestCalloutHeaders` property to `{"Sforce-Auto-Assign" : false}`

## Update API Version

Since the plugin's api version is only updated when all productions have been updated to the new release, you may want to use the latest version during preview windows.

> [!IMPORTANT]
> When you manually update the API version, it won't be overridden by extension future updates.

![2023-11-10_09-50-55 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/6ae51a29-9887-41a6-8148-d9e12c2dc10d)

## Download Event Log Files

To make your life easier and avoid third party tools or login to ELF website, we implemented the download option from the data export page.
When quering EventLogFile, add the "LogFile" field in the query and click on the value to download corresponding log.

![2023-11-15_14-32-44 (1)](https://github.com/Annubis45/Salesforce-Inspector-reloaded/assets/35368290/ba1fcbed-8428-495e-b03b-7816320d95df)

## Enable debug logs

Sometimes you may want to enable logs for a particular user.
From User tab, click the "Enable Log" button.

By default, this will enable logs with level "SFDC_DevConsole" for 15 minutes.

<img width="279" alt="Enable Log button" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/e87d2ed6-5c21-4e03-8fb1-16e3bc6121f3">

You can update the debug level (configuration is per organization) and duration (for all organizations) on the Options page.

<img width="788" alt="DebugLog Options" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/f7aa5680-742a-4581-ad29-770089d2b55e">

> **Warning**
> Increasing the default duration may lead to a high volume of logs generated.

## Enable Debug Mode (for Lightning Components)

Enable debug mode to make it easier to debug JavaScript code from Lightning components.
Warning: Salesforce is slower for users who have debug mode enabled.

<img width="278" alt="Enable Debug Mode" src="https://github.com/user-attachments/assets/f4dabb96-6b1d-48a1-828d-cc7d5da92e57" />

## Display query performance in Data Export

To enable performance metrics for queries on the data export page, open the Options screen and select the Data Export tab,
then set "Display Query Execution Time" to enabled. Total time for the query to process and, when applicable, batch stats (Total Number of Batches, Min/Max/Avg Batch Time)
are displayed.

## Test GraphQL query

> [!WARNING]
> DEPRECATED : Since you can use Data Export to test GraphQL and also REST Explore to run the request, this should not be useful anymore.


- Open popup and click on "Explore API" button.
- Right click on the page and select "Inspect"
- Execute the code in dev console:

`var myQuery = { "query": "query accounts { uiapi { query { Account { edges { node { Id  Name { value } } } } } } }" };`
`display(sfConn.rest("/services/data/v59.0/graphql", {method: "POST", body: myQuery}));`

![2024-02-09_17-01-42 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/6689fad3-9549-41b9-8371-55adae037793)

## Customize extension's favicon

From the option page, you can customize the default favicon by:

- a predefined color name among [those values](https://www.w3schools.com/tags/ref_colornames.asp) or any HTML color code you want (ie `#FF8C00`).
- a custom favicon url (ie "https://stackoverflow.com/favicon.ico")

The customization is linked to the org, it means you can have different colors for DEV and UAT env for example.

<img width="878" alt="image" src="https://github.com/user-attachments/assets/fdf24a37-2cab-402e-a101-4a20bc4e1ae4">

Now if you want to populate all the orgs you visited with a custom favicon, you have two options:
- Smart mode enabled: this will analyze your environment name and populate a favicon based on this (blue for dev, green for int, purple for uat and orange for full)
- Random: this will choose a random color among all the predefined colors

Then you click on Populate All and that's it!
Note: orgs with an existing customized favicon won't be affected.

## Customize sandbox banner color

From the option page, enable "Use favicon color on sandbox banner"
<img width="772" alt="image" src="https://github.com/user-attachments/assets/28cb7f5f-01fd-48b9-a5da-f50f6cbb2f81">


<img width="1087" alt="image" src="https://github.com/user-attachments/assets/f90999c2-f93e-423a-bcb7-18a8aa717a17">



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

## Customize extension's shortcuts

Navigate to [chrome://extensions/shortcut](chrome://extensions/shortcut) and choose dedicated shortcuts for the pages you want.

<img width="660" alt="Use Chrome Shortcuts" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/382aea2d-5278-4dfe-89e6-6dcec4c724c9">

## Hide additional columns in query results

After running a query in the "Data Export" page, you can hide additional columns in the query results. These columns represent the name of the objects included in your query. They are useful to automatically map the fields to the correct object in the "Data Import" page. The columns are hidden in the exported files (CSV or Excel) as well. You can set a default value, using the 'Hide additionnal Object Name Columns by default on Data Export' option ("Options" -> "Data Export" tab).

![2024-05-16_17-54-24 (1)](https://github.com/guillaumeSF/Salesforce-Inspector-reloaded/assets/166603639/45fda19b-b426-4b11-91cb-4f0fbc5c47d7)

## Configure Import options in Data Import

You can configure the [SOAP headers](https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/soap_headers.htm) when importing records to specify Assignment Rule, Duplicate Rule or OwnerChangeOptions.
Because custom headers can be hard to configure, you could iterate through suggestions by pressing down key.
If you want to include new suggestions, feel free to open a new [feature request](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/new?assignees=tprouvot&labels=enhancement&projects=&template=feature_request.md).

If true, the account team is kept with the account when the account owner is changed. If false, the account team is deleted:
``` json
{"OwnerChangeOptions": {"options": [{"type": "KeepAccountTeam", "execute": true}]}}
```

For a duplicate rule, when the Alert option is enabled, bypass alerts and save duplicate records by setting this property to true:
``` json
  '{"DuplicateRuleHeader": {"allowSave": true}}'
```

If true for a Case or Lead, uses the default (active) assignment rule for a Case or Lead. If specified, don’t specify an assignmentRuleId. If true for an Account, all territory assignment rules are applied. If false for an Account, no territory assignment rules are applied.
``` json
  '{"AssignmentRuleHeader": {"useDefaultRule": true}}',
```

<img width="503" alt="SOAP Custom Headers" src="https://github.com/user-attachments/assets/e2d21970-ddc5-4c42-a54e-ffb7ffdcb278">


## Highlight PROD with a top border

Production environment are critical, to avoid confusion with other orgs, you can enable an option which will add a 2px border on the top of the Salesforce UI and also in the extension's pages.

Under `User Experience` tab, enable the option `Highlight PROD with a top border (color from favicon)`.

<img width="955" alt="highlight prod with a top border" src="https://github.com/user-attachments/assets/4ff26e23-08b2-447a-be8d-004488f2a3a1">


## Import / Export configuration (saved query etc.)

To export and import your current configuration, go to the options page and click the corresponding icon in the header:

<img width="889" alt="Import / Export Configuration" src="https://github.com/user-attachments/assets/00428039-9b83-4c14-9a27-5e5034c52753">

## Hide some buttons in the popup

Since the extension offers more features, the number of button is increasing.
Some of the users may don't need some of those, to make the popup lighter some of the buttons can be hidden:

<img width="1024" alt="Hide Buttons" src="https://github.com/user-attachments/assets/50b4cb3c-7886-4b38-96a9-b5a6d93b69e6">

## Switch user language from the popup

From the User tab in the popup, click on the user language flag to display the available languages.

![2024-12-04_16-07-35 (1)](https://github.com/user-attachments/assets/d07da946-dba0-4bb4-8f3b-313392bbf557)