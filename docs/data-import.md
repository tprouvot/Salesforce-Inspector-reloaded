# Data Import

## How object discovery and imports work

The extension uses the Salesforce session or configured OAuth access token to call APIs as the authenticated user. Data Import loads `/services/data/vXX.X/sobjects/` for Enterprise imports, or `/services/data/vXX.X/tooling/sobjects/` for Tooling imports. It then loads the selected object's describe response to suggest fields, lookup relationships, and external IDs. Metadata imports use the regular describe to find custom metadata types (`__mdt`).

Pasted CSV, Excel, or JSON data is parsed and mapped to fields in the browser. After confirmation, the extension sends batches through the selected Salesforce SOAP API and displays each row's result. Salesforce enforces the authenticated user's object, field, and record access.

The relevant source files are:

- `addon/inspector.js`: session acquisition and REST/SOAP requests.
- `addon/data-load.js`: `DescribeInfo`, which loads and retains describe responses for this page.
- `addon/data-import.js`: object suggestions, validation, field mapping, and batch execution.
- `addon/utils.js`: shared object cache used by other pages, including the popup.

Data Import uses the current page's describe results for the selected API. The shared popup cache is keyed by Salesforce host and combines metadata from regular describe, Tooling describe, and `EntityDefinition`. Its merged capability hints are unsuitable for validating the current user's import access, especially after changing users or permissions. Regular data imports do not need the popup's Tooling metadata queries.

## Troubleshoot objects that work only for administrators

An object can exist in the org while being unavailable or read-only to another user. Earlier validation checked only writable autocomplete suggestions, so it displayed **Unknown object** for both missing objects and known objects without write capabilities. A stale or incomplete shared object cache could produce the same message even when the current user had access.

The object field now distinguishes these cases:

| Message | Meaning and next step |
| --- | --- |
| Unknown object or unavailable to this user in the selected API | The object is absent from the current user's selected API global describe. Check the API name, API type/version, object access, and applicable feature licenses. |
| Object is not writable for this user in the selected API | The object is present, but describe reports no create, update, delete, or undelete capability. Check effective object permissions and whether the object supports these operations. |
| Unable to load objects | Global describe failed. Inspect the failed network response for session, API access, or connectivity errors, then reload. |

To diagnose `Account`, perform these read-only checks in Inspector's REST Explorer while authenticated as the affected user, using the same API version as Data Import:

1. Send `GET /services/data/vXX.X/sobjects/`. Find `Account` in `sobjects` and inspect `createable`, `updateable`, `deletable`, and `undeletable`.
2. Send `GET /services/data/vXX.X/sobjects/Account/describe`. Inspect the same capability flags and the create/update flags on the fields being imported. Compare with the administrator's response.
3. If Insert has `createable: false`, or Update has `updateable: false`, have an administrator review the user's effective object access through their profile, permission sets, and permission set groups, plus applicable feature licensing. Grant the permissions required for the intended operation and field access. Assigning System Administrator is not required as a troubleshooting step.
4. If describe succeeds with the required flags but the old extension reports Unknown object, reload with the patched extension and retest. If describe fails, use the actual Salesforce error to investigate API access, licensing, or object visibility.

Object suggestions indicate that at least one write operation is available; they do not guarantee permission for every action. Salesforce still validates the chosen operation, fields, and record access when the batch is submitted. The patch cannot grant access that Salesforce denies.

See Salesforce's [Describe Global reference](https://developer.salesforce.com/docs/platform/api-rest/guide/resources-describeglobal.html) and [describe result capability flags](https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-describeglobal-describeglobalresult.html).

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

If true for a Case or Lead, uses the default (active) assignment rule for a Case or Lead. If specified, don't specify an assignmentRuleId. If true for an Account, all territory assignment rules are applied. If false for an Account, no territory assignment rules are applied.
``` json
  '{"AssignmentRuleHeader": {"useDefaultRule": true}}',
```

<img width="503" alt="SOAP Custom Headers" src="https://github.com/user-attachments/assets/e2d21970-ddc5-4c42-a54e-ffb7ffdcb278">

## Grey out skipped columns in data import

From the 'Options' tab, enable the 'Grey Out Skipped Columns in Data Import' option and perform the data import. The un-imported columns will be greyed out.

<img width="571" alt="Grey out un-imported columns" src="https://github.com/user-attachments/assets/8f23f00b-0b8f-4c5b-8c92-aa97b3975daf" />
