// Prism ships no SOQL grammar, so this registers one on top of the bundled SQL grammar,
// shared by the Data Export query editor and the Queries dropdown.

// Prism's SQL keyword list colours ordinary field names such as Status, Type and
// Language as syntax. These are the SOQL and SOSL reserved words; anything unlisted
// renders as a plain identifier rather than the wrong colour.
const SOQL_KEYWORDS = /\b(?:SELECT|FROM|WHERE|WITH|DATA CATEGORY|GROUP BY|ROLLUP|CUBE|HAVING|ORDER BY|ASC|DESC|NULLS (?:FIRST|LAST)|LIMIT|OFFSET|FOR (?:VIEW|REFERENCE|UPDATE)|UPDATE (?:TRACKING|VIEWSTAT)|TYPEOF|WHEN|THEN|ELSE|END|AND|OR|NOT|LIKE|IN|INCLUDES|EXCLUDES|ALL ROWS|USING SCOPE|FIND|RETURNING|(?:ALL|NAME|EMAIL|PHONE|SIDEBAR) FIELDS|FIELDS|SNIPPET|HIGHLIGHT|NETWORK|METADATA|DIVISION|LISTVIEW|COUNT(?:_DISTINCT)?|SUM|AVG|MIN|MAX|GROUPING|FORMAT|TOLABEL|CONVERTCURRENCY|CONVERTTIMEZONE)\b/i;

const {languages} = window.Prism;
languages.soql = languages.extend("sql", {keyword: SOQL_KEYWORDS});
languages.insertBefore("soql", "keyword", {
  "sobject": [
    {pattern: /(\bfrom\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
    {pattern: /(\breturning\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
    // A further SOSL object, as in "RETURNING Account(Id), Contact(Id)".
    {pattern: /(\)\s*,\s*)[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/, lookbehind: true}
  ]
});

// SOQL and SOSL get the SOQL grammar; anything else, such as GraphQL, keeps plain SQL.
export function queryGrammar(query) {
  return /^(select|find)\b/i.test(query.trim()) ? languages.soql : languages.sql;
}
