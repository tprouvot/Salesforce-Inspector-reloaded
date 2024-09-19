# Popup

## Details options and features for the popup

## Menu

In the bottom of the popup, you'll find the buttons to access to the extension's pages.

### Keyboard shortcut

Example:

- Data <ins>E</ins>xport : e
- Data <ins>I</ins>mport : i
- Org <ins>L</ins>imits : l
- <ins>D</ins>ownload Metadata : d
- E<ins>x</ins>plore API : x
- Event <ins>M</ins>onitor : m
- <ins>F</ins>ield Creator : f

If you want to open those shortcuts in a new tab, you can use the 'ctrl' (windows) or 'command' (mac) key with the corresponding key.

In the popup's footer, you can find:
- The extension's version with the link to the release note.
- The API version (updatable)
- The default shortcut to open the popup from the keyboard
- Info icon which redirect to the documentation website
- The cog icon to access the option page

#### Update API Version

Since the plugin's api version is only updated when all productions have been updated to the new release, you may want to use the latest version during preview windows.

> [!IMPORTANT]
> When you manually update the API version, it won't be overridden by extension future updates.

![2023-11-10_09-50-55 (1)](https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/6ae51a29-9887-41a6-8148-d9e12c2dc10d)


In the top part of the popup, you'll fin the tabs and related features:

### Object tab

### Users tab

#### Enable debug logs

Sometimes you may want to enable logs for a particular user.
From User tab, click the "Enable Log" button.

By default, this will enable logs with level "SFDC_DevConsole" for 15 minutes.

<img width="279" alt="Enable Log button" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/e87d2ed6-5c21-4e03-8fb1-16e3bc6121f3">

You can update the debug level (configuration is per organization) and duration (for all organizations) on the Options page.

<img width="788" alt="DebugLog Options" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/assets/35368290/f7aa5680-742a-4581-ad29-770089d2b55e">

> **Warning**
> Increasing the default duration may lead to a high volume of logs generated.


### Shortcut tab

#### Disable metadata search from Shortcut tab

By default when you enter keyword in the Shortcut tab, the search is performed on the Setup link shortcuts _AND_ metadata (Flows, PermissionSets and Profiles).
If you want to disable the search on the metadata, update related option:

<img width="892" alt="image" src="https://github.com/user-attachments/assets/2541fc22-9f1b-4cd1-90cd-d4615b313d96">

#### Add custom links to "Shortcut" tab

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

### Org tab
