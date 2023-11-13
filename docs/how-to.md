# How to

## Use Sf Inspector with a connected app

---

If you enabled "API client whitelisting", Sf Inspector may not work anymore.
To secure the extension usage, you can use a auth flow to get an access token linked to a connected app.

1. Create a connected app.
2. Set permissions and callback url. (chrome-extension://chromeExtensionId/data-export.html?host=mysandboxHost&)

   > **Warning**
   > Don't forget to replace "chromeExtensionId" and "mysandboxHost" with you current extension id and org domain
   > <img alt="Connected App" src="https://github.com/tprouvot/Chrome-Salesforce-inspector/blob/master/docs/screenshots/connectedApp.png?raw=true" height="300">

3. Get Consumer Key and save it in the export page

   <img alt="Client Id" src="https://github.com/tprouvot/Chrome-Salesforce-inspector/blob/master/docs/screenshots/clientId.png?raw=true" height="300">

4. Refresh page and generate new token

   <img alt="Generate Token" src="https://github.com/tprouvot/Chrome-Salesforce-inspector/blob/master/docs/screenshots/generateAccessToken.png?raw=true" width="300">

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

Add a new property `disableQueryInputAutoFocus` with `true`

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/89563a58-d8fa-4b14-a150-99c389e8df75)

## Add custom query templates

Add a new property `queryTemplates` with your custom queries separated by "//" character.
Example:

`SELECT Id FROM// SELECT Id FROM WHERE//SELECT Id FROM WHERE IN//SELECT Id FROM WHERE LIKE//SELECT Id FROM ORDER BY//SELECT ID FROM MYTEST__c//SELECT ID WHERE`

## Open links in a new tab

If you want to _always_ open extension's links in a new tab, you can set the `openLinksInNewTab` property to `true`

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/e6ae08a9-1ee9-4809-a820-1377aebcd547)

If you want to open popup keyboard shortcuts, you can use the 'ctrl' (windows) or 'command' (mac) key with the corresponding key.
Example:

- Data <ins>E</ins>xport : e
- Data <ins>I</ins>mport : i
- Org <ins>L</ins>imits : l
- <ins>D</ins>ownload Metadata : d
- E<ins>x</ins>plore API : x

## Disable metadata search from Shortcut tab

By default when you enter keyword in the Shortcut tab, the search is performed on the Setup link shortcuts _AND_ metadata (Flows, PermissionSets and Profiles).
If you want to disable the search on the metadata, set `metadataShortcutSearch` to `false`

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/a31566d8-0ad4-47e5-a1ab-3eada43b3430)

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

You can enable this view for the Shortcut search by creating a new localVariable as shown below.

![image](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/f3093e4b-438c-4795-b64a-8d37651906a5)

Then when you click on a PermissionSet / PermissionSetGroups search result, you'll be redirected to the summary.


## Download Event Log Files

Because it is not always easy to download event log files, you can now do it from the export option.
On each even log file, you can clic on the path and download the file:

<img alt="Download Eventlogfiles" src="./assets/images/how-to/download-eventlogfiles.gif" height="300">
