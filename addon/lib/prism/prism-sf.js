// SOQL and SOSL languages for Prism, built on its SQL grammar. Prism has no SOQL
// language of its own, so this lives next to prism.js rather than inside it, and a
// rebuild of prism.js from the Prism download page does not drop it.
(function(Prism) {
  // Prism's SQL keyword list colours ordinary field names such as Status, Type and
  // Language as syntax. These are the SOQL and SOSL reserved words, in one list shared
  // by both languages; anything unlisted renders as a plain identifier rather than the
  // wrong colour. Words that are also common field names, such as Metadata or Division,
  // only count after WITH or USING.
  const QUERY_KEYWORDS = /\b(?:SELECT|FROM|WHERE|WITH (?:DATA CATEGORY|DIVISION|HIGHLIGHT|METADATA|NETWORK|SNIPPET)|WITH|GROUP BY|ROLLUP|CUBE|HAVING|ORDER BY|ASC|DESC|NULLS (?:FIRST|LAST)|LIMIT|OFFSET|FOR (?:VIEW|REFERENCE|UPDATE)|UPDATE (?:TRACKING|VIEWSTAT)|TYPEOF|WHEN|THEN|ELSE|END|AND|OR|NOT|LIKE|IN|INCLUDES|EXCLUDES|ALL ROWS|USING (?:SCOPE|LISTVIEW)|FIND|RETURNING|(?:ALL|NAME|EMAIL|PHONE|SIDEBAR) FIELDS|FIELDS|COUNT(?:_DISTINCT)?|SUM|AVG|MIN|MAX|GROUPING|FORMAT|TOLABEL|CONVERTCURRENCY|CONVERTTIMEZONE)\b/i;

  Prism.languages.soql = Prism.languages.extend("sql", {keyword: QUERY_KEYWORDS});
  Prism.languages.insertBefore("soql", "keyword", {
    "sobject": {pattern: /(\bfrom\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true}
  });

  Prism.languages.sosl = Prism.languages.extend("sql", {keyword: QUERY_KEYWORDS});
  Prism.languages.insertBefore("sosl", "keyword", {
    "sobject": [
      {pattern: /(\breturning\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
      // A further object, as in "RETURNING Account(Id), Contact(Id)".
      {pattern: /(\)\s*,\s*)[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/, lookbehind: true}
    ]
  });
}(window.Prism));
