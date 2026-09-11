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
  if (!search.terms.length) {
    return {entries: scored.map(result => result.entry), isObjectSuggest: false};
  }
  const completeMatches = scored.filter(result => result.score >= 1);
  const results = completeMatches.length ? completeMatches : scored;
  return {entries: results.map(result => result.entry), isObjectSuggest: false};
}

function highlightText(text, terms, keyPrefix) {
  if (!terms.length) {
    return text;
  }
  const escape = term => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const orderedTerms = [...new Set(terms)].sort((a, b) => b.length - a.length);
  const matches = new Set(orderedTerms.map(term => term.toLowerCase()));
  const parts = text.split(new RegExp(`(${orderedTerms.map(escape).join("|")})`, "gi"));
  return parts.map((part, index) => matches.has(part.toLowerCase())
    ? h("mark", {key: `${keyPrefix}-${index}`, className: "sfir-search-match"}, part)
    : part
  );
}

export function renderHighlightedText(text, searchText) {
  return highlightText(text, splitTerms(searchText), "match");
}

function renderPrismToken(token, terms, key) {
  if (typeof token === "string") {
    return highlightText(token, terms, key);
  }
  const aliases = token.alias ? (Array.isArray(token.alias) ? token.alias : [token.alias]) : [];
  const className = ["token", token.type, ...aliases].join(" ");
  const content = Array.isArray(token.content)
    ? token.content.map((part, index) => renderPrismToken(part, terms, `${key}-${index}`))
    : renderPrismToken(token.content, terms, `${key}-0`);
  return h("span", {key, className}, content);
}

// Prism owns syntax colouring; search matches are marked inside its text tokens.
function renderQuery(query, searchValue) {
  const terms = parseSearch(searchValue).terms;
  const prism = window.Prism;
  const content = prism?.languages.sql
    ? prism.tokenize(query, prism.languages.sql).map((token, index) => renderPrismToken(token, terms, `token-${index}`))
    : highlightText(query, terms, "query");
  return h("code", {className: "language-sql sfir-query-text", title: query}, content);
}

// Renders one dropdown row. Callers decide whether labels apply: only saved queries
// carry them, history entries are always a bare query.
export function renderQueryItem({label, query, useToolingApi}, searchValue = "") {
  return h("span", {className: "sfir-query-item"},
    label && h("span", {className: "slds-badge slds-badge_inverse sfir-query-badge", title: "Saved query label"}, renderHighlightedText(label, searchValue)),
    renderQuery(query || "", searchValue),
    useToolingApi && h("span", {className: "slds-badge sfir-query-badge", title: "Uses Tooling API"}, "Tooling")
  );
}
