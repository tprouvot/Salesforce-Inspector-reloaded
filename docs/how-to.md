# How to

## Use Sf Inspector with a connected app

---

### For Chrome and Edge users

If you enabled "API client whitelisting" (a.k.a "API Access Control") in your org, SF Inspector may not work anymore.

To secure the extension usage, you can use a OAuth 2.0 flow to get an access token, linked to a connected app installed in your org.

1. Open the extension and scroll down to the "Generate Access Token" button.
2. You should see the "OAUTH_APP_BLOCKED" error which is normal at this stage.
3. Go to "Connected Apps OAuth Usage" in setup and search for "Salesforce Inspector reloaded".
4. Click "Install" and then confirm installation.
5. Now configure the profiles or permissions sets which will have the right to use the extension.
6. Go back to "Connected Apps OAuth Usage" and click "Unblock" next to "Salesforce Inspector reloaded"
7. Once again, open the extension and scroll down to the "Generate Access Token" button

![2024-05-28_16-12-29 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/1cb41271-ea61-4e25-9c68-2a50764c4cec)

This is it ! You can use the extension with the default connected app.

From now when the token will be expired, this banner will show up and provide a link to re-generate the access token

<img width="274" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/856c3635-008b-4b91-8160-019d1d701ba9">

> **Warning**
> Don't forget to grant access to the users by selecting the related profile(s) or permission set(s).

If you are a Firefox user, or if you want to have full control over the connected app settings, you can also use your own external client app by following these instructions:

### External Client App Creation

The creation of Connected Apps is soon to be deprecated (planned for Spring 26'), so we will cover the creation of the new standard using an external Client App.

1. Navigate to Setup | External Client App > New External Client App.
2. Fill in the required details:
    * External Client App Name
    * Contact Email
    * Check `Enable OAuth` under the API (Enable OAuth Settings) accordion.
    * Set the Callback URL to `[browser]-extension://[extension-id]/data-export.html`, replacing [browser] with `chrome` or `moz` and [extension-id] with the extension ID found in the URL of any configuration page of the extension (e.g., by clicking `See All Data`).
3. Configure the OAuth Scopes:
    * Select `Manage user data via APIs (api)`.
    * Select `Manage user data via Web browsers (web)`.

    <img alt="External Connected App" src="./assets/images/how-to/external-client-app.png" width="849">

    >**Warning**
    >If you don't select the `web` scope, you might not be able to use the Login As Incognito.
4. Configure Security settings:
   * **IMPORTANT: Deselect** (disable) `Require secret for Web Server Flow`.
   * Select (enable) `Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows`.
5. Get Consumer Key and save it in the Options page

    <img alt="Option button" width="276" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/14cc8aac-5ffc-4747-9da1-ba892231ace1">

6. Enter the consumer key

    <img alt="Client Id" width="849" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/b1edfea1-5a56-4f42-8945-e452a7ab5cf5">

7. Refresh page and generate new token

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


## Open links in a new tab

If you want to _always_ open extension's links in a new tab, you can enable> **Warning**

<img width="925" alt="Open link in a new tab" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/7cd6c1fa-af55-4149-a2fb-73611c6f02f9">

> **Warning**
   > Enabling this option will prevent you to use `Lightning navigation` which allows faster navigation.

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

<img width="1234" alt="Use custom shortcuts" src="https://github.com/user-attachments/assets/036045b8-133c-46c1-90d0-1db7aa81a190" />


You can add custom links to the "Shortcut" tab. These links will be stored in the `sfHost + "_orgLinks"` localStorage variable. The links are stored as a JSON array with the following properties:
- `label`: The label of the link
- `link`: The link to the page
- `section`: The section where the link will be displayed
- `isExternal`: A boolean indicating if the link is external (starts with 'http' or 'www')

The links are displayed in a table format with the following features:
- Sortable columns (click on column headers to sort)
- Search functionality to filter links by label, link, or section
- Edit and delete buttons for each link
- Add button to create new links

To add a new link:
1. Click the "+" button at the bottom of the table
2. Fill in the label, link, and section fields
3. Click the check icon to save or the X icon to cancel

To edit a link:
1. Click the edit icon (pencil) next to the link
2. Modify the fields
3. Click the check icon to save or the X icon to cancel

To delete a link:
1. Click the delete icon (trash) next to the link

To search links:
1. Use the search box at the top of the table
2. Type any text to filter links by label, link, or section
3. The table updates in real-time as you type

To sort links:
1. Click on any column header to sort by that column
2. Click again to reverse the sort order
3. The current sort column is indicated by an up/down arrow icon

The links are stored in the browser's localStorage, so they will persist between sessions. The links are specific to each org, so you can have different links for different orgs.

<img width="278" alt="Custom Link Search" src="https://github.com/user-attachments/assets/5ccd6778-4fb2-46d5-9b54-cd47cb03c7bb" />

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


## Delete All Apex Logs

Sometimes you need to purge the ApexLogs from you org, mostly when the maximum size limit is reached.
You can now delete all apex logs with a simple click. From the popup, select 'Org' tab and click 'Delete All ApexLogs' button.

<img width="278" alt="Delete All Apex Logs" src="https://github.com/user-attachments/assets/7ba32e4d-1fdd-43e7-89cd-9c480c913211" />


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


## Customize extension's shortcuts

Navigate to [chrome://extensions/shortcut](chrome://extensions/shortcut) and choose dedicated shortcuts for the pages you want.

<img width="660" alt="Use Chrome Shortcuts" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/382aea2d-5278-4dfe-89e6-6dcec4c724c9">

### Default shortcuts

If you want to open popup keyboard shortcuts, you can use the 'ctrl' (windows) or 'command' (mac) key with the corresponding key.
Example:

- Data <ins>E</ins>xport : e
- Data <ins>I</ins>mport : i
- Org <ins>L</ins>imits : l
- <ins>D</ins>ownload Metadata : d
- E<ins>x</ins>plore API : x

## Highlight PROD with a top border

Production environment are critical, to avoid confusion with other orgs, you can enable an option which will add a 2px border on the top of the Salesforce UI and also in the extension's pages.

Under `User Experience` tab, enable the option `Highlight PROD with a top border (color from favicon)`.

<img width="955" alt="highlight prod with a top border" src="https://github.com/user-attachments/assets/4ff26e23-08b2-447a-be8d-004488f2a3a1">


## Import / Export configuration (saved query etc.)

### With 1.25 and above
To export and import your current configuration, go to the options page and click the corresponding icon in the header:

<img width="889" alt="Import / Export Configuration" src="https://github.com/user-attachments/assets/00428039-9b83-4c14-9a27-5e5034c52753">

## Hide some buttons in the popup

Since the extension offers more features, the number of button is increasing.
Some of the users may don't need some of those, to make the popup lighter some of the buttons can be hidden:

<img width="1024" alt="Hide Buttons" src="https://github.com/user-attachments/assets/50b4cb3c-7886-4b38-96a9-b5a6d93b69e6">

## Switch user language from the popup

From the User tab in the popup, click on the user language flag to display the available languages.

![2024-12-04_16-07-35 (1)](https://github.com/user-attachments/assets/d07da946-dba0-4bb4-8f3b-313392bbf557)

## Default Popup Tab
You can configure which tab should be selected by default when opening the popup. To do this:
1. Open the options page
2. Go to the "User Experience" tab
3. Find the "Default Popup Tab" option
4. Select your preferred tab:
   - Object: Shows the SObject search and details
   - Users: Shows the user search and details
   - Shortcuts: Shows your configured shortcuts
   - Org: Shows organization information

The selected tab will be remembered and used as the default when opening the popup.

## Customize User Tab Search Filters and Fields

The User tab in the popup allows you to search for users across your Salesforce org. You can customize both the search fields used and apply filters to exclude certain types of users from the search results.

<img width="1386" alt="User Search Customization" src="https://github.com/user-attachments/assets/f325e7b8-5b2f-4ad2-80b4-63089c770eda" />

### Configuring Search Fields

By default, user searches look through Username, Email, Alias, and Name fields. You can customize which fields are searched by:

1. Open the extension and click the "Options" button
2. Navigate to the "User Experience" tab
3. Find the "User Default Search Fields" section
4. Check/uncheck the fields you want to include in searches:
   - **Username** - The user's unique username (default: enabled)
   - **Email** - The user's email address (default: enabled)
   - **Alias** - The user's alias (default: enabled)
   - **Name** - The user's full name (default: enabled)
   - **Profile Name** - Search by the user's profile name (default: disabled)

The search placeholder text in the User tab will automatically update to reflect which fields are currently enabled for searching.

### Applying Search Filters

You can exclude certain types of users from appearing in search results:

1. In the same "User Experience" tab in Options
2. Find the "Exclude users from search" section
3. Enable the filters you want to apply:
   - **Exclude Portal users** - Hides users who have portal access enabled
   - **Exclude Inactive users** - Hides users who are marked as inactive

## Generate a package.xml from a deployment

From a	DeployRequest record, click on the `Generate package.xml` button to download the package.xml for this deployment.
> [!NOTE]
> If you retrieve the related metadata it may have been modified since the deployment, so you are not sure to retrieve what was deployed.

<img width="1143" alt="Generate package.xml from a deployment" src="https://github.com/user-attachments/assets/4acb7422-0547-409d-9e23-d8c3176f8055" />

## Perform a field usage analysis for an SObject

The field usage analysis feature helps you understand which fields in your Salesforce org are actually being used by calculating the percentage of records that have values for each field.

### How to use

1. **Navigate to an SObject**: Select an SObject from the popup or navigate to any SObject page in Salesforce
2. **Open Show All Data**: Click the "Show all data" button to open the field inspection page
3. **Calculate Field Usage**: You have two options:
   - **Individual field**: Click on "Get field usage" link next to any field to calculate usage for that specific field only
   - **All fields**: Click on the refresh icon (🔄) in the "Usage (%)" column header to calculate usage for all fields at once
4. **View Results**:
   - Hover over any percentage to see the detailed breakdown (e.g., "1,247 / 5,000 records (25%)")
   - Required fields automatically show 100% usage
   - Fields that can't be analyzed (like textarea or address fields) will be empty
5. **Export Results**: Use the table settings menu (gear icon) to copy the table or download as CSV

### Important Notes

> **Warning**
> Field usage analysis uses Salesforce API calls and counts against your API request limits. For large orgs, consider using this feature in a copy of production to avoid hitting API limits.

- The feature uses Composite API to efficiently batch multiple field queries
- Loading indicators show when calculations are in progress
- Results are cached during your session for better performance
- Required fields (nillable = false) automatically show 100% usage without making API calls

### Use Cases

This feature is particularly useful for:
- Data cleanup projects
- Field deprecation planning
- Org optimization initiatives
- Documentation and audit requirements
- Understanding field adoption across your organization

![Smart Field Usage demo](https://github.com/user-attachments/assets/ef93bf3c-8737-4a21-b38b-ce4822f8b573)