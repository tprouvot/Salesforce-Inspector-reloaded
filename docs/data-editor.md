# Data Editor

The Data Editor is a spreadsheet-like table where you can review and change records before importing them. Nothing is saved to Salesforce until you run the import in [Data Import](data-import.md).

## Open the editor

- From **Data Export**, run a SOQL query and click **Edit** in the result toolbar (not available for SOSL and GraphQL results). The visible rows and columns open in a new tab (the result filter and *Hide Object Columns* are respected).
- Or open `data-editor.html` and paste cells copied from Excel or Google Sheets (<kbd>Ctrl</kbd>+<kbd>V</kbd>). The first line is used as the header.

## Edit

| Action | How |
|:---|:---|
| Edit a cell | Double-click it, press <kbd>Enter</kbd> / <kbd>F2</kbd>, or just start typing |
| Save and move | <kbd>Enter</kbd> (down), <kbd>Shift</kbd>+<kbd>Enter</kbd> (up), <kbd>Tab</kbd> (right) |
| Cancel | <kbd>Escape</kbd> |
| Same value in many cells | Select a range, type the value and press <kbd>Ctrl</kbd>+<kbd>Enter</kbd>, or paste a single value |
| Select | Click, <kbd>Shift</kbd>+click or drag; click row numbers to select rows; <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all |
| Copy / paste | <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>V</kbd>, compatible with Excel. Pasting below the last row adds rows |
| Clear | <kbd>Delete</kbd> or <kbd>Backspace</kbd> |
| Find & replace | **Replace** or <kbd>Ctrl</kbd>+<kbd>H</kbd>. Case-insensitive, in the selected cells when several are selected, otherwise in all the rows shown. Read-only columns are skipped |
| Set a field that was not queried | **Column** adds a column at the end. Use the field API name; only fields you can write are accepted |
| Remove columns | Select cells in the columns and click **Delete columns**. Only the table changes; the `_` and `Id` columns are kept |
| Undo / redo | <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Y</kbd> |
| Add / remove rows | **Row** and **Delete rows** buttons. Removing a row only removes it from the table, not from Salesforce |
| Sort, filter, resize | Click a header to sort (ascending, descending, none), type in **Filter rows**, drag a header edge |

The value bar above the table shows the full value of the active cell and can be used to edit long values.

Edited cells are highlighted, and new rows are marked in the row numbers.

## Read-only columns and type checks

When the rows come from one object (the `_` column, for example `[Account]`), the editor reads the object's fields:

- Columns that cannot be written are greyed out: the `_` and `Id` columns, read-only fields (formula, system and compound fields, or fields you cannot edit), encrypted fields, values returned by `toLabel()`, `FORMAT()` or `convertCurrency()`, and fields of related records (`Owner.Name`, subqueries, aliases). Point at a cell to see why. Fields that can only be set on creation are editable on new rows only.
- To change a parent record, edit the lookup field (for example `AccountId`). To edit child records, query their object in Data Export.
- Aggregate query results and objects that cannot be created or updated open read-only.
- Read-only columns are sent to Data Import with a `_` prefix, so they are shown there but skipped.
- When you leave an edited cell, its value is checked against the field type (number, date, date/time, boolean, email, Id, picklist value, maximum length, required). A mismatch shows a warning icon in the cell, the reason in the value bar, and the number of warnings next to the row count. Warnings do not block sending: Data Import reports the actual errors.

Subquery results and compound fields (such as addresses) are shown as JSON.

## Send to Data Import

Click **Send to Data Import** to open Data Import with the rows preloaded. The object is detected from the `_` column and **Update** is preselected when an `Id` column is present. Review the mapping and the action, then run the import.

With **Changes only** (enabled by default when coming from Data Export), only edited and new rows are sent, with the `_` and `Id` columns and the columns you edited, so unchanged fields are not written again. Changes hidden by the row filter are sent too. Uncheck it to send all the rows currently shown (for example to upsert with an external Id column you did not edit).

New rows have no `Id`: send them on their own and Data Import proposes **Insert**.
