/**
 * SOQL query parser - parses query text into a structured representation.
 * Handles strings, comments, and nested subqueries.
 * @module soql-parser
 */

/** Placeholder prefix for protected content (strings, comments) */
const PLACEHOLDER_PREFIX = "\x00";

/**
 * Replaces strings and comments with placeholders so they can be safely processed (e.g. for highlighting).
 * Strings are replaced first so comment patterns inside strings are not modified.
 * @param {string} text - Query text
 * @returns {{protected: string, stringPlaceholders: string[], commentPlaceholders: string[]}}
 */
export function protectStringsAndComments(text, removeComments = false) {
  const stringPlaceholders = [];
  const commentPlaceholders = [];
  const protected_ = text
    .replace(/'([^']*(?:''[^']*)*)'/g, (m) => {
      const i = stringPlaceholders.length;
      stringPlaceholders.push(m);
      return `${PLACEHOLDER_PREFIX}STR_${i}${PLACEHOLDER_PREFIX}`;
    })
    .replace(/(?:\/\*[\s\S]*?\*\/|--[^\r\n]*)/g, (m) => {
      const i = commentPlaceholders.length;
      commentPlaceholders.push(m);
      return removeComments ? "" : `${PLACEHOLDER_PREFIX}COMMENT_${i}${PLACEHOLDER_PREFIX}`;
    });
  return { protected: protected_, stringPlaceholders, commentPlaceholders };
}

export function removeComments(text) {
  let {protected: protectedQuery, stringPlaceholders} = protectStringsAndComments(text, true);
  //then restore the placeholders
  stringPlaceholders.forEach((c, i) => {
    protectedQuery = protectedQuery.replace(`\x00STR_${i}\x00`, c);
  });
  return protectedQuery;
}

/**
 * Replaces subqueries (content between parentheses) with placeholders.
 * Call after protectStringsAndComments so strings and comments are already protected.
 * Handles nested parens by replacing innermost first.
 * @param {string} text - Text with strings/comments already protected
 * @returns {{protected: string, subqueryPlaceholders: string[]}}
 */
export function protectSubqueries(text) {
  const subqueryPlaceholders = [];
  let work = text;
  let prev;
  do {
    prev = work;
    work = work.replace(/\(([^()]*)\)/g, (m) => {
      const i = subqueryPlaceholders.length;
      subqueryPlaceholders.push(m);
      return `${PLACEHOLDER_PREFIX}SUBQUERY_${i}${PLACEHOLDER_PREFIX}`;
    });
  } while (prev !== work);
  return { protected: work, subqueryPlaceholders };
}

/**
 * Regex to match all placeholder types for restoration.
 * Use with protectStringsAndComments.
 */
export const PLACEHOLDER_REGEX = /\x00(COMMENT|STR)_(\d+)\x00/g;

/**
 * Finds the position of the parenthesis matching the one at pos.
 * Skips parentheses inside single-quoted strings and comments.
 * @param {string} text - The query text
 * @param {number} pos - Position of ( or )
 * @returns {number} Position of matching paren, or -1 if not found
 */
export function findMatchingParenthesis(text, pos) {
  if (pos < 0 || pos >= text.length) return -1;
  const char = text[pos];
  if (char === "(") {
    let depth = 1;
    let inString = false;
    let inBlockComment = false;
    let inLineComment = false;
    for (let i = pos + 1; i < text.length; i++) {
      const c = text[i];
      const prev = i > 0 ? text[i - 1] : "";
      const next = i + 1 < text.length ? text[i + 1] : "";
      if (inLineComment) {
        if (c === "\n" || c === "\r") inLineComment = false;
        continue;
      }
      if (inBlockComment) {
        if (c === "*" && next === "/") inBlockComment = false;
        continue;
      }
      if (c === "'" && prev !== "\\") inString = !inString;
      if (!inString) {
        if (c === "/" && next === "*") inBlockComment = true;
        else if (c === "-" && next === "-") inLineComment = true;
        else if (!inBlockComment && !inLineComment) {
          if (c === "(") depth++;
          else if (c === ")") {
            depth--;
            if (depth === 0) return i;
          }
        }
      }
    }
    return -1;
  }
  if (char === ")") {
    let depth = 1;
    let inString = false;
    let inBlockComment = false;
    let inLineComment = false;
    for (let i = pos - 1; i >= 0; i--) {
      const c = text[i];
      const prev = i > 0 ? text[i - 1] : "";
      const next = i + 1 < text.length ? text[i + 1] : "";
      if (inLineComment) {
        if (c === "-" && next === "-") inLineComment = false; // saw --, exiting line comment
        continue;
      }
      if (inBlockComment) {
        if (c === "/" && prev === "*") inBlockComment = false; // saw /*, exiting block comment
        continue;
      }
      if (c === "'" && next !== "\\") inString = !inString;
      if (!inString) {
        if (c === "*" && next === "/") inBlockComment = true; // saw */, entering block comment
        else if (c === "\n" || c === "\r") inLineComment = true; // saw newline, entering line comment
        else if (!inBlockComment && !inLineComment) {
          if (c === ")") depth++;
          else if (c === "(") {
            depth--;
            if (depth === 0) return i;
          }
        }
      }
    }
    return -1;
  }
  return -1;
}

/**
 * Extracts the object name from the first FROM clause.
 * Sanitizes input (strings, comments, subqueries → placeholders) so a simple regex suffices.
 * @param {string} queryText - SOQL query or fragment
 * @returns {string|null} Object API name from FROM clause
 */
export function extractObjectNameFromQuery(queryText) {
  if (!queryText) return null;
  const { protected: noStrings } = protectStringsAndComments(queryText);
  const { protected: flat } = protectSubqueries(noStrings);
  const m = /\bfrom\s+([a-zA-Z0-9_]+)/i.exec(flat);
  return m ? m[1] : null;
}

/**
 * Subquery info with position and parsed structure.
 * @typedef {{openParenPos: number, closeParenPos: number, from: string|null, raw: string}} SubqueryInfo
 */

/**
 * Parsed SOQL query structure.
 * @typedef {{
 *   raw: string,
 *   select: {raw: string, fields: string[]},
 *   from: {objectName: string|null, raw: string},
 *   where: {raw: string}|null,
 *   orderBy: {raw: string}|null,
 *   groupBy: {raw: string}|null,
 *   having: {raw: string}|null,
 *   limit: number|null,
 *   offset: number|null,
 *   subqueries: SubqueryInfo[]
 * }} ParsedSoql
 */

/**
 * Parses SOQL query text into a structured representation.
 * Handles partial/invalid queries gracefully.
 * @param {string} query - Full SOQL query text
 * @returns {ParsedSoql}
 */
export function parseSoqlQuery(query, cursorPos = -1) {
  const result = {
    raw: query,
    select: { raw: "", fields: [] },
    from: { objectName: null, raw: "" },
    where: null,
    orderBy: null,
    groupBy: null,
    having: null,
    limit: null,
    offset: null,
    subqueries: [],
    cursorInString: false,
    cursorInComment: false
  };

  if (!query || typeof query !== "string") return result;

  // Check if cursor is in a string or comment (aligns with protectStringsAndComments logic)
  if (cursorPos >= 0 && cursorPos <= query.length) {
    let inString = false;
    let inBlockComment = false;
    let inLineComment = false;
    let i = 0;
    while (i < cursorPos) {
      const c = query[i];
      const next = i + 1 < query.length ? query[i + 1] : "";
      if (inLineComment) {
        if (c === "\n" || c === "\r") inLineComment = false;
        i++;
        continue;
      }
      if (inBlockComment) {
        if (c === "*" && next === "/") {
          inBlockComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (inString) {
        if (c === "'") {
          if (next === "'") {
            i += 2; // skip escaped ''
            continue;
          }
          inString = false;
        }
        i++;
        continue;
      }
      if (c === "'") {
        inString = true;
        i++;
        continue;
      }
      if (c === "/" && next === "*") {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (c === "-" && next === "-") {
        inLineComment = true;
        i += 2;
        continue;
      }
      i++;
    }
    result.cursorInString = inString;
    result.cursorInComment = inBlockComment || inLineComment;
  }

  //remove all the comments
  const { protected: protectedQuery, stringPlaceholders, commentPlaceholders } = protectStringsAndComments(query, true);

  //extract the subqueries (positions are in protected query)
  const subqueriesProtected = findSubqueries(protectedQuery);

  // Convert subquery positions from protected to raw so cursor comparison works correctly
  const subqueries = subqueriesProtected.map(s => ({
    openParenPos: protectedToRawPos(protectedQuery, stringPlaceholders, commentPlaceholders, s.openParenPos),
    closeParenPos: protectedToRawPos(protectedQuery, stringPlaceholders, commentPlaceholders, s.closeParenPos),
    from: s.from,
    raw: s.raw
  }));

  // For clause splitting, use protected query with subquery placeholders
  let sanitizedQuery = protectedQuery;
  subqueriesProtected.forEach((s, i) => {
    sanitizedQuery = sanitizedQuery.replace(s.raw, `${PLACEHOLDER_PREFIX}SUBQUERY_${i}${PLACEHOLDER_PREFIX}`);
  });

  const clauses = splitClauses(sanitizedQuery);
  result.select = parseSelectClause(clauses.select || "");
  result.from = { objectName: clauses.from || null, raw: clauses.from ? "from " + clauses.from : "" };
  if (clauses.where) result.where = { raw: clauses.where.trim() };
  if (clauses.orderBy) result.orderBy = { raw: clauses.orderBy.trim() };
  if (clauses.groupBy) result.groupBy = { raw: clauses.groupBy.trim() };
  if (clauses.having) result.having = { raw: clauses.having.trim() };
  if (clauses.limit) {
    const n = parseInt(clauses.limit.trim(), 10);
    result.limit = isNaN(n) ? null : n;
  }
  if (clauses.offset) {
    const n = parseInt(clauses.offset.trim(), 10);
    result.offset = isNaN(n) ? null : n;
  }

  result.subqueries = subqueries;
  result.sanitizedQuery = sanitizedQuery;

  return result;
}

/**
 * Splits sanitized query into clauses. Input has strings and subqueries replaced with placeholders,
 * so a single regex split is sufficient (no depth/string/comment tracking needed).
 * @param {string} sanitizedQuery - Query with \x00STR_N\x00 and \x00SUBQUERY_N\x00 placeholders
 * @returns {{select?: string, from?: string, where?: string, orderBy?: string, groupBy?: string, having?: string, limit?: string, offset?: string}}
 */
function splitClauses(sanitizedQuery) {
  const clauseRe = /\b(select|from|where|order\s+by|group\s+by|having|limit|offset)\b/gi;
  const kwMap = { "order by": "orderBy", "group by": "groupBy" };
  const parts = sanitizedQuery.split(clauseRe);
  const clauses = {};
  for (let i = 1; i < parts.length; i += 2) {
    const kw = parts[i].toLowerCase().replace(/\s+/g, " ");
    const key = kwMap[kw] || kw;
    const clauseText = (parts[i + 1] ?? "").trim();
    if (clauseText) clauses[key] = clauseText;
  }
  return clauses;
}

/**
 * Parses sanitized SELECT clause into fields. Input has strings/subqueries as placeholders,
 * so a simple comma split is sufficient (no depth/string tracking needed).
 */
function parseSelectClause(text) {
  const fields = text ? text.split(",").map(f => f.trim()).filter(Boolean) : [];
  return { raw: text, fields };
}

/**
 * Maps a position in the protected query (strings/comments replaced) to the raw query.
 * @param {string} protectedQuery
 * @param {string[]} stringPlaceholders
 * @param {string[]} commentPlaceholders
 * @param {number} protectedPos
 * @returns {number}
 */
function protectedToRawPos(protectedQuery, stringPlaceholders, commentPlaceholders, protectedPos) {
  const strRe = /\x00STR_(\d+)\x00/g;
  const commentRe = /\x00COMMENT_(\d+)\x00/g;
  let rawPos = 0;
  let lastEnd = 0;
  let m;
  const allPlaceholders = [];
  while ((m = strRe.exec(protectedQuery)) !== null) {
    allPlaceholders.push({ index: m.index, end: m.index + m[0].length, rawLen: stringPlaceholders[parseInt(m[1], 10)].length, placeholderLen: m[0].length });
  }
  while ((m = commentRe.exec(protectedQuery)) !== null) {
    allPlaceholders.push({ index: m.index, end: m.index + m[0].length, rawLen: commentPlaceholders[parseInt(m[1], 10)].length, placeholderLen: m[0].length });
  }
  allPlaceholders.sort((a, b) => a.index - b.index);
  for (const p of allPlaceholders) {
    if (protectedPos <= p.index) return rawPos + (protectedPos - lastEnd);
    rawPos += p.index - lastEnd;
    rawPos += p.rawLen;
    lastEnd = p.end;
  }
  return rawPos + (protectedPos - lastEnd);
}

/**
 * Finds all subqueries (SELECT inside parentheses) with positions.
 * Positions are in the protected query; call protectedToRawPos to convert for cursor comparison.
 * @param {string} query - Protected query (strings/comments replaced)
 * @returns {SubqueryInfo[]}
 */
function findSubqueries(query) {
  const subqueries = [];
  // Match ( SELECT: optionally ( closing ) or first " from [object]" — stops at second "from" for cases like (select from contact from Account
  const subqueryRe = /\(\s*select\b(?:\s*\)|[\s\S]*?\bfrom\s+[a-zA-Z0-9_]*)?/gi;
  let m;
  while ((m = subqueryRe.exec(query)) !== null) {
    const openPos = m.index;
    const closePos = findMatchingParenthesis(query, openPos);
    const isIncomplete = closePos === -1;
    const raw = isIncomplete ? m[0] : query.slice(openPos, closePos + 1);
    const inner = isIncomplete ? raw.slice(1) : raw.slice(1, -1);
    subqueries.push({
      openParenPos: openPos,
      closeParenPos: openPos + raw.length - 1,
      from: extractObjectNameFromQuery(inner),
      raw
    });
  }
  return subqueries;
}

/**
 * Context at a given cursor position (for autocomplete, highlighting, etc.).
 * @typedef {{
 *   isInSubquery: boolean,
 *   subqueryOpenParenPos: number,
 *   subqueryCloseParenPos: number,
 *   parentObjectName: string|null,
 *   objectName: string|null,
 *   isAfterFrom: boolean,
 *   textBeforeCursor: string
 * }} CursorContext
 */

/**
 * Maps a position in sanitized query (with subquery placeholders) to the raw query.
 * @param {string} sanitizedQuery
 * @param {number} sanitizedPos
 * @param {SubqueryInfo[]} subqueries
 * @returns {number}
 */
function sanitizedToRawPos(sanitizedQuery, sanitizedPos, subqueries) {
  const re = /\x00SUBQUERY_(\d+)\x00/g;
  let rawPos = 0;
  let lastEnd = 0;
  let m;
  while ((m = re.exec(sanitizedQuery)) !== null) {
    if (sanitizedPos <= m.index) return rawPos + (sanitizedPos - lastEnd);
    rawPos += m.index - lastEnd;
    rawPos += subqueries[parseInt(m[1], 10)].raw.length;
    lastEnd = m.index + m[0].length;
  }
  return rawPos + (sanitizedPos - lastEnd);
}

/**
 * Returns the innermost subquery containing the cursor position, or null.
 * @param {ParsedSoql} parsed - Result of parseSoqlQuery
 * @param {number} cursorPos - Cursor position
 * @returns {SubqueryInfo|null}
 */
export function getSubqueryAtCursor(parsed, cursorPos) {
  const containing = parsed.subqueries.filter(
    s => cursorPos > s.openParenPos && cursorPos <= s.closeParenPos + 1
  );
  return containing.length ? containing[containing.length - 1] : null;
}

/**
 * Gets context at cursor position for autocomplete and related features.
 * Leverages parseSoqlQuery and getSubqueryAtCursor for subquery info.
 * @param {string} query - Full query text
 * @param {number} cursorPos - Cursor position (selectionStart)
 * @param {ParsedSoql} [parsed] - Optional pre-parsed result to avoid re-parsing
 * @returns {CursorContext}
 */
export function getCursorContext(query, cursorPos, parsed) {
  const ctx = {
    isInSubquery: false,
    isInString: false,
    isInComment: false,
    isChildRelationship: false,
    isInSelectClause: false,
    subqueryOpenParenPos: -1,
    subqueryCloseParenPos: -1,
    parentObjectName: null,
    objectName: null,
    justAfterFromMatch: false,
    textBeforeCursor: query.substring(0, cursorPos)
  };

  const parsedResult = parsed ?? parseSoqlQuery(query, cursorPos);
  ctx.isInString = parsedResult.cursorInString;
  ctx.isInComment = parsedResult.cursorInComment;

  if(ctx.isInString || ctx.isInComment || !query) {
    return ctx;
  }

  const subquery = getSubqueryAtCursor(parsedResult, cursorPos);

  ctx.justAfterFromMatch = ctx.textBeforeCursor.match(/(^|\s)from\s+([a-z0-9_]*)$/i);

  // Main FROM is the only one in sanitized query (subqueries are placeholders)
  const mainFromPosInSanitized = parsedResult.sanitizedQuery.indexOf(parsedResult.from.raw);
  const mainFromPosInRaw = mainFromPosInSanitized >= 0
    ? sanitizedToRawPos(parsedResult.sanitizedQuery, mainFromPosInSanitized, parsedResult.subqueries)
    : -1;

  if (subquery) {
    ctx.isInSubquery = true;
    ctx.subqueryOpenParenPos = subquery.openParenPos;
    ctx.subqueryCloseParenPos = subquery.closeParenPos;
    ctx.parentObjectName = getParentObjectFromSubquery(query, {index: subquery.openParenPos}, parsedResult);
    ctx.objectName = subquery.from;
    ctx.isChildRelationship = mainFromPosInRaw >= 0 && subquery.openParenPos < mainFromPosInRaw;
    // Cursor is in SELECT of this subquery if it's before the subquery's FROM
    const subqueryInner = query.substring(subquery.openParenPos + 1, subquery.closeParenPos);
    const fromInSubquery = /\bfrom\s+/i.exec(subqueryInner);
    ctx.isInSelectClause = fromInSubquery !== null && cursorPos < subquery.openParenPos + 1 + fromInSubquery.index;
  } else {
    ctx.objectName = parsedResult.from.objectName;
    ctx.isInSelectClause = mainFromPosInRaw >= 0 && cursorPos < mainFromPosInRaw;
  }
  return ctx;
}

/**
 * Gets the parent object name when cursor is inside a subquery.
 * @param {string} query - Full SOQL query
 * @param {{index: number}} subqueryFromMatch - Object with index = position of opening (
 * @param {ParsedSoql} [parsed] - Optional pre-parsed result to avoid re-parsing
 * @returns {string|null}
 */
export function getParentObjectFromSubquery(query, subqueryFromMatch, parsed) {
  const openPos = subqueryFromMatch.index;
  const closePos = findMatchingParenthesis(query, openPos);
  const textAfter = closePos === -1 ? "" : query.substring(closePos + 1);
  const parentFromAfter = extractObjectNameFromQuery(textAfter);
  if (parentFromAfter) return parentFromAfter;
  return (parsed ?? parseSoqlQuery(query)).from.objectName;
}
