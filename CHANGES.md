# Release Notes

## Version 1.22

- Fix flow scrollability] checkbox on non dev environments [issue 258](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/258) (by [Samuel Krissi](https://github.com/samuelkrissi))
- Fix 'Record Type not displayed' in popup [issue 255](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/255)
- Add "Options" page to manage local storage variables directly from the UX. Allow to reposition the popup button [feature 145](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/145) (contribution by [Pietro Martino](https://github.com/pietromartino))
- Bugfix Delete button does not check for 'toolingApi' parameter [issue 254](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/254) (contribution by [Oscar Gomez Balaguer](https://github.com/ogomezba))
- Add Apex classes documentation in shortcut [feature 247](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/247)
- Disable "Delete records" button when a query returns more than 20k records [feature 251](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/251)
- Automatically request SObject type for data import and SObject record id for data export [feature 45](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/45) SObject record (#45)) (contribution by [Olivier Dufour](https://github.com/dufoli))
- Add support to Hyperforce China Organizations [PR141](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/141) (contribution by [Yaacov Elbaz](https://github.com/yaacov9))
- Add "Enable Logs" button in the User tab [issue 245](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/245)

## Version 1.21

- Add support for upserting and deleting Custom Metadata (contribution by [Joshua Yarmak](https://github.com/toly11))
- Add "Org" tab to display org and instance information (contribution by [Victor Garcia Zarco](https://github.com/victorgz))
- Undelete records from data import page [feature 193](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/193)
- Create new records from SObject tab ("New" button) [feature 226](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/226)
- Enhance shortcut search to include any part of the shortcut title, not only the beginning (contribution by [Joshua Yarmak](https://github.com/toly11))
- Org instance in not correct with after Hyperforce migration: store org instance in sessionStorage to retrieve it once per session [issue 167](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/167)
- Add Salesforce SObject documentation links [feature 219](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/219) (idea by Antoine Audollent)
- Add centering buttons section in footer after edit field (contribution by [Kamil Gadawski](https://github.com/KamilGadawski))
- Add dynamic display text show/hide borders table popup in record field preview setting (contribution by [Kamil Gadawski](https://github.com/KamilGadawski))
- Add "Download" option on event log files (contribution by [Annubis45](https://github.com/Annubis45))
- Fix 'Custom Object Name Links Don't Work' in popup [issue 218](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/218) (contribution by [Jeferson Chaves](https://github.com/JefersonChaves))
- Show field API Name on Record Page [PR202](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/202) (contribution by [Mouloud Habchi](https://github.com/MD931))
- Add support for domains protected by Microsoft Defender for Cloud Apps [issue 234](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/234) (contribution by [Mehdi Cherfaoui](https://github.com/mehdisfdc))

## Version 1.20.1

- Bugfix Delete Button not enabled when only one record is queried/filtered (contribution by [Oscar Gomez Balaguer](https://github.com/ogomezba))

- Bugfix User selection not displaying information (for orgs without community enabled) [issue 211](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/211)

## Version 1.20

- Move popup arrow icon in Flow Builder because of Winter 24 UI changes [feature 200](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/200)
- Add 'Login As' button for Experience users [feature 190](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/190)
- Add 'Delete Records' button from data export page [feature 134](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/134) (contribution by [Oscar Gomez Balaguer](https://github.com/ogomezba))
- Update popup title to show "Salesforce Inspector Reloaded" [feature 188](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/188) (idea by [Nicolas Vuillamy](https://github.com/nvuillam))
- Add "Query Record" link from data-export page [feature 111](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/111) (contribution by [Antoine Leleu](https://github.com/AntoineLeleu-Salesforce))
- Fix "Edit page layout link" for from show all data and use "openLinksInNewTab" property for those links [issue 181](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/181)
- Update to Salesforce API v 59.0 (Winter '24)
- Add a parameter to activate summary view of pset / psetGroup from shortcut tab [feature 175](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/175)
- Display record name (and link) in popup [feature 165](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/165)
- Add documentation link to popup
- Add option to open extension pages in a new tab using keyboard shortcuts (contribution by [Joshua Yarmak](https://github.com/toly11))
- Add customizable query templates to query export page (idea and co-develop with [Samuel Krissi](https://github.com/samuelkrissi))
- Explore-api page restyling
- Ability to define csv-file separator [feature 144](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/144) (issue by [Reinier van den Assum](https://github.com/foxysolutions))
- Fix SObject auto detect for JSON input in data import
- "Lightning Field Setup" (from show all data) link did not work for CustomMetadataType and CustomSettings [issue 154](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/154) (issue by [Camille Guillory](https://github.com/CamilleGuillory))
- Add missing Date Literals [feature 155](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/155)
- Allow navigation to the extension tabs (Object, Users, Shortcuts) using keyboard [feature 135](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/135) (feature by [Sarath Addanki](https://github.com/asknet))
- Update query on EntityDefinition to avoid missing objects for large orgs [issue 138](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/138) (issue by [AjitRajendran](https://github.com/AjitRajendran))
- Add 'LIMIT 200' when selecting 'FIELDS(' in autocomplete [feature 146](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/146) )
- Change method to get extension id to be compatible with firefox [issue 137](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/137) (issue by [kkorynta](https://github.com/kkorynta))
- Fix hardcoded browser in Generate Token url [issue 137](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/137) (issue by [kkorynta](https://github.com/kkorynta))
- Add "Create New Flow", "Create New Custom Object", "Create New Permission Set", "Create New Custom Permission" and "Recycle Bin" shortcuts
- Update pop-up release note link to github pages
- Detect SObject on list view page [feature 121](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/121) (idea by [Mehdi Cherfaoui](https://github.com/mehdisfdc))
- Automate test setup manual step of contact to multiple accounts [Aidan Majewski](https://github.com/aimaj)
- In Data export, set input focus in SOQL query text area. [feature 183](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/183) (contribution by [Sarath Addanki](https://github.com/asknet))

## Version 1.19

- Inspect Page Restyling (UI improvements, red background for PROD, display / hide table borders) [PR105](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/105) (contribution by [Pietro Martino](https://github.com/pietromartino))
- Navigate to record detail (Flows, Profiles and PermissionSet) from shortcut search [feature 118](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/118)
- Fix country codes from LocalSidKey convention [PR117](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/117) (contribution by [Luca Bassani](https://github.com/baslu93))
- Use custom shortcuts [feature 115](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/115)
- Add Export Query button [feature 109](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/109) (idea by [Ryan Sherry](https://github.com/rpsherry-starburst))
- Add permission set group assignment button from popup [feature 106](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/106)

## Version 1.18

- Update to Salesforce API v 58.0 (Summer '23)
- Restyle popup with SLDS (Salesforce Lightning Design System) [feature 9](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/9) (idea by [Loïc BERBEY](https://github.com/lberbey), contribution by [Pietro Martino](https://github.com/pietromartino))
- Fix "Show all data" shortcut from popup [issue 96](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/96) (fix by [Pietro Martino](https://github.com/pietromartino))

## Version 1.17

- Add toLabel function among autocomplete query suggestions [feature 90](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/90) (idea by [Mickael Gudin](https://github.com/mickaelgudin))
- Update spinner on inspect page when loading or saving records and disable button [feature 69](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/69) (idea by [Camille Guillory](https://github.com/CamilleGuillory))
- Show "Copy Id" from Inspect page [feature 12](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/12)
- Add a configuration option for links to open in a new tab [feature 78](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/78) (idea by [Henri Vilminko](https://github.com/hvilminko))
- Import data as JSON [feature 75](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/75) (idea by [gaelguimini](https://github.com/gaelguimini))
- Fix auto update action on data import [issue 73](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/73) (issue by [Juul1](https://github.com/Juul1))
- Restore focus on suggested fields when pressing tab key in query editor [issue 66](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/66) (idea by [Enrique Muñoz](https://github.com/emunoz-at-wiris))
- Update shortcut indication for mac users
- Fix links for custom object [PR80](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/80) (contribution by [Mouloud Habchi](https://github.com/MD931))
- Fix links for custom setting [PR82](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/82) (contribution by [Mouloud Habchi](https://github.com/MD931))

## Version 1.16

- Select "Update" action by default when the data paste in data-import page contains Id column [feature 60](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/60) (idea by Bilel Morsli)
- Allow users to update API Version [feature 58](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/58)
- Add org instance in the popup and a link to Salesforce trust status website [feature 53](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/53) (idea by [Camille Guillory](https://github.com/CamilleGuillory) )
- Fix saved query when it contains ":" [issue 55](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/55) (bug found by [Victor Garcia](https://github.com/victorgz/) )

## Version 1.15

- Add "PSet" button to access user permission set assignment from User tab [feature 49](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/49)
- Add shortcut tab to access setup quick links [feature 42](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/42)

## Version 1.14

- Add checkbox in flow builder to give the possibility to the user to scroll on the flow (by [Samuel Krissi](https://github.com/samuelkrissi))

![image](https://user-images.githubusercontent.com/96471586/226161542-cbedec0a-8988-4559-9152-d067ea6f9cb6.png)

- Fix links (object fields and object list) for custom metadata objects [issue 39](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/39)
- Add shortcut link to object list from popup (idea by [Samuel Krissi](https://github.com/samuelkrissi) )
- Add shortcuts links to (list of record types, current SObject RecordType and objet details, show all data from user tab) from popup [feature 34](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/34)
- Update manifest version from [v2](https://developer.chrome.com/docs/extensions/mv3/mv2-sunset/) to v3
- Auto detect SObject on import page when posting data which contain SObject header [feature 30](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/30)
- Update to Salesforce API v 57.0 (Spring '23)
- [Switch background color on import page to alert users that it's a production environnement](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/20)
- Implement Auth2 flow to generate access token for connected App

## Version 1.13

- [Automatically remove spaces from column name in import](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/23)
- Update to Salesforce API v 56.0 (Winter '23)
- Add "Skip all unknown fields" to import page
- Add User Id to pop-up
- Support Enhanced Domain [issue #222](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/issues/222) from [PR223](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/pull/223)
- [Add inactive users to search result](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/21)
- Update to Salesforce API v 55.0 (Summer '22)
- Update to Salesforce API v 54.0 (Spring '22)
- [Sticked table header to the top on export](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/10)
- Update to Salesforce API v 53.0 (Winter '22)
- Add label to saved query and sort list.
- Remove extra comma when autocomplete query in data export, or select a field from suggested fields just before 'FROM' keyword.
- Add "Copy Id" option when clicking on a SObject field or Id in data export page.
- Integrate UI updates from [Garywoo's fork](https://github.com/Garywoo/Chrome-Salesforce-inspector)
