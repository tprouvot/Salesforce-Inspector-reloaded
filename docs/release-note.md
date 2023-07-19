# Release Notes

##  Version 1.20
- Update pop-up release note link to github pages
- Detect SObject on listview page [feature 121](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/121) (idea by [Mehdi Cherfaoui](https://github.com/mehdisfdc))

##  Version 1.19

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

- Select "Update" action by default when the data paste in data-import page contains Id column [feature 60](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/60) (by Bilel Morsli)
- Allow users to update API ## Version [feature 58](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/58)
- Add org instance in the popup and a link to Salesforce trust status website [feature 53](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/53) (by [Camille Guillory](https://github.com/CamilleGuillory) )
- Fix saved query when it contains ":" [issue 55](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/55) (by [Victor Garcia](https://github.com/victorgz/) )

## Version 1.15

- Add "PSet" button to access user permission set assignment from User tab [feature 49](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/49)
- Add shortcut tab to access setup quick links [feature 42](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/42)

## Version 1.14

- Add checkbox in flow builder to give the possibility to the user to scroll on the flow (by [Samuel Krissi](https://github.com/samuelkrissi) )

![image](https://user-images.githubusercontent.com/96471586/226161542-cbedec0a-8988-4559-9152-d067ea6f9cb6.png)

- Fix links (object fields and object list) for custom metadata objects [issue 39](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/39)
- Add shortcut link to object list from popup (idea by [Samuel Krissi](https://github.com/samuelkrissi) )
- Add shortcuts links to (list of record types, current SObject RecordType and objet details, show all data from user tab) from popup [feature 34](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/34)
- Update manifest ## Version from [v2](https://developer.chrome.com/docs/extensions/mv3/mv2-sunset/) to v3
- Auto detect SObject on import page when posting data which contain SObject header [feature 30](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/30)
- Update to Salesforce API v 57.0 (Spring '23)
- [Switch background color on import page to alert users that it's a production environnement](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/20)
- Implement Auth2 flow to generate access token for connected App

## Version 1.13

- [Automatically remove spaces from column name in import](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/23)
- Update to Salesforce API v 56.0 (Winter '23)
- Add "Skip all unknown fields" to import page
- Add User Id to pop-up

<img alt="Add user" src="screenshots/add-user-id.png" height="200">

- Support Enhanced Domain [issue #222](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/issues/222) from [PR223](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/pull/223)
- [Add inactive users to search result](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/21)

<img alt="Inspector menu" src="./screenshots/issue21.png" height="200">

- Update to Salesforce API v 55.0 (Summer '22)
- Update to Salesforce API v 54.0 (Spring '22)
- [Sticked table header to the top on export](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/10)
- Update to Salesforce API v 53.0 (Winter '22)
- Add label to saved query and sort list.
- Remove extra comma when autocomplete query in data export, or select a field from suggested fields just before 'FROM' keyword.

<img alt="Inspector menu" src="./screenshots/7_latest_comma.png" height="100">

- Add "Copy Id" option when clicking on a SObject field or Id in data export page.

<img alt="Inspector menu" src="./screenshots/8_copy_id.png" height="200">

- Integrate UI updates from [Garywoo's fork](https://github.com/Garywoo/Chrome-Salesforce-inspector)
