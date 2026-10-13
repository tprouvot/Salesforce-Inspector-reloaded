# Object Scanner User Guide

The **Object Scanner** reviews customizable Salesforce objects and subscriber-created custom fields for schema hygiene: naming, standard-object replication, over-customization, picklist quality, and Salesforce data classification.

Field usage (population %) is not calculated here. Each finding links to **Show All Data**, which already supports field usage analysis.

## How to launch

1. Open Salesforce Inspector Reloaded.
2. Under **Platform Tools**, click **Object Scanner**.
3. The page loads every `IsCustomizable` object. All are selected by default.
4. Optionally search, filter (All / Custom / Standard), or select a subset.
5. Click **Scan Data Model** to describe objects and fields.
6. Optionally search the loaded schema. `Account.Name` keeps the Account object, then the Name field. A term without a dot matches object or field names.
7. Use **Columns** to choose which field attributes appear in the Data Model table. Object and Field stay visible; the rest is saved in this browser (`objectScannerFieldsToDisplay`), like Show All Data column choices.
8. Click **Analyze** only if you want hygiene findings.

You can hide the popup button from **Options → User Experience → Show buttons**.

Rule enablement, severity, and thresholds live under **Options → Object Scanner**. Over-customization exposes subscriber custom field, custom relationship, record type, and subscriber custom object warning/error counts. Packaged fields and objects are excluded. Near-duplicate Objects uses a regex for suffixes to strip when grouping names (default `(_2|_old|_backup|_copy|_v2)$`). A capturing group other than the full match is treated as the stem; otherwise the match is removed. Invalid patterns fall back to the default.

## What it analyzes

Only customizable objects. Naming, picklist, description, and type rules run on **custom objects and subscriber custom fields** (including user-created fields on managed objects). Packaged fields are skipped.

| Rule | Default | What it flags |
|------|---------|----------------|
| Naming Convention | On / warning | API names that differ from the org's dominant style, redundant object tokens, extra underscores, long names |
| Standard Object Replication | On / warning | Custom objects whose name or label contains a standard object token (`Account`, `Contact`, …) |
| Over-customization | On / warning | Too many subscriber custom fields (100/300), custom relationships (25/40), record types excluding Master (20/50), or subscriber custom objects in the scan set (100/200) |
| PII Classified | On / info | Fields with `ComplianceGroup`, `SecurityClassification`, or `BusinessStatus` |
| PII Unclassified | Off / warning | Subscriber custom fields with no classification metadata |
| Duplicate Labels | On / warning | Two custom fields on the same object sharing a label |
| Type Hygiene | On / warning | Names that imply Email / Phone / URL / Percent / Checkbox but use a generic type |
| Unrestricted Picklist | On / info | Custom picklists with `restrictedPicklist = false` |
| Inactive Picklist Bloat | On / warning | Picklists where inactive values are a majority (default 50%) |
| Near-duplicate Objects | On / info | Custom objects that differ only by pluralization or a suffix matching the Options regex (default `_2` / `_Old` / `_Backup` / `_Copy` / `_V2`) |
| Missing Description | On / warning | Subscriber custom fields with an empty FieldDefinition description |
| Encrypted Unclassified | On / warning | Encrypted fields with no classification |

PII detection uses Salesforce Data Classification metadata only. It does not guess PII from field names.

## Progressive scan

1. **Scan Data Model** describes standard customizable objects first (Composite API, 5 describes per call), then custom objects. Description, PII classification, and FieldDefinition columns are off by default. Enable **Description & classification** before scanning if you need them; that adds Tooling `FieldDefinition` queries (5 objects per composite call).
2. Search filters the loaded schema. `Object.Field` (for example `Account.Name`) matches that object token, then fields whose API name, label, help text, lookup target, description, or classification contains the second part. A value without a dot matches objects or fields.
3. **Analyze** runs the enabled rules in memory. If description / PII / encrypted rules are on and FieldDefinition was not loaded during the scan, Analyze queries it then.

Stop cancels the in-flight scan or analysis. Session cache stores the last object selection and slim findings only, and skips the write if the payload would exceed quota.

The toolbar shows a running **API calls** badge (Salesforce REST calls toward org limits; composite batches count as one) and duration, so you can see the cost of listing objects plus describing and querying field definitions.

## Export

**XLS** copies the loaded objects and fields to the clipboard (tab-separated, for Excel). **CSV** downloads the same data as a file. Export includes Required, Length, Help Text, Lookup To, Encrypted, External ID, Unique, and related describe flags regardless of which columns are visible in the table. Description and classification columns are included only when FieldDefinition was queried.

**Export Findings** downloads the analysis table.

## Field usage

Click an object API name in the findings table to open Show All Data for that object (`inspect.html?host=…&objectType=…`), then use **Get field usage**.
