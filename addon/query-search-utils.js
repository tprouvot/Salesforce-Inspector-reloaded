/* global React */
let h = React.createElement;

// Parentheses track subquery depth; the other branches name an object.
const OBJECT_SOURCE = /\(|\)|\bfrom\s+([a-zA-Z0-9_]+)|\breturning\s+([a-zA-Z0-9_]+)|,\s*([a-zA-Z0-9_]+)\s*\(/gi;
const STRING_LITERAL = /'(?:[^'\\]|\\.)*'/g;
// The query forms data-export can run: SOQL, SOSL and GraphQL.
const LEADING_QUERY = /^\s*(select\b|find\b|\{)/i;

// Saved queries are stored as "label:query". A prefix only counts as a label when it
// is not itself a query and what follows is, so colons inside a query (datetime
// literals, SOSL braces) never split it.
export function splitSavedQuery(text) {
  const source = text || "";
  const colon = source.indexOf(":");
  if (colon < 0) {
    return {label: null, query: source};
  }
  const label = source.slice(0, colon);
  const query = source.slice(colon + 1);
  if (LEADING_QUERY.test(label) || !LEADING_QUERY.test(query)) {
    return {label: null, query: source};
  }
  return {label, query};
}

// The objects a query reads from: the SOQL FROM target and any SOSL RETURNING
// objects. A subquery FROM target is a child relationship name rather than an object,
// so only depth zero counts, and literals are blanked so their text cannot match.
function extractObjectNames(query) {
  const text = query.replace(STRING_LITERAL, literal => " ".repeat(literal.length));
  const isSosl = /\breturning\b/i.test(text);
  const names = new Set();
  let depth = 0;
  for (const match of text.matchAll(OBJECT_SOURCE)) {
    if (match[0] === "(") {
      depth++;
    } else if (match[0] === ")") {
      depth--;
    } else if (match[1] && depth === 0) {
      names.add(match[1].toLowerCase());
    } else if (match[2]) {
      names.add(match[2].toLowerCase());
    } else if (match[3] && isSosl) {
      // A further SOSL object, as in "RETURNING Account(Id), Contact(Id)".
      names.add(match[3].toLowerCase());
    }
  }
  return names;
}

// Sorted object names present in the given entries, offered as "?" suggestions.
function objectVocabulary(entries) {
  const vocab = new Set();
  entries.forEach(entry => extractObjectNames(entry.query || "").forEach(name => vocab.add(name)));
  return Array.from(vocab).sort();
}

function splitTerms(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

// "?" filters by object, anything else is a plain text search over the whole input.
// While the object name is still being typed we suggest names; a trailing space
// commits it, so "?Account status" searches Account queries for "status".
function parseSearch(value) {
  const input = value || "";
  if (!input.startsWith("?")) {
    return {isObjectSuggest: false, object: null, text: input.trim().toLowerCase(), terms: splitTerms(input)};
  }
  const [, name, space, rest] = input.match(/^\?(\S*)(\s*)([\s\S]*)$/);
  if (!name || !space) {
    return {isObjectSuggest: true, prefix: name.toLowerCase(), object: null, text: "", terms: []};
  }
  return {isObjectSuggest: false, object: name.toLowerCase(), text: rest.trim().toLowerCase(), terms: splitTerms(rest)};
}

function scoreEntry(entry, search) {
  const query = (entry.query || "").toLowerCase();
  if (search.object && !extractObjectNames(query).has(search.object)) {
    return -1;
  }
  if (!search.terms.length) {
    return 0;
  }
  const hits = search.terms.filter(term => query.includes(term)).length;
  if (!hits) {
    return -1;
  }
  if (search.text && query.includes(search.text)) {
    return 2;
  }
  return hits / search.terms.length;
}

// Either object-name suggestions or matching queries, strongest matches first.
// Linear scan: history holds at most 100 entries and saved queries 50.
export function dropdownEntries(entries, searchValue) {
  const search = parseSearch(searchValue);
  if (search.isObjectSuggest) {
    const vocab = objectVocabulary(entries);
    return {
      entries: search.prefix ? vocab.filter(name => name.startsWith(search.prefix)) : vocab,
      isObjectSuggest: true
    };
  }
  const scored = entries
    .map((entry, index) => ({entry, index, score: scoreEntry(entry, search)}))
    .filter(result => result.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const completeMatches = scored.filter(result => result.score >= 1);
  const results = completeMatches.length ? completeMatches : scored;
  return {entries: results.map(result => result.entry), isObjectSuggest: false};
}

function matchRanges(text, terms) {
  if (!terms.length) {
    return [];
  }
  const escape = term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const orderedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  return Array.from(text.matchAll(new RegExp(orderedTerms.map(escape).join("|"), "gi")))
    .map(match => ({start: match.index, end: match.index + match[0].length}));
}

function renderTextRanges(text, ranges, position, keyPrefix) {
  const start = position.offset;
  const end = start + text.length;
  position.offset = end;
  const intersections = ranges.filter(range => range.end > start && range.start < end);
  if (!intersections.length) {
    return text;
  }
  const output = [];
  let cursor = 0;
  intersections.forEach((range, index) => {
    const from = Math.max(range.start, start) - start;
    const to = Math.min(range.end, end) - start;
    if (from > cursor) {
      output.push(text.slice(cursor, from));
    }
    output.push(h("mark", {key: `${keyPrefix}-${index}`, className: "sfir-search-match"}, text.slice(from, to)));
    cursor = to;
  });
  if (cursor < text.length) {
    output.push(text.slice(cursor));
  }
  return output;
}

function highlightText(text, terms, keyPrefix) {
  return renderTextRanges(text, matchRanges(text, terms), {offset: 0}, keyPrefix);
}

export function renderHighlightedText(text, searchText) {
  return highlightText(text, splitTerms(searchText), "match");
}

function renderPrismToken(token, ranges, position, key) {
  if (typeof token === "string") {
    return renderTextRanges(token, ranges, position, key);
  }
  const aliases = token.alias ? (Array.isArray(token.alias) ? token.alias : [token.alias]) : [];
  const className = ["token", token.type, ...aliases].join(" ");
  const content = Array.isArray(token.content)
    ? token.content.map((part, index) => renderPrismToken(part, ranges, position, `${key}-${index}`))
    : renderPrismToken(token.content, ranges, position, `${key}-0`);
  return h("span", {key, className}, content);
}

// Prism ships a SQL keyword list, which colours ordinary Salesforce names such as
// Status, Type and Language as syntax. These are the SOQL and SOSL reserved words;
// anything unlisted renders as a plain identifier rather than the wrong colour.
const SOQL_KEYWORDS = /\b(?:SELECT|FROM|WHERE|WITH|DATA CATEGORY|GROUP BY|ROLLUP|CUBE|HAVING|ORDER BY|ASC|DESC|NULLS (?:FIRST|LAST)|LIMIT|OFFSET|FOR (?:VIEW|REFERENCE|UPDATE)|UPDATE (?:TRACKING|VIEWSTAT)|TYPEOF|WHEN|THEN|ELSE|END|AND|OR|NOT|LIKE|IN|INCLUDES|EXCLUDES|ALL ROWS|USING SCOPE|FIND|RETURNING|(?:ALL|NAME|EMAIL|PHONE|SIDEBAR) FIELDS|FIELDS|SNIPPET|HIGHLIGHT|NETWORK|METADATA|DIVISION|LISTVIEW|COUNT(?:_DISTINCT)?|SUM|AVG|MIN|MAX|GROUPING|FORMAT|TOLABEL|CONVERTCURRENCY|CONVERTTIMEZONE)\b/i;

function queryGrammar(prism, query) {
  if (!prism.languages.soql) {
    prism.languages.soql = prism.languages.extend("sql", {keyword: SOQL_KEYWORDS});
    prism.languages.insertBefore("soql", "keyword", {
      "sobject": [
        {pattern: /(\bfrom\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
        {pattern: /(\breturning\s+)[a-zA-Z_][a-zA-Z0-9_]*/i, lookbehind: true},
        // A further SOSL object, as in "RETURNING Account(Id), Contact(Id)".
        {pattern: /(\)\s*,\s*)[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/, lookbehind: true}
      ]
    });
  }
  return /^(select|find)\b/i.test(query.trim()) ? prism.languages.soql : prism.languages.sql;
}

// Prism owns syntax colouring; search matches are marked inside its text tokens.
function renderQuery(query, terms) {
  const prism = window.Prism;
  const ranges = matchRanges(query, terms);
  const position = {offset: 0};
  const content = prism?.languages.sql
    ? prism.tokenize(query, queryGrammar(prism, query)).map((token, index) => renderPrismToken(token, ranges, position, `token-${index}`))
    : renderTextRanges(query, ranges, position, "query");
  return h("code", {className: "language-sql sfir-query-text", title: query}, content);
}

// Renders one dropdown row. Callers decide whether labels apply: only saved queries
// carry them, history entries are always a bare query.
export function renderQueryItem({label, query, useToolingApi}, searchValue) {
  const terms = parseSearch(searchValue).terms;
  return h("span", {className: "sfir-query-item"},
    label && h("span", {className: "slds-badge slds-badge_inverse sfir-query-badge", title: "Saved query label"}, highlightText(label, terms, "label")),
    renderQuery(query || "", terms),
    useToolingApi && h("span", {className: "slds-badge sfir-query-badge", title: "Uses Tooling API"}, "Tooling")
  );
}
