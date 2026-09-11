/* global React */
let h = React.createElement;

const FROM_CLAUSE = /\bfrom\s+([a-zA-Z0-9_]+)/gi;
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

// Objects named by a FROM clause, subqueries included.
function extractObjectNames(query) {
  const names = new Set();
  for (const match of query.matchAll(FROM_CLAUSE)) {
    names.add(match[1].toLowerCase());
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
    return {isObjectSuggest: false, object: null, terms: splitTerms(input)};
  }
  const [, name, space, rest] = input.match(/^\?(\S*)(\s*)([\s\S]*)$/);
  if (!name || !space) {
    return {isObjectSuggest: true, prefix: name.toLowerCase(), object: null, terms: []};
  }
  return {isObjectSuggest: false, object: name.toLowerCase(), terms: splitTerms(rest)};
}

function matches(entry, search) {
  const query = (entry.query || "").toLowerCase();
  if (search.object && !extractObjectNames(query).has(search.object)) {
    return false;
  }
  return search.terms.every(term => query.includes(term));
}

// Either object-name suggestions or the matching queries.
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
  return {entries: entries.filter(entry => matches(entry, search)), isObjectSuggest: false};
}

// Syntax colouring via the bundled Prism, which escapes the query as it tokenises.
// Without Prism the query is rendered as a plain text node rather than as markup.
function renderQuery(query) {
  const prism = window.Prism;
  if (!prism || !prism.languages.sql) {
    return h("span", {className: "sfir-query-text", title: query}, query);
  }
  return h("code", {
    className: "language-sql sfir-query-text",
    title: query,
    dangerouslySetInnerHTML: {__html: prism.highlight(query, prism.languages.sql, "sql")}
  });
}

// Renders one dropdown row. Callers decide whether labels apply: only saved queries
// carry them, history entries are always a bare query.
export function renderQueryItem({label, query, useToolingApi}) {
  return h("span", {className: "sfir-query-item"},
    label && h("span", {className: "slds-badge slds-badge_inverse sfir-query-badge", title: "Saved query label"}, label),
    renderQuery(query || ""),
    useToolingApi && h("span", {className: "slds-badge sfir-query-badge", title: "Uses Tooling API"}, "Tooling")
  );
}
