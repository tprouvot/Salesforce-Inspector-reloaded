/**
 * Client side field-to-field comparison for the Data Export SOQL editor.
 *
 * SOQL cannot compare two fields of the same record, so "WHERE Field1__c = Field2__c"
 * is rejected by Salesforce. This module detects such conditions, removes them from the
 * query that is sent to Salesforce, makes sure both operands are part of the SELECT
 * clause, and exposes a predicate used to filter the returned records in the browser.
 *
 * Only "=" and "!=" are supported, and only when the condition is a top level AND
 * condition of the WHERE clause. A condition nested in an OR / NOT / parenthesis cannot
 * be removed without changing which records Salesforce returns, so it is rejected
 * instead of being silently mishandled.
 *
 * This module has no DOM and no Salesforce dependency so it can be unit tested alone.
 */

export const SUPPORTED_OPERATORS = ["=", "!="];

// Values that look like an identifier but are literals, so they never denote a field.
const RESERVED_WORDS = new Set([
  "null", "true", "false",
  "yesterday", "today", "tomorrow",
  "last_week", "this_week", "next_week",
  "last_month", "this_month", "next_month",
  "last_90_days", "next_90_days",
  "this_quarter", "last_quarter", "next_quarter",
  "this_year", "last_year", "next_year",
  "this_fiscal_quarter", "last_fiscal_quarter", "next_fiscal_quarter",
  "this_fiscal_year", "last_fiscal_year", "next_fiscal_year",
  "last_n_days", "next_n_days", "n_days_ago",
  "last_n_weeks", "next_n_weeks", "n_weeks_ago",
  "last_n_months", "next_n_months", "n_months_ago",
  "last_n_quarters", "next_n_quarters", "n_quarters_ago",
  "last_n_years", "next_n_years", "n_years_ago",
  "last_n_fiscal_quarters", "next_n_fiscal_quarters", "n_fiscal_quarters_ago",
  "last_n_fiscal_years", "next_n_fiscal_years", "n_fiscal_years_ago"
]);

// Maps a describe field type to the category used to compare two values.
// A type that is absent from this map cannot be compared.
const TYPE_CATEGORIES = {
  string: "text",
  textarea: "text",
  picklist: "text",
  multipicklist: "text",
  combobox: "text",
  email: "text",
  phone: "text",
  url: "text",
  id: "id",
  reference: "id",
  int: "number",
  long: "number",
  double: "number",
  currency: "number",
  percent: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  time: "time"
};

// Clauses that may follow the WHERE clause, used to find where the WHERE clause ends.
const CLAUSES_AFTER_WHERE = /(^|\s)(with\s+|group\s+by\s|having\s|order\s+by\s|limit\s|offset\s|for\s+(update|view|reference)|update\s+(tracking|viewstat))/gi;

const AGGREGATE_CLAUSE = /(^|\s)(group\s+by\s|having\s)/i;
const AGGREGATE_FUNCTION = /(^|[\s,(])(count|count_distinct|sum|avg|min|max)\s*\(/i;

// A candidate is "identifier operator identifier". Dots are captured so that
// relationship paths can be reported as unsupported instead of being ignored.
const CANDIDATE_PATTERN = /([a-z][a-z0-9_.]*)\s*(!=|=)\s*([a-z][a-z0-9_.]*)/gi;

/**
 * Records, for every character of the query, the parenthesis depth and whether the
 * character sits inside a string literal. Used to only act on top level tokens.
 */
function scanQuery(query) {
  let depths = new Array(query.length);
  let inStrings = new Array(query.length);
  let depth = 0;
  let inString = false;
  for (let i = 0; i < query.length; i++) {
    let c = query[i];
    depths[i] = depth;
    inStrings[i] = inString;
    if (inString) {
      if (c == "\\") {
        i++;
        if (i < query.length) {
          depths[i] = depth;
          inStrings[i] = true;
        }
      } else if (c == "'") {
        inString = false;
      }
    } else if (c == "'") {
      inStrings[i] = true;
      inString = true;
    } else if (c == "(") {
      depth++;
    } else if (c == ")") {
      depth--;
      depths[i] = depth;
    }
  }
  return {depths, inStrings};
}

function isTopLevel(scanned, index) {
  return scanned.depths[index] === 0 && !scanned.inStrings[index];
}

/**
 * Returns the first match of a global regex that is at the top level of the query,
 * or null when there is none.
 */
function matchTopLevel(query, scanned, pattern, fromIndex = 0) {
  pattern.lastIndex = fromIndex;
  let match;
  while ((match = pattern.exec(query)) !== null) {
    // The keyword patterns capture a leading separator, so skip it before testing.
    let keywordIndex = match.index + (match[0].length - match[0].trimStart().length);
    if (isTopLevel(scanned, keywordIndex)) {
      return {index: keywordIndex, length: match[0].length - (keywordIndex - match.index)};
    }
    pattern.lastIndex = match.index + 1;
  }
  return null;
}

/**
 * Splits a range of the query on top level commas.
 */
function splitTopLevel(query, scanned, start, end, separator) {
  let parts = [];
  let partStart = start;
  for (let i = start; i < end; i++) {
    if (query[i] === separator && isTopLevel(scanned, i)) {
      parts.push({start: partStart, end: i});
      partStart = i + 1;
    }
  }
  parts.push({start: partStart, end});
  return parts;
}

/**
 * Splits the WHERE clause body on top level AND keywords.
 */
function splitConjuncts(query, scanned, start, end) {
  let pattern = /(^|\s)and(\s|$)/gi;
  let parts = [];
  let partStart = start;
  pattern.lastIndex = start;
  let match;
  while ((match = pattern.exec(query)) !== null) {
    if (match.index >= end) {
      break;
    }
    let keywordIndex = match.index + (match[0].length - match[0].trimStart().length);
    if (isTopLevel(scanned, keywordIndex)) {
      parts.push({start: partStart, end: match.index});
      partStart = keywordIndex + 3;
    }
    pattern.lastIndex = match.index + 1;
  }
  parts.push({start: partStart, end});
  return parts.filter(part => query.slice(part.start, part.end).trim().length > 0);
}

function hasTopLevelKeyword(query, scanned, start, end, keyword) {
  let pattern = new RegExp("(^|\\s)" + keyword + "(\\s|\\()", "gi");
  pattern.lastIndex = start;
  let match;
  while ((match = pattern.exec(query)) !== null) {
    if (match.index >= end) {
      return false;
    }
    let keywordIndex = match.index + (match[0].length - match[0].trimStart().length);
    if (isTopLevel(scanned, keywordIndex)) {
      return true;
    }
    pattern.lastIndex = match.index + 1;
  }
  return false;
}

function isReserved(token) {
  return RESERVED_WORDS.has(token.toLowerCase());
}

/**
 * Locates the SELECT list, the object name and the WHERE clause of a SOQL query.
 * Returns null when the query is not a plain SELECT query.
 */
function parseQueryShape(query) {
  let scanned = scanQuery(query);
  let select = matchTopLevel(query, scanned, /(^|\s)select(\s|$)/gi);
  let from = matchTopLevel(query, scanned, /(^|\s)from(\s|$)/gi);
  if (!select || !from || from.index < select.index) {
    return null;
  }
  let selectListStart = select.index + "select".length;
  let selectListEnd = from.index;
  let objectMatch = /^\s*([a-z0-9_]+)/i.exec(query.slice(from.index + "from".length));
  if (!objectMatch) {
    return null;
  }
  let whereKeyword = matchTopLevel(query, scanned, /(^|\s)where(\s|$)/gi, from.index);
  let where = null;
  if (whereKeyword) {
    let bodyStart = whereKeyword.index + "where".length;
    let next = matchTopLevel(query, scanned, CLAUSES_AFTER_WHERE, bodyStart);
    where = {
      keywordStart: whereKeyword.index,
      bodyStart,
      bodyEnd: next ? next.index : query.length
    };
  }
  return {scanned, selectListStart, selectListEnd, sobjectName: objectMatch[1], where};
}

/**
 * Finds every "identifier operator identifier" condition of the WHERE clause and flags
 * the ones that are a top level AND condition.
 */
function findCandidates(query, shape) {
  let where = shape.where;
  let conjuncts = splitConjuncts(query, shape.scanned, where.bodyStart, where.bodyEnd);
  let simplePattern = /^\s*([a-z][a-z0-9_.]*)\s*(!=|=)\s*([a-z][a-z0-9_.]*)\s*$/i;
  let topLevelByStart = new Map();
  for (let conjunct of conjuncts) {
    let text = query.slice(conjunct.start, conjunct.end);
    let match = simplePattern.exec(text);
    if (match && !isReserved(match[1]) && !isReserved(match[3])) {
      topLevelByStart.set(conjunct.start, {left: match[1], operator: match[2], right: match[3], conjunct});
    }
  }

  let candidates = [];
  let seen = new Set();
  for (let entry of topLevelByStart.values()) {
    candidates.push({...entry, topLevel: true});
    seen.add(entry.conjunct.start + ":" + entry.conjunct.end);
  }

  // Safety net: a condition that we did not accept as a top level AND condition, but
  // that still looks like a field comparison, must be reported rather than ignored.
  CANDIDATE_PATTERN.lastIndex = where.bodyStart;
  let match;
  while ((match = CANDIDATE_PATTERN.exec(query)) !== null) {
    if (match.index >= where.bodyEnd) {
      break;
    }
    if (shape.scanned.inStrings[match.index]) {
      continue;
    }
    if (isReserved(match[1]) || isReserved(match[3])) {
      continue;
    }
    let insideAccepted = [...topLevelByStart.values()].some(entry =>
      match.index >= entry.conjunct.start && match.index < entry.conjunct.end);
    if (!insideAccepted) {
      candidates.push({left: match[1], operator: match[2], right: match[3], conjunct: null, topLevel: false});
    }
  }
  return {candidates, conjuncts, acceptedStarts: seen};
}

function findField(sobjectDescribe, name) {
  let lower = name.toLowerCase();
  return sobjectDescribe.fields.find(field => field.name.toLowerCase() === lower) || null;
}

function categoryOf(field) {
  return TYPE_CATEGORIES[field.type] || null;
}

/**
 * Lists the fields of the SELECT clause, so that operands that are already selected are
 * not added a second time.
 */
function describeSelectList(query, shape) {
  let items = splitTopLevel(query, shape.scanned, shape.selectListStart, shape.selectListEnd, ",")
    .map(part => query.slice(part.start, part.end).trim())
    .filter(item => item.length > 0);
  let names = new Set();
  let fieldsAll = false;
  let fieldsStandard = false;
  let fieldsCustom = false;
  for (let item of items) {
    let normalized = item.toLowerCase();
    if (/^fields\s*\(\s*all\s*\)$/.test(normalized)) {
      fieldsAll = true;
    } else if (/^fields\s*\(\s*standard\s*\)$/.test(normalized)) {
      fieldsStandard = true;
    } else if (/^fields\s*\(\s*custom\s*\)$/.test(normalized)) {
      fieldsCustom = true;
    } else {
      // Drop a possible alias ("Name n") and keep the expression itself.
      names.add(normalized.split(/\s+/)[0]);
    }
  }
  return {names, fieldsAll, fieldsStandard, fieldsCustom};
}

function isAlreadySelected(selectList, field) {
  if (selectList.fieldsAll) {
    return true;
  }
  if (selectList.fieldsStandard && !field.custom) {
    return true;
  }
  if (selectList.fieldsCustom && field.custom) {
    return true;
  }
  return selectList.names.has(field.name.toLowerCase());
}

/**
 * Rebuilds the query without the accepted conditions and with the missing operands
 * added to the SELECT clause.
 */
function rewriteQuery(query, shape, acceptedConjuncts, fieldsToInject) {
  let where = shape.where;
  let kept = splitConjuncts(query, shape.scanned, where.bodyStart, where.bodyEnd)
    .filter(conjunct => !acceptedConjuncts.some(accepted => accepted.start === conjunct.start && accepted.end === conjunct.end))
    .map(conjunct => query.slice(conjunct.start, conjunct.end).trim());

  let head = query.slice(0, where.keywordStart).trimEnd();
  let tail = query.slice(where.bodyEnd).trim();
  let rewritten;
  if (kept.length > 0) {
    rewritten = head + " WHERE " + kept.join(" AND ");
  } else {
    rewritten = head;
  }
  if (tail) {
    rewritten += " " + tail;
  }

  if (fieldsToInject.length > 0) {
    // The SELECT clause is always before the WHERE clause, so its offsets are still valid.
    let selectHead = rewritten.slice(0, shape.selectListEnd).trimEnd();
    let selectTail = rewritten.slice(shape.selectListEnd).trim();
    rewritten = selectHead + ", " + fieldsToInject.join(", ") + " " + selectTail;
  }
  return rewritten.trim();
}

/**
 * Analyses a SOQL query and, when it contains field-to-field conditions, returns the
 * query to send to Salesforce plus the comparisons to apply in the browser.
 *
 * Call it once without a describe to know whether the query is concerned at all
 * (`needsDescribe`), then a second time with the describe of `sobjectName`.
 *
 * @param {string} query The query typed by the user.
 * @param {object|null} sobjectDescribe The DescribeSObjectResult of the queried object.
 * @returns {object} The analysis result.
 */
export function analyzeFieldComparisons(query, sobjectDescribe = null) {
  let result = {
    applies: false,
    needsDescribe: false,
    sobjectName: null,
    query,
    originalQuery: query,
    comparisons: [],
    injectedFields: [],
    removedWhere: false,
    errors: [],
    warnings: []
  };
  if (!query || !query.trim()) {
    return result;
  }
  let shape = parseQueryShape(query);
  if (!shape || !shape.where) {
    return result;
  }
  result.sobjectName = shape.sobjectName;

  let {candidates} = findCandidates(query, shape);
  if (candidates.length === 0) {
    return result;
  }
  if (!sobjectDescribe) {
    result.needsDescribe = true;
    return result;
  }

  let accepted = [];
  for (let candidate of candidates) {
    if (candidate.left.includes(".") || candidate.right.includes(".")) {
      result.errors.push(`Relationship fields are not supported in field-to-field comparisons yet: "${candidate.left} ${candidate.operator} ${candidate.right}".`);
      continue;
    }
    let leftField = findField(sobjectDescribe, candidate.left);
    let rightField = findField(sobjectDescribe, candidate.right);
    if (!leftField || !rightField) {
      // At least one operand is not a field, so this is a normal condition that
      // Salesforce has to handle (and report on) itself.
      continue;
    }
    if (!candidate.topLevel) {
      result.errors.push(`"${candidate.left} ${candidate.operator} ${candidate.right}" compares two fields, which is only supported as a top level AND condition. Conditions inside OR, NOT or parentheses cannot be evaluated in the browser.`);
      continue;
    }
    let leftCategory = categoryOf(leftField);
    let rightCategory = categoryOf(rightField);
    if (!leftCategory || !rightCategory) {
      let unsupported = !leftCategory ? leftField : rightField;
      result.errors.push(`Field "${unsupported.name}" has type "${unsupported.type}", which cannot be compared in the browser.`);
      continue;
    }
    let isIdTextPair = (leftCategory === "id" && rightCategory === "text") || (leftCategory === "text" && rightCategory === "id");
    if (leftCategory !== rightCategory && !isIdTextPair) {
      result.errors.push(`Cannot compare "${leftField.name}" (${leftField.type}) with "${rightField.name}" (${rightField.type}) because they have different types.`);
      continue;
    }
    if (isIdTextPair) {
      result.warnings.push(`"${leftField.name}" and "${rightField.name}" mix an Id field with a text field, the comparison is case sensitive.`);
    }
    accepted.push({
      left: leftField.name,
      right: rightField.name,
      operator: candidate.operator,
      category: leftCategory === "id" || rightCategory === "id" ? "id" : leftCategory,
      conjunct: candidate.conjunct,
      leftField,
      rightField
    });
  }

  if (result.errors.length > 0) {
    return result;
  }
  if (accepted.length === 0) {
    return result;
  }

  if (AGGREGATE_CLAUSE.test(query) || AGGREGATE_FUNCTION.test(query.slice(shape.selectListStart, shape.selectListEnd))) {
    result.errors.push("Field-to-field comparisons cannot be combined with aggregate queries (GROUP BY, HAVING, COUNT, SUM, AVG, MIN, MAX).");
    return result;
  }
  if (hasTopLevelKeyword(query, shape.scanned, shape.where.bodyEnd, query.length, "offset")) {
    result.errors.push("Field-to-field comparisons cannot be combined with OFFSET, because Salesforce applies the offset before the browser filters the records.");
    return result;
  }

  let selectList = describeSelectList(query, shape);
  let injected = [];
  for (let comparison of accepted) {
    for (let field of [comparison.leftField, comparison.rightField]) {
      if (!isAlreadySelected(selectList, field) && !injected.includes(field.name)) {
        injected.push(field.name);
        selectList.names.add(field.name.toLowerCase());
      }
    }
  }

  let acceptedConjuncts = accepted.map(comparison => comparison.conjunct);
  let remaining = splitConjuncts(query, shape.scanned, shape.where.bodyStart, shape.where.bodyEnd)
    .filter(conjunct => !acceptedConjuncts.some(accepted2 => accepted2.start === conjunct.start && accepted2.end === conjunct.end));

  result.applies = true;
  result.query = rewriteQuery(query, shape, acceptedConjuncts, injected);
  result.injectedFields = injected;
  result.removedWhere = remaining.length === 0;
  result.comparisons = accepted.map(comparison => ({
    left: comparison.left,
    right: comparison.right,
    operator: comparison.operator,
    category: comparison.category
  }));
  if (result.removedWhere) {
    result.warnings.push(`The WHERE clause only contained field comparisons, so ${shape.sobjectName} is queried without any filter. Add another condition or a LIMIT to keep the query selective.`);
  }
  return result;
}

function normalizeValue(value, category, caseSensitive) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  switch (category) {
    case "number": {
      let number = Number(value);
      return Number.isNaN(number) ? null : number;
    }
    case "boolean":
      return value === true || value === "true";
    case "date":
    case "datetime": {
      let time = Date.parse(value);
      return Number.isNaN(time) ? String(value) : time;
    }
    case "id":
      // Ids are returned by the API in their canonical 18 character form, so they are
      // always compared case sensitively.
      return String(value);
    case "time":
      return String(value);
    default:
      return caseSensitive ? String(value) : String(value).toLowerCase();
  }
}

/**
 * Tells whether a record satisfies every comparison.
 *
 * Null handling: two null values are equal, a null and a non null value are not.
 *
 * @param {object} record A record as returned by the REST API.
 * @param {Array} comparisons The comparisons returned by analyzeFieldComparisons.
 * @param {object} options `caseSensitive` makes text comparisons case sensitive.
 * @returns {boolean} true when the record must be kept.
 */
export function recordMatches(record, comparisons, {caseSensitive = false} = {}) {
  for (let comparison of comparisons) {
    let left = normalizeValue(record[comparison.left], comparison.category, caseSensitive);
    let right = normalizeValue(record[comparison.right], comparison.category, caseSensitive);
    let equal = left === null && right === null ? true : left === right;
    if (comparison.operator === "=" ? !equal : equal) {
      return false;
    }
  }
  return true;
}

/**
 * Human readable description of the comparisons, used in the UI.
 */
export function describeComparisons(comparisons) {
  return comparisons.map(comparison => `${comparison.left} ${comparison.operator} ${comparison.right}`).join(" AND ");
}
