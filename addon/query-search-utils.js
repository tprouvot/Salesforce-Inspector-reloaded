/* global React */
let h = React.createElement;

export const SearchUtils = {
  splitPreservingQuotes(input) {
    return input.split(/([^\s"]+|"[^"]*")+/g).filter(s => s && s !== " ");
  },
  unquote(s) {
    return (s?.startsWith('"') && s?.endsWith('"')) ? s.slice(1, -1) : s;
  },
  hasOddQuoteCount(s) {
    const c = (s.match(/"/g)?.length ?? 0);
    return c % 2 === 1;
  },
  extractObjectNames(q) {
    // Match every FROM clause directly (outer query and subqueries alike).
    // Pairing "select ... from" non-greedily only finds the nearest FROM after
    // each SELECT, which skips the outer object when a subquery comes first.
    const re = /\bfrom\s+([a-zA-Z0-9_]+)/gi;
    const names = new Set();
    let m;
    while ((m = re.exec(q)) !== null) { names.add(m[1].toLowerCase()); }
    return Array.from(names);
  },
  buildHistoryIndex(queries) {
    const lower = queries.map(q => q.toLowerCase());
    const vocab = new Set();
    const objToIds = {};
    lower.forEach((ql, i) => {
      SearchUtils.extractObjectNames(ql).forEach(obj => {
        vocab.add(obj);
        if (!objToIds[obj]) objToIds[obj] = [];
        objToIds[obj].push(i);
      });
    });
    return {lower, vocab: Array.from(vocab), objToIds};
  },
  simpleScore(haystack, text) {
    if (!text) return 0;
    if (haystack.includes(text)) return 1.0;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return 0;
    const hits = tokens.filter(t => haystack.includes(t)).length;
    if (hits === tokens.length) return 0.8;
    if (hits > 0) return 0.5 * (hits / tokens.length);
    return 0;
  },
  filterEntries(searchValue, lower, vocab, objToIds, originalList) {
    const input = searchValue || "";
    if (!input.trim()) return originalList.slice();
    const raw = input.replace(/^\?\s*/, "");
    const tokens = SearchUtils.splitPreservingQuotes(raw);
    if (tokens.length === 0) return originalList.slice();
    const first = SearchUtils.unquote(tokens[0]).toLowerCase();
    let candidateIds;
    if (vocab.includes(first)) {
      candidateIds = objToIds[first];
    } else {
      const prefixMatches = first ? vocab.filter(o => o.startsWith(first)) : [];
      if (prefixMatches.length > 0) {
        const idSet = new Set();
        prefixMatches.forEach(obj => { (objToIds[obj] || []).forEach(id => idSet.add(id)); });
        candidateIds = Array.from(idSet.values());
      } else {
        candidateIds = lower.map((_, i) => i);
      }
    }
    let searchText = SearchUtils.unquote(tokens.slice(1).join(" ").trim().toLowerCase());
    if (!searchText && !vocab.includes(first)) {
      const hasPrefixMatch = vocab.some(o => o.startsWith(first));
      if (!hasPrefixMatch) searchText = first;
    }
    if (SearchUtils.hasOddQuoteCount(searchText)) searchText += '"';
    const results = [];
    candidateIds.forEach(id => {
      const ql = lower[id];
      const score = SearchUtils.simpleScore(ql, searchText);
      if (score > 0 || !searchText) results.push({id, score});
    });
    results.sort((a, b) => b.score - a.score || a.id - b.id);
    return results.map(r => originalList[r.id]);
  }
};

export class DropdownHelper {
  // Highlights all occurrences of space-separated search terms in the text using <mark> tags.
  // Escapes regex characters to safely use search terms as patterns.
  static renderHighlightedText(text, searchTerm) {
    const t = text || "";
    const s = (searchTerm || "").trim();
    if (!s) return [t];
    const tokens = s.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [t];
    const escape = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp("(" + tokens.map(escape).join("|") + ")", "gi");
    const parts = t.split(pattern);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "") { continue; }
      // Reset lastIndex because test with /g advances it
      pattern.lastIndex = 0;
      if (pattern.test(part)) {
        out.push(h("mark", {key: `m-${i}`}, part));
      } else {
        out.push(part);
      }
    }
    return out;
  }

  // Highlights SOQL clauses (e.g., SELECT, FROM, WHERE) with a specific style (.clausemark)
  // and also highlights search terms within the rest of the text.
  static renderQueryWithClauseHighlight(text, searchTerm) {
    const baseParts = DropdownHelper.renderHighlightedText(text, searchTerm);
    const clauseRe = /\b(select|from|where|with|group\s+by|having|order\s+by|limit|offset|for\s+update|for\s+view|all\s+rows|using\s+scope)\b/gi;
    const out = [];
    let key = 0;
    for (const part of baseParts) {
      if (typeof part !== "string") { out.push(part); continue; }
      clauseRe.lastIndex = 0;
      if (!clauseRe.test(part)) { out.push(part); continue; }
      clauseRe.lastIndex = 0;
      let last = 0; let m;
      while ((m = clauseRe.exec(part)) !== null) {
        if (m.index > last) out.push(part.slice(last, m.index));
        out.push(h("mark", {key: `cl-${key++}`, className: "clausemark"}, m[0]));
        last = m.index + m[0].length;
      }
      if (last < part.length) out.push(part.slice(last));
    }
    return h("span", {className: "slds-truncate", title: text}, out);
  }

  // Highlights the beginning of the text if it matches the prefix.
  // Used for object search suggestions where the prefix is the search term.
  static renderHighlightedPrefix(text, prefix) {
    const t = text || "";
    const p = (prefix || "").trim();
    if (!p) return [t];
    const idx = t.toLowerCase().indexOf(p.toLowerCase());
    if (idx < 0) return [t];
    return [
      t.substring(0, idx),
      h("mark", {key: "m-0"}, t.substring(idx, idx + p.length)),
      t.substring(idx + p.length)
    ];
  }

  // Analyzes the input value to determine if it's an object search (starts with "?").
  // Returns the context including tokens, whether it's an object suggestion mode, and the prefix to search for.
  static parseSearchContext(value, model, vocabOverride = null) {
    const v = value || "";
    const raw = v.replace(/^\?\s*/, "");
    const tokens = SearchUtils.splitPreservingQuotes(raw);
    let isObjectSuggest = /^\?\s*$/.test(v) || (/^\?/.test(v) && tokens.length <= 1);
    const vocab = (vocabOverride || model.historyObjVocab || []).slice().sort();
    const prefix = SearchUtils.unquote(tokens[0] || "").toLowerCase();
    const hasCompletedObject = isObjectSuggest && tokens.length <= 1 && vocab.includes(prefix) && /\s$/.test(v);
    if (hasCompletedObject) {
      isObjectSuggest = false;
    }
    return {v, raw, tokens, isObjectSuggest, vocab, prefix};
  }

  static getObjectSuggestions(ctx) {
    return ctx.prefix ? ctx.vocab.filter(o => o.startsWith(ctx.prefix)) : ctx.vocab;
  }

  // Renders a query item with badges for saved label and tooling API
  static renderQueryItemWithBadges(entry, searchValue) {
    const queryText = entry.query || "";
    const delimiter = ":";
    let displayQuery = queryText;
    let label = null;

    // Check if query has a saved label (format: "label:query")
    if (queryText.includes(delimiter)) {
      const colonIndex = queryText.indexOf(delimiter);
      const potentialLabel = queryText.substring(0, colonIndex);
      // Only treat it as a label if it doesn't look like part of a SOQL query
      if (!potentialLabel.toLowerCase().match(/^(select|from|where|order|limit|offset|group|having)/)) {
        label = potentialLabel;
        displayQuery = queryText.substring(colonIndex + 1);
      }
    }

    return h("span", {className: "sfir-query-item-wrapper"},
      label && h("span", {className: "sfir-query-badges-start"},
        h("span", {key: "label-badge", className: "sfir-query-badge sfir-query-badge-label", title: "Saved query label"}, label)
      ),
      h("span", {className: "sfir-query-text"},
        DropdownHelper.renderQueryWithClauseHighlight(displayQuery, searchValue)
      ),
      entry.useToolingApi && h("span", {className: "sfir-query-badges-end"},
        h("span", {key: "tooling-badge", className: "sfir-query-badge sfir-query-badge-tooling", title: "Uses Tooling API"}, "Tooling")
      )
    );
  }

  // Returns history entries, switching between object suggestions (if "?" is used)
  // and standard query history filtering.
  static getHistoryEntries(model) {
    const ctx = DropdownHelper.parseSearchContext(model.historySearchValue || "", model);
    if (ctx.isObjectSuggest) {
      return {entries: DropdownHelper.getObjectSuggestions(ctx), isObjectSuggest: true};
    }
    const hasSearch = (model.historySearchValue || "").trim().length > 0;
    const entries = model.filteredHistoryEntries.length
      ? model.filteredHistoryEntries
      : (hasSearch ? [] : model.queryHistory.list);
    return {entries, isObjectSuggest: false};
  }

  // Returns saved entries, switching between object suggestions (if "?" is used)
  // and standard saved query filtering.
  static getSavedEntries(model) {
    const v = model.savedSearchValue || "";
    const ctx = DropdownHelper.parseSearchContext(v, model, model.savedObjVocab || []);
    if (ctx.isObjectSuggest) {
      return {entries: DropdownHelper.getObjectSuggestions(ctx), isObjectSuggest: true};
    }
    const hasSearch = (v || "").trim().length > 0;
    const list = (model.filteredSavedEntries && model.filteredSavedEntries.length)
      ? model.filteredSavedEntries
      : (hasSearch ? [] : ((model.savedHistory && model.savedHistory.list) ? model.savedHistory.list : []));
    return {entries: list, isObjectSuggest: false};
  }
}
