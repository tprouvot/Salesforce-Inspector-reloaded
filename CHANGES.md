# Release Notes

## Version 1.24

- Export: Support comments in SOQL / SOSL
- Export: format query SOQL/ SOSL
- Export: keep header on top of result on scrolling
- Inspect: suggest value for picklist
- Import: assignment rule for Lead, Case and Account
- Popup: increase height of pannel and move it heigher
- Fix misc bugs (conecteed app,...)

## Version 1.23

- Export SOQL: suggest field and related object link in subquery: SELECT Id, (SELECT Id from Contacts) FROM Account
- Export SOQL: suggest field value with IN, LIKE, excludes(), includes()
- Export SOQL: 
- Export SOSL : execution
- Export SOSL : suggest keywords, field and object
- Apex Runner: execute batch, enqueue job or just anonymous code
- Apex Runner: poll log
- Apex Runner: auto suggest className
- Log profiler
- Log search with autoscroll
- Log download
- Respect order of column in data export
- Remove total,done, index column for subquery result 
