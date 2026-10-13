// Prism ships no SOQL grammar, so this registers SOQL and SOSL grammars on top of the
// bundled SQL grammar, shared by the Data Export query editor and the Queries dropdown.

// Prism's SQL keyword list colours ordinary field names such as Status, Type and
// Language as syntax. These are the SOQL and SOSL reserved words; anything unlisted
// renders as a plain identifier rather than the wrong colour. Words that are also
// common field names, such as Metadata or Division, only count after WITH or USING.
const SOQL_KEYWORDS = /\b(?:SELECT|FROM|WHERE|WITH (?:DATA CATEGORY|DIVISION|HIGHLIGHT|METADATA|NETWORK|SNIPPET)|WITH|GROUP BY|ROLLUP|CUBE|HAVING|ORDER BY|ASC|DESC|NULLS (?:FIRST|LAST)|LIMIT|OFFSET|FOR (?:VIEW|REFERENCE|UPDATE)|UPDATE (?:TRACKING|VIEWSTAT)|TYPEOF|WHEN|THEN|ELSE|END|AND|OR|NOT|LIKE|IN|INCLUDES|EXCLUDES|ALL ROWS|USING (?:SCOPE|LISTVIEW)|FIND|RETURNING|(?:ALL|NAME|EMAIL|PHONE|SIDEBAR) FIELDS|FIELDS|COUNT(?:_DISTINCT)?|SUM|AVG|MIN|MAX|GROUPING|FORMAT|TOLABEL|CONVERTCURRENCY|CONVERTTIMEZONE)\b/i;

const {languages} = window.Prism;
languages.soql = languages.extend("sql", {keyword: SOQL_KEYWORDS});
languages.insertBefore("soql", "keyword", {
  "sobject": {pattern: /(\bfrom\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true}
});
languages.sosl = languages.extend("sql", {keyword: SOQL_KEYWORDS});
languages.insertBefore("sosl", "keyword", {
  "sobject": [
    {pattern: /(\breturning\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
    // A further object, as in "RETURNING Account(Id), Contact(Id)".
    {pattern: /(\)\s*,\s*)[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/, lookbehind: true}
  ]
});

// SELECT gets SOQL and FIND gets SOSL; anything else, such as GraphQL, keeps plain SQL.
export function queryGrammar(query) {
  const start = query.trimStart();
  if (/^select\b/i.test(start)) {
    return languages.soql;
  }
  return /^find\b/i.test(start) ? languages.sosl : languages.sql;
}
