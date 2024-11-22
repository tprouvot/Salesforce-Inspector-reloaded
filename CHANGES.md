# Release Notes

## Version 1.26

- Customize Data Export shortcuts (execute query and insert all fields name in query) [feature 653](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/653) in `chrome://extensions/shortcuts`
- Add [clientId](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_calloptions.htm) header param to identify the extension in EventLogFile [feature 504](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/504)
- Add Apex Classes metadata search in Shortcut tab and new option configuration for the search [feature 591](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/591) request by [mpekacki](https://github.com/mpekacki)
- Add `My Personal Information` shortcuts [feature 627](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/627) request by [Alfredo Chissotti](https://github.com/Astisme)
- Add compatibility for force.com domain for Sf internal orgs
- Restyle Org Limits [feature 626](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/626) request by [Vincent FINET](https://github.com/VinceFINET)
- Add new options to hide buttons in popup [feature 618](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/618)
- Added ability to set default height for the data export query editor [feature 656](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/656)

## Version 1.25

- Add metadata title on shortcut search [feature 639](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/639) request by [Tal-Fr](https://github.com/Tal-Fr)
- Fix `Use Favicon Color` option which was not working key [issue 634](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/634) raised by [Gary Woodhouse](https://github.com/Garywoo)
- Add `Clear` button in Event Monitor and REST Explorer
- Fix `Field Creator` shortcut key [issue 608](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/608)
- Add `Flow Trigger Explorer` in shortcut links [feature 610](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/610) request by [JeffKrakowski](https://github.com/JeffKrakowski)
- Add `Import` / `Export` configuration from Option page [feature 570](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/570)
- Add `Field Creator` page to bulk create fields from the extension (contribution by [Santiago Parris](https://github.com/SantiParris8))
- Add `Event Monitor` page to subscribe to Platform Events (contribution by [Antoine Leleu](https://github.com/AntoineLeleu-Salesforce))
- Hide "What's new banner" in incognito mode [feature 517](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/517)
- Persist selected tab when reloading Options page.
- Add button in Options page to reset API Version to extension's default [feature 541](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/541)
- Enable Salesforce Inspector Reloaded on Debug flow page [feature 552](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/552) request by [Andrew Russo](https://github.com/mavtron-andrewrusso)
- Add option to highlight PROD with a 2px top border
- Add response time in REST Explore [issue 539](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/539)
- Add autocomplete feature for REST Explore page
- Add option to increase the number of saved & history query in data export
- Enable Salesforce Inspector Reloaded on Experience Builder and add compatibility for custom favicon
- Add option to colorize sandbox banner in the same color as the favicon [doc](https://tprouvot.github.io/Salesforce-Inspector-reloaded/how-to/?h=favico#customize-sandbox-banner-color)
- Add "Object Access" link in Object popup tab to display Object permission details (Winter 25 feature)
- Fix Platform Event links on popup [issue 500](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/500)

## Version 1.24

- Add new `REST Explore` page to call Salesforce APIs from the extension
- Add Global Search in Shortcut tab when no result was found
- Enable users to configure custom headers on Data Import (AssignmentRuleHeader, DuplicateRuleHeader, OwnerChangeOptions ...) [feature 478](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/478)
- Fix CustomSetting links in popup [issue 473](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/473) (contribution by [Boris Castellani](https://github.com/castellani))
- Support SOSL [feature 131](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/131) and GraphQL queries in Data Export
- Increase API version to 61 (Summer'24)
- Improve readability for screen readers ([feature 454](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/454) request by [Andrew Russo](https://github.com/mavtron-andrewrusso))
- Restrict autocomplete suggestion to SObject record type names in Data Export page (feature [442](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/442) by [Camille Guillory](https://github.com/CamilleGuillory))
- Add `Download CSV` button in data export page ([feature 101](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/101) requested by [Mickael Gudin](https://github.com/mickaelgudin))
- Customize extension's pages shortcuts in [chrome://extensions/shortcuts](chrome://extensions/shortcuts) ([feature 171](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/171) by [asanaEAzimzhanov](https://github.com/asanaEAzimzhanov))
- Add option to exclude formula fields from data export autocomplete [feature 415](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/415)
- Removes whitespace from both ends in user search [feature 410](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/410) (contribution by [César Blanco](https://github.com/cesarblancg))
- Add setup menu items `Trusted URLs` and `Trusted URL and Browser Policy Violations` to shortcut links
- Ability to quit popup with escape button [feature 378](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/378) (contribution by [Gerald Gramier](https://github.com/gramier))
- Add option to customize org favicon [feature 180](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/180)
- Add tooltip to options [feature 399](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/399) (contribution by [Nathan Shulman](https://github.com/nshulman))
- Fixed popup button disappearance at 100%, also changed horizontal orientation to start at left [issue 404](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/404) (contribution by [Nathan Shulman](https://github.com/nshulman))
- Add a button to login-as a user in an new incognito window [issue 381](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/381) (contribution by [Alan Jaouen](https://github.com/alanjaouen))
- Add option to hide object name columns in query results from Data Export page [feature 352](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/352) (contribution by [Guillaume Fauritte](https://github.com/guillaumeSF))

## Version 1.23

- Add new [setup pages](https://help.salesforce.com/s/articleView?id=release-notes.rn_general_setup_domain_prepare.htm&release=246&type=5) domain [feature 389](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/389) (by [akalatksy](https://github.com/akalatksy))
- Add "View summary" link on User tab [feature 386](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/386)
- Add option to hide `Delete Records` button from Data Export page
- Fix popup not closing in inspect page [issue 159](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/159) (contribution by [Luca Bassani](https://github.com/baslu93))
- On inspect page, when double clicking on a picklist field, iterate through available values [feature 366](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/366)
- Integrate Experience Cloud builder link to shortcut search in popup [feature 365](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/365)
- Add `Flow Versions` button in popup when recordId is a flow [feature 362](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/362)
- Format relations as expected in import process [feature 26](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/26) (contribution by [Olivier Dufour](https://github.com/dufoli))
- Ability to choose header theme [feature 294](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/294)
- Add query template customization in Option page [feature 349](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/349)
- Add an option to enable / disable SObject context on data export [issue 341](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/341)
- Remove Consumer key input from data export [issue 338](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/338)
- Customize extension's favicon [feature 197](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/197)
- Save default batch size and thread for data import [feature 329](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/329) (feature request by [ritterblau](https://github.com/ritterblau))
- Load recently viewed records on popup [feature 321](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/321)
- Open documentation when installing the extension [feature 322](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/322)
- Add Query Plan to data export [feature 314](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/314)
- Align show-all data 'Type' column with Salesforce's 'Data Type' field [issue 312](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/312) by [efcdilascio](https://github.com/efcdilascio)
- Make data export suggestions scrollable [feature 301](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/301) by [Vranisimo](https://github.com/vranisimo)
- Show the number of filtered records in data export [feature 300](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/300) by [Vranisimo](https://github.com/vranisimo)
- Hide RecType and Name field from popup when field is not set [feature 298](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/298)
- Display API version in Org tab [feature 293](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/293) (feature by [Camille Guillory](https://github.com/CamilleGuillory))
- Add the possibility to hide fields API names after users clicked "Show fields API names"
- Add performance On data export with option to disable in Options/Data Export tab (contribution by [Nathan Shulman](https://github.com/nshulman))
- Clean up popup header and footer (contribution by [Nathan Shulman](https://github.com/nshulman))
- Fix double "Show all data" button [issue 63](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/63) (contribution by [Luca Bassani](https://github.com/baslu93))
- Enhanced the user interface with a subtle inline "copied" indicator for field copy actions [feature 351](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/351) (contribution by [dyncan](https://github.com/dyncan))

## Version 1.22

- Add AlertBanner component for Alerts following [SLDS guidelines](https://www.lightningdesignsystem.com/components/alert/) (contribution by [Nathan Shulman](https://github.com/nshulman))
- Add info banner when extension is updated and convert "Generate token" button to alert. [feature 51](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/51) (contribution by [Nathan Shulman](https://github.com/nshulman))
- Add "Hide fields API names" when users clicked "Show fields API names"
- Add "Enable Logs" button in the User tab [feature 245](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/245) (contribution by [Antoine Leleu](https://github.com/AntoineLeleu-Salesforce))
- Add default connected app setting and improve access token renew flow. Note: Due to the simplified redirect url, this is a BREAKING CHANGE for users who have created their own connected app: those users MUST update their connected app Callback URL to the new value before they can use this version of the extension (contribution by [Mehdi Cherfaoui](https://github.com/mehdisfdc))
- Allow users to define REST callout headers on showAllData page. The need is to prevent the auto assignation of Accounts, Cases and Leads. [feature 198](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/198) (issue by [SfdxDieter](https://github.com/SfdxDieter))
- Fix flow scrollability] checkbox on non dev environments [issue 258](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/258) (by [Samuel Krissi](https://github.com/samuelkrissi))
- Fix 'Record Type not displayed' in popup [issue 255](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/255)
- Add "Options" page to manage local storage variables directly from the UX. Allow to reposition the popup button [feature 145](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/145) (contribution by [Pietro Martino](https://github.com/pietromartino))
- Bugfix Delete button does not check for 'toolingApi' parameter [issue 254](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/254) (contribution by [Oscar Gomez Balaguer](https://github.com/ogomezba))
- Add Apex classes documentation in shortcut [feature 247](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/247)
- Disable "Delete records" button when a query returns more than 20k records [feature 251](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/251)
- Automatically request SObject type for data import and SObject record id for data export [feature 45](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/45) SObject record (#45)) (contribution by [Olivier Dufour](https://github.com/dufoli))
- Add support to Hyperforce China Organizations [PR141](https://github.com/tprouvot/Salesforce-Inspector-reloaded/pull/141) (contribution by [Yaacov Elbaz](https://github.com/yaacov9))

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
- Add `Login As` button for Experience users [feature 190](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/190)
- Add `Delete Records` button from data export page [feature 134](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/134) (contribution by [Oscar Gomez Balaguer](https://github.com/ogomezba))
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
- Add `LIMIT 200` when selecting `FIELDS(` in autocomplete [feature 146](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/146) )
- Change method to get extension id to be compatible with firefox [issue 137](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/137) (issue by [kkorynta](https://github.com/kkorynta))
- Fix hardcoded browser in Generate Token url [issue 137](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/137) (issue by [kkorynta](https://github.com/kkorynta))
- Add `Create New Flow`, `Create New Custom Object`, `Create New Permission Set`, `Create New Custom Permission` and `Recycle Bin` shortcuts
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
- Implement OAuth2 flow to generate access token for connected App

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
