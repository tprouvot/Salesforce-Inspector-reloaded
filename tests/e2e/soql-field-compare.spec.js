import {test, expect} from "@playwright/test";
import {analyzeFieldComparisons, recordMatches, describeComparisons} from "../../addon/soql-field-compare.js";

// Minimal describe used by every test, it only needs "name", "type" and "custom".
const CONTACT_DESCRIBE = {
  name: "Contact",
  fields: [
    {name: "Id", type: "id", custom: false},
    {name: "LastName", type: "string", custom: false},
    {name: "FirstName", type: "string", custom: false},
    {name: "OwnerId", type: "reference", custom: false},
    {name: "CreatedById", type: "reference", custom: false},
    {name: "Field1__c", type: "string", custom: true},
    {name: "Field2__c", type: "string", custom: true},
    {name: "Num1__c", type: "double", custom: true},
    {name: "Num2__c", type: "double", custom: true},
    {name: "Start__c", type: "date", custom: true},
    {name: "End__c", type: "date", custom: true},
    {name: "When__c", type: "datetime", custom: true},
    {name: "Addr__c", type: "address", custom: true}
  ]
};

function analyze(query) {
  return analyzeFieldComparisons(query, CONTACT_DESCRIBE);
}

function comparisonsOf(query) {
  return analyze(query).comparisons;
}

test.describe("SOQL field comparison - query rewriting", () => {

  test("Removes the condition and adds both operands to the SELECT clause", () => {
    const result = analyze("SELECT Id FROM Contact WHERE Field1__c = Field2__c");
    expect(result.applies).toBe(true);
    expect(result.query).toBe("SELECT Id, Field1__c, Field2__c FROM Contact");
    expect(result.injectedFields).toEqual(["Field1__c", "Field2__c"]);
    expect(result.comparisons).toEqual([{left: "Field1__c", right: "Field2__c", operator: "=", category: "text"}]);
  });

  test("Does not add operands that are already selected", () => {
    const result = analyze("SELECT Id, Field1__c, Field2__c FROM Contact WHERE Field1__c = Field2__c");
    expect(result.query).toBe("SELECT Id, Field1__c, Field2__c FROM Contact");
    expect(result.injectedFields).toEqual([]);
  });

  test("Keeps the other conditions and the trailing clauses", () => {
    const result = analyze("SELECT Id FROM Contact WHERE LastName = 'Smith' AND Field1__c != Field2__c ORDER BY LastName DESC LIMIT 200");
    expect(result.query).toBe("SELECT Id, Field1__c, Field2__c FROM Contact WHERE LastName = 'Smith' ORDER BY LastName DESC LIMIT 200");
    expect(result.removedWhere).toBe(false);
  });

  test("Removes a condition surrounded by other conditions", () => {
    const result = analyze("SELECT Id FROM Contact WHERE Num1__c = 1 AND Field1__c = Field2__c AND LastName = 'x'");
    expect(result.query).toBe("SELECT Id, Field1__c, Field2__c FROM Contact WHERE Num1__c = 1 AND LastName = 'x'");
  });

  test("Supports several field comparisons in the same query", () => {
    const result = analyze("SELECT Id FROM Contact WHERE Num1__c = Num2__c AND Field1__c = Field2__c");
    expect(result.comparisons).toHaveLength(2);
    expect(result.query).toBe("SELECT Id, Num1__c, Num2__c, Field1__c, Field2__c FROM Contact");
  });

  test("Warns when the WHERE clause is emptied", () => {
    const result = analyze("SELECT Id FROM Contact WHERE Field1__c = Field2__c");
    expect(result.removedWhere).toBe(true);
    expect(result.warnings.join(" ")).toContain("without any filter");
  });

  test("Does not break a semi join subquery", () => {
    const result = analyze("SELECT Id FROM Contact WHERE AccountId IN (SELECT Id FROM Account WHERE Name = 'x') AND Field1__c = Field2__c");
    expect(result.query).toBe("SELECT Id, Field1__c, Field2__c FROM Contact WHERE AccountId IN (SELECT Id FROM Account WHERE Name = 'x')");
  });

  test("Handles the FIELDS() function", () => {
    expect(analyze("SELECT FIELDS(ALL) FROM Contact WHERE Field1__c = Field2__c LIMIT 200").injectedFields).toEqual([]);
    expect(analyze("SELECT FIELDS(STANDARD) FROM Contact WHERE Field1__c = Field2__c LIMIT 200").injectedFields).toEqual(["Field1__c", "Field2__c"]);
    expect(analyze("SELECT FIELDS(STANDARD) FROM Contact WHERE LastName = FirstName LIMIT 200").injectedFields).toEqual([]);
  });

  test("Reports that a describe is needed, then uses it", () => {
    const first = analyzeFieldComparisons("SELECT Id FROM Contact WHERE Field1__c = Field2__c");
    expect(first.needsDescribe).toBe(true);
    expect(first.sobjectName).toBe("Contact");
    expect(analyzeFieldComparisons("SELECT Id FROM Contact WHERE LastName = 'x'").needsDescribe).toBe(false);
  });
});

test.describe("SOQL field comparison - queries left untouched", () => {

  const untouched = [
    ["a literal", "SELECT Id FROM Contact WHERE LastName = 'Smith'"],
    ["a date literal", "SELECT Id FROM Contact WHERE CreatedDate = TODAY"],
    ["a parameterized date literal", "SELECT Id FROM Contact WHERE CreatedDate = LAST_N_DAYS:30"],
    ["a null check", "SELECT Id FROM Contact WHERE LastName != null"],
    ["a bind variable", "SELECT Id FROM Contact WHERE Id = :recordId"],
    ["a LIKE condition", "SELECT Id FROM Contact WHERE LastName LIKE 'A%'"],
    ["no WHERE clause", "SELECT Id FROM Contact"],
    ["operands that are not fields", "SELECT Id FROM Contact WHERE Unknown__c = AlsoUnknown__c"],
    ["a field name inside a string", "SELECT Id FROM Contact WHERE LastName = 'Field1__c = Field2__c'"]
  ];

  for (const [label, query] of untouched) {
    test(`Leaves the query alone with ${label}`, () => {
      const result = analyze(query);
      expect(result.applies).toBe(false);
      expect(result.errors).toEqual([]);
      expect(result.query).toBe(query);
    });
  }
});

test.describe("SOQL field comparison - rejected queries", () => {

  const rejected = [
    ["an OR condition", "SELECT Id FROM Contact WHERE LastName = 'x' OR Field1__c = Field2__c", "top level AND"],
    ["parentheses", "SELECT Id FROM Contact WHERE (Field1__c = Field2__c AND LastName = 'x')", "top level AND"],
    ["a NOT condition", "SELECT Id FROM Contact WHERE NOT Field1__c = Field2__c", "top level AND"],
    ["a relationship field", "SELECT Id FROM Contact WHERE Account.Name = Field1__c", "Relationship fields"],
    ["different types", "SELECT Id FROM Contact WHERE Num1__c = Field1__c", "different types"],
    ["a date and a datetime", "SELECT Id FROM Contact WHERE Start__c = When__c", "different types"],
    ["an uncomparable type", "SELECT Id FROM Contact WHERE Addr__c = Field1__c", "cannot be compared"],
    ["an aggregate query", "SELECT Count(Id) FROM Contact WHERE Field1__c = Field2__c GROUP BY LastName", "aggregate"],
    ["an OFFSET", "SELECT Id FROM Contact WHERE Field1__c = Field2__c LIMIT 10 OFFSET 5", "OFFSET"]
  ];

  for (const [label, query, expectedMessage] of rejected) {
    test(`Rejects ${label}`, () => {
      const result = analyze(query);
      expect(result.applies).toBe(false);
      expect(result.errors.join(" ")).toContain(expectedMessage);
      expect(result.query).toBe(query);
    });
  }
});

test.describe("SOQL field comparison - record evaluation", () => {

  test("Compares text fields without case sensitivity by default", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Field1__c = Field2__c");
    expect(recordMatches({"Field1__c": "a", "Field2__c": "a"}, comparisons)).toBe(true);
    expect(recordMatches({"Field1__c": "a", "Field2__c": "b"}, comparisons)).toBe(false);
    expect(recordMatches({"Field1__c": "ABC", "Field2__c": "abc"}, comparisons)).toBe(true);
    expect(recordMatches({"Field1__c": "ABC", "Field2__c": "abc"}, comparisons, {caseSensitive: true})).toBe(false);
  });

  test("Treats null and empty values as equal to each other only", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Field1__c = Field2__c");
    expect(recordMatches({"Field1__c": null, "Field2__c": null}, comparisons)).toBe(true);
    expect(recordMatches({"Field1__c": "", "Field2__c": null}, comparisons)).toBe(true);
    expect(recordMatches({"Field1__c": null, "Field2__c": "a"}, comparisons)).toBe(false);
  });

  test("Inverts the result for the != operator", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Field1__c != Field2__c");
    expect(recordMatches({"Field1__c": "a", "Field2__c": "b"}, comparisons)).toBe(true);
    expect(recordMatches({"Field1__c": "a", "Field2__c": "a"}, comparisons)).toBe(false);
    expect(recordMatches({"Field1__c": null, "Field2__c": null}, comparisons)).toBe(false);
    expect(recordMatches({"Field1__c": null, "Field2__c": "a"}, comparisons)).toBe(true);
  });

  test("Compares numbers by value and not by text", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Num1__c = Num2__c");
    expect(recordMatches({"Num1__c": 1.0, "Num2__c": 1}, comparisons)).toBe(true);
    expect(recordMatches({"Num1__c": "1.50", "Num2__c": 1.5}, comparisons)).toBe(true);
    expect(recordMatches({"Num1__c": 0, "Num2__c": null}, comparisons)).toBe(false);
  });

  test("Compares ids with case sensitivity", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE OwnerId = CreatedById");
    expect(recordMatches({"OwnerId": "005A", "CreatedById": "005A"}, comparisons)).toBe(true);
    expect(recordMatches({"OwnerId": "005a", "CreatedById": "005A"}, comparisons)).toBe(false);
  });

  test("Compares dates", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Start__c = End__c");
    expect(recordMatches({"Start__c": "2024-01-01", "End__c": "2024-01-01"}, comparisons)).toBe(true);
    expect(recordMatches({"Start__c": "2024-01-01", "End__c": "2024-01-02"}, comparisons)).toBe(false);
  });

  test("Requires every comparison to match", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Num1__c = Num2__c AND Field1__c = Field2__c");
    expect(recordMatches({"Num1__c": 1, "Num2__c": 1, "Field1__c": "a", "Field2__c": "a"}, comparisons)).toBe(true);
    expect(recordMatches({"Num1__c": 1, "Num2__c": 2, "Field1__c": "a", "Field2__c": "a"}, comparisons)).toBe(false);
  });

  test("Describes the comparisons for the UI", () => {
    const comparisons = comparisonsOf("SELECT Id FROM Contact WHERE Num1__c = Num2__c AND Field1__c != Field2__c");
    expect(describeComparisons(comparisons)).toBe("Num1__c = Num2__c AND Field1__c != Field2__c");
  });
});
