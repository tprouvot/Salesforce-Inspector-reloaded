/* eslint quotes: ["error", "single", {"avoidEscape": true}] */
export async function soqlParserTest(test) {
  console.log("TEST soql-parser");
  const {assertEquals, assert} = test;
  const {
    parseSoqlQuery,
    getCursorContext,
    getSubqueryAtCursor,
    protectStringsAndComments,
    protectSubqueries,
    findMatchingParenthesis,
    extractObjectNameFromQuery,
    getParentObjectFromSubquery
  } = await import("./soql-parser.js");

  // findMatchingParenthesis
  assertEquals(10, findMatchingParenthesis("(select id) from", 0));
  assertEquals(0, findMatchingParenthesis("(select id) from", 10));
  assertEquals(30, findMatchingParenthesis("select id, (select name from b) from a", 11));
  assertEquals(-1, findMatchingParenthesis("(select id", 0));
  assertEquals(-1, findMatchingParenthesis("select id) from", 9));

  // extractObjectNameFromQuery
  assertEquals("Account", extractObjectNameFromQuery("SELECT Id FROM Account"));
  assertEquals("Case", extractObjectNameFromQuery(" from Case"));
  assertEquals("contact", extractObjectNameFromQuery("select id, (select x from cases) from contact"));
  assertEquals(null, extractObjectNameFromQuery("select id from "));
  assertEquals("Account", extractObjectNameFromQuery("FROM Account WHERE Id = 1"));

  // getParentObjectFromSubquery
  assertEquals("Case", getParentObjectFromSubquery("select Id,(select Name from Actio ) from Case", {index: 10}));
  assertEquals("contact", getParentObjectFromSubquery("select id, (select subject from cases) from contact", {index: 11}));
  assertEquals(null, getParentObjectFromSubquery("select id, (select subject from", {index: 11}));

  // parseSoqlQuery
  const p1 = parseSoqlQuery("SELECT Id, Name FROM Account WHERE x = 1");
  assertEquals("Id, Name", p1.select.raw);
  assert(p1.select.fields.includes("Id"));
  assert(p1.select.fields.includes("Name"));
  assertEquals("Account", p1.from.objectName);
  assert(p1.where !== null);
  assertEquals("x = 1", p1.where.raw);

  const p2 = parseSoqlQuery("select Id,(select Name from Cases) from Contact");
  assertEquals(1, p2.subqueries.length);
  assertEquals(10, p2.subqueries[0].openParenPos);
  assertEquals("Cases", p2.subqueries[0].from);
  assertEquals("Contact", p2.from.objectName);

  const p3 = parseSoqlQuery("SELECT Id FROM Account LIMIT 10 OFFSET 5");
  assertEquals(10, p3.limit);
  assertEquals(5, p3.offset);

  // getCursorContext - in subquery, after from
  const ctx1 = getCursorContext("select Id,(select Name from Actio ) from Case", 32);
  assert(ctx1.isInSubquery);
  assertEquals(10, ctx1.subqueryOpenParenPos);
  assertEquals("Case", ctx1.parentObjectName);

  const ctx2 = getCursorContext("select Id,(select Name from ) from Case", 28);
  assert(ctx2.isInSubquery);
  assertEquals("Case", ctx2.parentObjectName);

  const ctx3 = getCursorContext("SELECT Id FROM Account", 17);
  assert(!ctx3.isInSubquery);
  assertEquals("Account", ctx3.objectName);

  // isChildRelationship when main FROM is at start of new line (no space before)
  const ctx4 = getCursorContext("select Id,(select Name from Cases)\nfrom Contact", 32);
  assert(ctx4.isInSubquery);
  assert(ctx4.isChildRelationship); // subquery before main FROM

  // getSubqueryAtCursor
  const p4 = parseSoqlQuery("select Id,(select Name from Cases) from Contact");
  assertEquals(null, getSubqueryAtCursor(p4, 5));
  assert(getSubqueryAtCursor(p4, 15) !== null);
  assertEquals("Cases", getSubqueryAtCursor(p4, 15).from);

  // protectStringsAndComments (strings first so '--' in string is protected)
  const pc1 = protectStringsAndComments("SELECT '--' FROM x");
  assert(!pc1.protected.includes("--"));
  assert(pc1.stringPlaceholders[0] === "'--'");

  // protectSubqueries
  const ps1 = protectSubqueries("select a,(select b from c) from d");
  assert(ps1.protected.includes("\x00SUBQUERY_0\x00"));
  assertEquals("(select b from c)", ps1.subqueryPlaceholders[0]);

  // Comments with parens: extractObjectNameFromQuery and parseSoqlQuery should ignore comment content
  const qWithComment = "select Id\n--test (select Id from ActionPlans\n,(select name from con )\n,AccountId\nfrom Account where";
  assertEquals("Account", extractObjectNameFromQuery(qWithComment));
  const pComment = parseSoqlQuery(qWithComment);
  assertEquals("Account", pComment.from.objectName);
  assertEquals(1, pComment.subqueries.length);
  assertEquals("con", pComment.subqueries[0].from);

  // cursorInString / cursorInComment (align with protectStringsAndComments)
  const qStr = "select 'hello' from Account";
  assert(!parseSoqlQuery(qStr, 0).cursorInString);
  assert(parseSoqlQuery(qStr, 10).cursorInString); // inside 'hello'
  assert(!parseSoqlQuery(qStr, 15).cursorInString); // after string
  const qStrEsc = "select 'it''s' from Account";
  assert(parseSoqlQuery(qStrEsc, 12).cursorInString); // inside escaped string
  const qBlock = "select /* comment */ id from Account";
  assert(parseSoqlQuery(qBlock, 15).cursorInComment); // inside block comment
  assert(!parseSoqlQuery(qBlock, 25).cursorInComment); // after comment
  const qLine = "select -- line\nid from Account";
  assert(parseSoqlQuery(qLine, 12).cursorInComment); // inside line comment
  assert(!parseSoqlQuery(qLine, 18).cursorInComment); // after newline
}
