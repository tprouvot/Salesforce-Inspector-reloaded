# Release Notes

## Version 1.27

- Show diff cells in blue when 2 rows displayed [issue 48](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/48)

## Version 1.26

> [!IMPORTANT]
> A new editor (query and script) is available in apex runner and data export with new features:
> - Inplace suggestions (can be disable in option)
> - Modular syntax highlighting for APEX, SOQL, and SOSL
> - Automatic indent on new lines
> - Indent selected text or lines with tab key
> - Parentheses, curly brace, brackets, or quotes
>   - Wrap selected text
>   - Automatic close completion


### Editor

- Migrate apex runner to new editor [issue 85](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/85)
- Add option to show/hide proposal with ctrl+space shortcut [issue 89](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/89)
- Highlight keywords [issue 62](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/62)
- Move suggestion over text area with list as regular IDE do [issue 41](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/41)
- Improve quote in editor [issue 73](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/73)
- Missing close/open char (parenthesis, bracket, curly brace), corresponding open/close char must be in red. [issue 90](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/90)

### Popup

- Escape to close popup [issue 71](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/71)
- Resize popup window [issue 77](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/77)


### Option

- Manage custom links in option [issue 91](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/91)
- Enhance option component (template, history, ...) [issue 80](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/80)

### Table

- Migrate data-loader to new table react component [issue 75](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/75)

### Flow

- Access flow version details from flow builder [issue 86](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/86)
- Clear old flow versions inside FlowBuilder [issue 50](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/50)

### Log and Profile

- Upload a previous log file [issue 103](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/103)

### Other

- Navigation bugs: custom settings and knowledge link [issue 91](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/91)

## Version 1.25

- Metadata: download data model by @dufoli in [issue 11](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/11)
- Apex fields and methods suggestion by @dufoli in [issue 45](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/45)
- Log: improove ux and performance by @dufoli in [issue 43](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/43)
- data export: Inline edit by @dufoli in [issue 47](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/47)
- Metadata: UX multi column and search  by @dufoli in [issue 55](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/55)
- Close popup on inspect and data export by @dufoli in [issue 42](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/42)
- save query history with comments, fix horizontal scroll, make apex log more readable, fix stop polling and restart, typo by @dufoli in [issue 63](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/63)
- auto indent on new line by @dufoli in [issue 58](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/58)
- indent/unindent selection with tab/shift tab by @dufoli in [issue 59](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/59)
- Wrap selected text with paretheses, brackets or quotes by @dufoli in [issue 60](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/60)
- make popup button movable by @Dufgui in [issue 24](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/24)
- support new domain : salesforce-setup.com

## Version 1.24

- Export: Support comments in SOQL / SOSL [issue 22](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/12)
- Export: format query SOQL/ SOSL [issue 22](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/12)
- Export: keep header on top of result on scrolling [issue 20](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/20)
- Export: Add download CSV [issue 26](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/26)
- Inspect: suggest value for picklist [issue 28](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/28)
- Import: assignment rule for Lead, Case and Account [issue 23](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/23)
- Popup: increase height of pannel and move it heigher
- Fix misc bugs (conecteed app,...)
- Log: Fix encoding for log dowload [issue 33](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/33)

## Version 1.23

- Export SOQL: suggest field and related object link in subquery: SELECT Id, (SELECT Id from Contacts) FROM Account
- Export SOQL: suggest field value with IN, LIKE, excludes(), includes()
- Export SOQL: respect order of column
- Export SOQL: Remove total, done, index column for subquery result 
- Export SOSL : execution
- Export SOSL : suggest keywords, field and object
- Apex Runner: execute batch, enqueue job or just anonymous code
- Apex Runner: poll log
- Apex Runner: auto suggest className
- Log: profiler
- Log: search with autoscroll
- Log: download
