# Release Notes

## Version 1.26

- Escape to close popup [issue 71](https://github.com/dufoli/Salesforce-Inspector-Advanced/issues/71)

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
