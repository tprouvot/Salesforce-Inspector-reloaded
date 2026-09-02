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
4. Flow Enablement
   * Check the `Enable Authorization Code and Credentials Flow` and then check `Require user credentials in the POST body for Authorization Code and Credentials Flow`
5. Configure Security settings:
   * **IMPORTANT: Deselect** (disable) `Require secret for Web Server Flow`.
   * Select (enable) `Require Proof Key for Code Exchange (PKCE) extension for Supported Authorization Flows`.
6. Get Consumer Key and save it in the Options page

    <img alt="Option button" width="276" alt="image" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/14cc8aac-5ffc-4747-9da1-ba892231ace1">

7. Enter the consumer key

    <img alt="Client Id" width="849" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/b1edfea1-5a56-4f42-8945-e452a7ab5cf5">

8. Refresh page and generate new token

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

* Data <ins>E</ins>xport : e
* Data <ins>I</ins>mport : i
* Org <ins>L</ins>imits : l
* <ins>D</ins>ownload Metadata : d
* E<ins>x</ins>plore API : x
* Event <ins>M</ins>onitor : m
* <ins>F</ins>ield Creator : f

## Shortcut tab search

By default when you enter a keyword in the Shortcut tab, the search is performed on the Setup link shortcuts _AND_ metadata (Flows, Profiles, Permission Sets and Apex Classes).

Metadata search can be slow on orgs with a lot of metadata. Use search prefixes to narrow the scope and speed up results:

| Prefix             | Scope                                   | Example                 |
|--------------------|-----------------------------------------|-------------------------|
| _(none)_           | Setup links + metadata (default)        | `profiles`              |
| `/`                | Setup / custom links only (no API call) | `/profiles`             |
| `!`                | All metadata types                      | `!MyMetadata`           |
| `!flow`            | Flows only                              | `!flow Onboarding`      |
| `!profile`         | Profiles only                           | `!profile System`       |
| `!class` / `!apex` | Apex Classes only                       | `!class AccountService` |
| `!perm` / `!pset`  | Permission Sets only                    | `!perm Sales`           |

Notes:

* Prefix type aliases are case-insensitive (`!Profile`, `!FLOW`, etc.).
* Typed metadata prefixes (`!flow`, `!profile`, …) always query that metadata type, even if it is unchecked under **Searchable metadata from Shortcut tab**.
* Metadata queries still require at least 2 characters after the prefix (for example `!flow Ab`).
* `/` is local-only and is the fastest way to find a Setup page from the built-in / custom shortcut list.

### Disable metadata search from Shortcut tab

If you want to disable metadata search for the default (unprefixed) queries, update related option:

<img width="892" alt="image" src="https://github.com/user-attachments/assets/2541fc22-9f1b-4cd1-90cd-d4615b313d96">

## Compare Flow Versions

Salesforce Inspector Reloaded provides quick access to Salesforce's Flow Compare feature, allowing you to visually compare different versions of a flow side-by-side in the Flow Builder.

### What is Flow Compare?

Flow Compare is a Salesforce feature (available from Winter '26) that enables you to:

* View two flow versions side-by-side
* Identify differences between versions visually
* Understand what changed between versions
* Review changes before deploying or activating a flow

For more details, see the [official Salesforce documentation](https://help.salesforce.com/s/articleView?id=release-notes.rn_automate_flow_mgmt_compare_versions.htm&release=258&type=5).

### How to Access Flow Compare

1. Open Flow Builder
2. Open Salesforce Inspector Reloaded popup
3. Look for the **Flow Compare** button (appears when viewing a flow version)
4. Click the button to open Flow Builder with the compare view

### Using Flow Compare

Once Flow Builder opens:

1. The current flow version is automatically loaded
2. Use the version selector dropdown to choose a different version to compare against
3. Flow Builder will display both versions side-by-side, highlighting differences
4. Review changes, elements, and logic differences between the versions

## Mass disable flows

You can bulk deactivate flows using the Data Import feature with the Tooling API.

1. Open **Data Import** (shortcut: `i`)
2. Set **API Type** to **Tooling**
3. Set **Object** to **FlowDefinition**
4. Set **Action** to **Update**
5. Paste your data with two columns:
   * **Id** – the FlowDefinition Id (from a query like `SELECT Id, DeveloperName FROM FlowDefinition WHERE ActiveVersionId != null`)
   * **Metadata.activeVersionNumber** – set to `0` to deactivate
6. Map the columns (use "Skip" for any unknown columns if needed)
7. Click **Run Update**

## Add custom links to "Shortcut" tab

<img width="1234" alt="Use custom shortcuts" src="https://github.com/user-attachments/assets/036045b8-133c-46c1-90d0-1db7aa81a190" />

You can add custom links to the "Shortcut" tab. By default, links are org-specific and stored in the `sfHost + "_orgLinks"` localStorage variable. The links are stored as a JSON array with the following properties:

* `label`: The label of the link
* `link`: The link to the page
* `section`: The section where the link will be displayed
* `isExternal`: A boolean indicating if the link is external (starts with 'http' or 'www')

The links are displayed in a table format with the following features:

* Sortable columns (click on column headers to sort)
* Search functionality to filter links by label, link, or section
* Edit and delete buttons for each link
* Add button to create new links
* A "Global" toggle to share a link across every org instead of keeping it specific to the current org

### Global links

Each link has a "Global" toggle. When it's off (the default), the link is specific to the current org and stored under `sfHost + "_orgLinks"`. When it's turned on, the link is moved into a single shared `globalLinks` localStorage variable (not prefixed by org) and becomes visible in every org's Shortcut tab and popup search.

Because `globalLinks` is a single list shared by all orgs, editing or deleting a global link from any org's Options page affects what every other org sees. Toggling the flag back off moves the link back into the current org's own list.

To add a new link:

1. Click the "+" button at the bottom of the table
2. Fill in the label, link, and section fields
3. Optionally turn on the "Global" toggle to make the link visible in every org
4. Click the check icon to save or the X icon to cancel

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

### Switch between Lightning apps

You can add custom shortcuts to jump directly to any Lightning app — no more navigating through the App Launcher.

In Lightning, each app has a URL you can find in the browser by copying the link. Use that relative path as the **Link** value when creating a shortcut.

<img width="1325" height="454" alt="Custom shortcuts configuration for switching apps" src="https://github.com/user-attachments/assets/a0e8a68d-5e0e-4f6f-83ad-5c118eea1c6f" />

Once configured, the shortcuts appear in the popup and can be triggered by typing their label in the search box:

<img width="278" height="702" alt="Switching apps from the shortcut tab" src="https://github.com/user-attachments/assets/23c6f67f-16a1-406a-b443-2a67a2ee889e" />

### Switch between Classic and Lightning

Use the following relative URLs to switch between Salesforce Classic and Lightning Experience:

* **Switch to Lightning**: `/user/switchToLightning`
* **Switch to Classic**: `/user/switchToClassic`

Create one shortcut for each, give them descriptive labels (e.g. `Switch to Lightning` / `Switch to Classic`), and you can toggle between the two UIs in one click from the Shortcuts tab.

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

## Enable API Call Debug Statistics

Sometimes we may want to know which queries are performed to the Salesforce backend (by type, method, endpoint ...)
This can help to correlate logs in Salesforce and what is performed by Salesforce Inspector Reloaded extension

## Customize extension's favicon

From the option page, you can customize the default favicon by:

* a predefined color name among [those values](https://www.w3schools.com/tags/ref_colornames.asp) or any HTML color code you want (ie `#FF8C00`).
* a custom favicon url (ie "<https://stackoverflow.com/favicon.ico>")

The customization is linked to the org, it means you can have different colors for DEV and UAT env for example.

<img width="878" alt="image" src="https://github.com/user-attachments/assets/fdf24a37-2cab-402e-a101-4a20bc4e1ae4">

Now if you want to populate all the orgs you visited with a custom favicon, you have two options:

* Smart mode enabled: this will analyze your environment name and populate a favicon based on this (blue for dev, green for int, purple for uat and orange for full)
* Random: this will choose a random color among all the predefined colors

Then you click on Populate All and that's it!
Note: orgs with an existing customized favicon won't be affected.

## Customize sandbox banner color

From the option page, enable "Use favicon color on sandbox banner"
<img width="772" alt="image" src="https://github.com/user-attachments/assets/28cb7f5f-01fd-48b9-a5da-f50f6cbb2f81">

<img width="1087" alt="image" src="https://github.com/user-attachments/assets/f90999c2-f93e-423a-bcb7-18a8aa717a17">

## Customize extension's shortcuts

Navigate to your browser shortcut menu and choose dedicated shortcuts for the pages you want.

* Chrome: [chrome://extensions/shortcut](chrome://extensions/shortcut)
* Edge: [edge://extensions/shortcuts](edge://extensions/shortcuts)

<img width="660" alt="Use Chrome Shortcuts" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/382aea2d-5278-4dfe-89e6-6dcec4c724c9">

### Default shortcuts

If you want to open popup keyboard shortcuts, you can use the 'ctrl' (windows) or 'command' (mac) key with the corresponding key.
Example:

* Data <ins>E</ins>xport : e
* Data <ins>I</ins>mport : i
* Org <ins>L</ins>imits : l
* <ins>D</ins>ownload Metadata : d
* E<ins>x</ins>plore API : x

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
   * Object: Shows the SObject search and details
   * Users: Shows the user search and details
   * Shortcuts: Shows your configured shortcuts
   * Org: Shows organization information

The selected tab will be remembered and used as the default when opening the popup.

## Show recently viewed records in popup

When you focus the Object search field in the popup, the extension queries and displays your recently viewed records for quick access. This is **enabled by default**. The option allows you to disable it if you prefer not to query or display recently viewed records:

1. Open the options page
2. Go to the "User Experience" tab
3. Find the "Show recently viewed records in popup" toggle
4. Disable it to skip the query and only show search results as you type

When disabled, no API call is made to the RecentlyViewed object, which can reduce API usage and improve popup responsiveness.

## API Cache Configuration

Salesforce Inspector Reloaded uses a caching system to reduce the number of API calls made to Salesforce, improving performance and reducing API usage. The extension caches API response data to optimize queries and avoid unnecessary API requests.

All cache settings are configured in the **Cache** tab of the Options page:

1. Open the extension and click the "Options" button
2. Navigate to the "Cache" tab

### Cached Requests

The following API requests are cached:

* **User Field Names** (`/services/data/vXX.0/sobjects/User/describe`) - Caches field permission information to optimize user search queries and dynamically build SELECT clauses based on accessible fields

* **SObjects List** - Caches the list of all SObjects (standard and custom objects, tooling objects) from the REST API and Tooling API

### Why Use Caching?

* **Reduced API Calls**: Caching means the extension doesn't need to call the describe API every time you search for users or load the SObjects list
* **Better Performance**: Faster user searches and popup loading since cached data is retrieved instantly
* **Optimized Queries**: The extension builds queries dynamically based on cached field permissions
* **API Limit Preservation**: Helps preserve your Salesforce API request limits by avoiding redundant API calls

### User Field Names Cache

Configure the duration (in hours) for caching User field names. Default: 168 hours (7 days). Use the "Clear Cache" button to immediately refresh cached data.

## SObjects List Cache Management

The SObjects list cache stores the list of all available objects in your org (Account, Contact, custom objects, Tooling API objects, etc.). This improves popup loading performance by avoiding API calls every time you open the extension or access the Objects tab.

### How It Works

* **When cache is enabled**: The extension returns cached data immediately and optionally refreshes it in the background (see below)
* **When cache is disabled**: A fresh fetch is performed each time the SObjects list is needed
* **Org-specific**: Each Salesforce org has its own cache; switching orgs automatically uses the correct cache

### Cache Behavior

The behavior depends on two options:

| Preload SObjects      | Cache Duration                  | Behavior                                                                                                                                                         |
|-----------------------|---------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Enabled** (default) | Recommended: 8 hours            | SObjects list is loaded from cache before the popup opens. Refresh happens every N hours when the popup is opened.                                               |
| **Disabled**          | Recommended: 168 hours (7 days) | SObjects list loads only when the Objects tab is accessed. Cached data is returned immediately; a background refresh updates the cache when the popup is opened. |

> **Note**
> "Preload SObjects before popup opens" is in the **API** tab of Options. When enabled, the extension preloads the SObjects list for faster context detection (e.g., knowing which object you're viewing). When disabled, the list loads only when you open the Objects tab.

### Configuring SObjects Cache

1. Open the extension and click the "Options" button
2. Navigate to the "Cache" tab
3. Find the "SObjects List Cache" section:
   * **Enable/Disable**: Toggle caching on or off (enabled by default)
   * **Duration (hours)**: How long cached data remains valid. Default: 8 hours. Minimum: 1 hour
   * **Clear Cache**: Click to immediately clear the cache and force a fresh fetch on next use

### When to Clear the Cache

Clear the SObjects List cache when:

* A newly created custom object doesn't appear in the extension's object search
* You've deployed new objects or made metadata changes
* You want to ensure you're seeing the latest object list

> **Note**
> Cache entries expire automatically based on the configured duration. After expiration, the extension fetches fresh data on the next popup open or Objects tab access.

## Customize User Tab Search Filters and Fields

The User tab in the popup allows you to search for users across your Salesforce org. You can customize both the search fields used and apply filters to exclude certain types of users from the search results.

<img width="1386" alt="User Search Customization" src="https://github.com/user-attachments/assets/f325e7b8-5b2f-4ad2-80b4-63089c770eda" />

### Configuring Search Fields

By default, user searches look through Username, Email, Alias, and Name fields. You can customize which fields are searched by:

1. Open the extension and click the "Options" button
2. Navigate to the "User Experience" tab
3. Find the "User Default Search Fields" section
4. Check/uncheck the fields you want to include in searches:
   * **Username** - The user's unique username (default: enabled)
   * **Email** - The user's email address (default: enabled)
   * **Alias** - The user's alias (default: enabled)
   * **Name** - The user's full name (default: enabled)
   * **Profile Name** - Search by the user's profile name (default: disabled)

The search placeholder text in the User tab will automatically update to reflect which fields are currently enabled for searching.

### Applying Search Filters

You can exclude certain types of users from appearing in search results.
Because the IsPortalEnabled field does not exist in orgs where there is no portal, we made this option org specific.

1. In the same "User Experience" tab in Options
2. Find the "Exclude users from search" section
3. Enable the filters you want to apply:
   * **Exclude Portal users** - Hides users who have portal access enabled
   * **Exclude Inactive users** - Hides users who are marked as inactive

### Dynamic Popup Height

You can leverage more window height in the popup, to reduce the scroll. To enable this feature, go to User Experience -> Enable Dynamic Popup Height and check it.

## Generate a package.xml from a deployment

From a DeployRequest record, click on the `Generate package.xml` button to download the package.xml for this deployment.
> [!NOTE]
> If you retrieve the related metadata it may have been modified since the deployment, so you are not sure to retrieve what was deployed.

<img width="1143" alt="Generate package.xml from a deployment" src="https://github.com/user-attachments/assets/4acb7422-0547-409d-9e23-d8c3176f8055" />

## Perform a field usage analysis for an SObject

The field usage analysis feature helps you understand which fields in your Salesforce org are actually being used by calculating the percentage of records that have values for each field.

### How to use

1. **Navigate to an SObject**: Select an SObject from the popup or navigate to any SObject page in Salesforce
2. **Open Show All Data**: Click the "Show all data" button to open the field inspection page
3. **Calculate Field Usage**: You have two options:
   * **Individual field**: Click on "Get field usage" link next to any field to calculate usage for that specific field only
   * **All fields**: Click on the refresh icon (🔄) in the "Usage (%)" column header to calculate usage for all fields at once
4. **View Results**:
   * Hover over any percentage to see the detailed breakdown (e.g., "1,247 / 5,000 records (25%)")
   * Required fields automatically show 100% usage
   * Fields that can't be analyzed (like textarea or address fields) will be empty
5. **Export Results**: Use the table settings menu (gear icon) to copy the table or download as CSV

### Important Notes

> **Warning**
> Field usage analysis uses Salesforce API calls and counts against your API request limits. For large orgs, consider using this feature in a copy of production to avoid hitting API limits.

* The feature uses Composite API to efficiently batch multiple field queries
* Loading indicators show when calculations are in progress
* Results are cached during your session for better performance
* Required fields (nillable = false) automatically show 100% usage without making API calls

### Use Cases

This feature is particularly useful for:

* Data cleanup projects
* Field deprecation planning
* Org optimization initiatives
* Documentation and audit requirements
* Understanding field adoption across your organization

![Smart Field Usage demo](https://github.com/user-attachments/assets/ef93bf3c-8737-4a21-b38b-ce4822f8b573)

## Use Agentforce to analyze formula fields

The Agentforce Helper feature provides AI-powered analysis and explanations for formula fields, helping you understand complex formulas, identify issues, and get recommendations for improvements.

### Prerequisites

> **Prerequisite**
> Agentforce needs to be enabled.
> The prompt FormulaHelper needs to be deployed in the org.

> **Note**
> The standard Salesforce 'Prompt Template User' permission is required to use this feature.

### How to use

1. **Navigate to an SObject**: Select an SObject from the popup or navigate to any SObject page in Salesforce
2. **Open Show All Data**: Click the "Show all data" button to open the field inspection page
3. **Access Agentforce Helper**: For any calculated/formula field:
   * Click the dropdown arrow (⋮) in the Actions column
   * Select "Agentforce Helper" from the menu
4. **Review the Analysis**: The modal will display:
   * Field metadata (name, type, formula expression)
   * A customizable prompt with your instructions
   * An "Analyze" button to generate the AI analysis
5. **Customize Instructions** (optional):
   * Click "Edit" to modify the prompt instructions
   * Add specific requirements or questions about the formula
   * Click "Reset" to restore default instructions
6. **View Results**: After clicking "Analyze", Agentforce will provide:
   * Plain language explanation of the formula
   * Step-by-step logic breakdown
   * Dependencies and referenced fields
   * Edge cases and potential issues
   * Best practices review and recommendations
   * Example calculations with sample data

### Configuration Options

#### Enable/Disable Agentforce Helper

You can control whether the Agentforce Helper link appears in the field actions menu:

1. Open the extension and click the "Options" button
2. Navigate to the "Show All" tab
3. Find the "Enable Agentforce Helper for formula fields" toggle
4. Enable or disable the feature as needed (enabled by default)

> **Note**
> When disabled, the "Agentforce Helper" link will not appear in the field actions menu for formula fields.

#### Customize Prompt Template

You can configure which AI prompt template is used for formula analysis:

1. In the same "Show All" tab in Options
2. Find the "Formula Helper Prompt Template Name" field
3. Enter the developer name of your custom prompt template (default: "FormulaHelper")

> **Important**
> The prompt template must exist in your Salesforce org as a GenAI Prompt Template and should be configured to accept two inputs: `Prompt` and `FieldMetadata`.

#### Customize Analysis Instructions

For each formula field analysis, you can customize the instructions:

1. Open the Agentforce Helper modal for any formula field
2. Click the "Edit" button to modify the instructions
3. Add or modify the analysis requirements
4. Your custom instructions are saved per org and will be used for future analyses
5. Click "Reset" at any time to restore the default instructions

### Use Cases

This feature is particularly useful for:

* **Understanding complex formulas**: Get plain-language explanations of intricate formula logic
* **Formula reviews**: Identify potential issues, edge cases, and best practice violations
* **Knowledge transfer**: Document formula behavior for team members
* **Formula optimization**: Get recommendations for improving formula efficiency
* **Troubleshooting**: Understand why a formula might not be working as expected
* **Modification planning**: Get guidance on how to safely modify existing formulas

## User Tab Toggle Reset Password button

This feature enables a **Reset Password** button on the **User Tab** page in Salesforce Inspector Reloaded. The button can be displayed **on or off** from the extension **Options** page.

### How it works

1. Open **Salesforce Inspector Reloaded**.
2. Navigate to the **Options** page.
3. Locate the **Enable Reset Password button on User Tab** option.
4. Toggle the option:

* **On** – the **Reset Password** button is displayed on the **User Tab**.
* **Off** – the **Reset Password** button is hidden.

<img width="2912" height="1230" alt="Rest Password option" src="https://github.com/user-attachments/assets/0de7deaa-5800-46ef-9af4-27cfed57efa7" />

When enabled, the **Reset Password** button appears while inspecting a User record and allows you to reset the user’s password directly from the User Tab, without navigating to Salesforce Setup.

<img width="278" height="126" alt="Reset password success" src="https://github.com/user-attachments/assets/377ea58f-d230-4d19-905e-987dce47a802" />

> **Note:** If the current session does not have sufficient permissions to access user information or perform a password reset, Salesforce returns an **INSUFFICIENT_ACCESS** error.

<img width="278" height="161" alt="Reset password error" src="https://github.com/user-attachments/assets/5814e9d5-f037-41af-8f84-1997ab539292" />
