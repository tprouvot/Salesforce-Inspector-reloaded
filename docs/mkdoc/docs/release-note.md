# Release Notes

## Version 1.16

* Select "Update" action by default when the data paste in data-import page contains Id column [feature 60](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/60) (by Bilel Morsli)
* Allow users to update API ## Version [feature 58](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/58)
* Add org instance in the popup and a link to Salesforce trust status website [feature 53](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/53) (by [Camille Guillory](https://github.com/CamilleGuillory) )
* Fix saved query when it contains ":" [issue 55](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/55) (by [Victor Garcia](https://github.com/victorgz/) )

## Version 1.15

* Add "PSet" button to access user permission set assignment from User tab [feature 49](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/49)
* Add shortcut tab to access setup quick links [feature 42](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/42)

## Version 1.14

*  Add checkbox in flow builder to give the possibility to the user to scroll on the flow (by [Samuel Krissi](https://github.com/samuelkrissi) )

![image](https://user-images.githubusercontent.com/96471586/226161542-cbedec0a-8988-4559-9152-d067ea6f9cb6.png)

* Fix links (object fields and object list) for custom metadata objects [issue 39](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/39)
* Add shortcut link to object list from popup (idea by [Samuel Krissi](https://github.com/samuelkrissi) )
* Add shortcuts links to (list of record types, current SObject RecordType and objet details, show all data from user tab) from popup [feature 34](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/34)
* Update manifest ## Version from [v2](https://developer.chrome.com/docs/extensions/mv3/mv2-sunset/) to v3
* Auto detect SObject on import page when posting data which contain SObject header [feature 30](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/30)
* Update to Salesforce API v 57.0 (Spring '23)
* [Switch background color on import page to alert users that it's a production environnement](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/20)
* Implement Auth2 flow to generate access token for connected App

## Version 1.13

* [Automatically remove spaces from column name in import](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/23)
* Update to Salesforce API v 56.0 (Winter '23)
* Add "Skip all unknown fields" to import page
* Add User Id to pop-up

<img alt="Inspector menu" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/tree/master/docs/screenshots/add-user-id.png" height="200">

* Support Enhanced Domain [issue #222](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/issues/222) from [PR223](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/pull/223)
* [Add inactive users to search result](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/21)

<img alt="Inspector menu" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/tree/master/docs/screenshots/issue21.png" height="200">

* Update to Salesforce API v 55.0 (Summer '22)
* Update to Salesforce API v 54.0 (Spring '22)
* [Sticked table header to the top on export](https://github.com/tprouvot/Salesforce-Inspector-reloaded/issues/10)
* Update to Salesforce API v 53.0 (Winter '22)
* Add label to saved query and sort list.
* Remove extra comma when autocomplete query in data export, or select a field from suggested fields just before 'FROM' keyword.

<img alt="Inspector menu" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/tree/master/docs/screenshots/7_latest_comma.png" height="100">

* Add "Copy Id" option when clicking on a SObject field or Id in data export page.

<img alt="Inspector menu" src="https://github.com/tprouvot/Salesforce-Inspector-reloaded/tree/master/docs/screenshots/8_copy_id.png" height="200">

* Integrate UI updates from [Garywoo's fork](https://github.com/Garywoo/Chrome-Salesforce-inspector)