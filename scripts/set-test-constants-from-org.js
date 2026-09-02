#!/usr/bin/env node
/**
 * Generates tests/e2e/test-constants.local.js from the default Salesforce org.
 * Uses Salesforce CLI (sf) to get org info and run SOQL queries.
 *
 * Prerequisites:
 * - Salesforce CLI installed (sf). Requires a version with
 *   'sf org auth show-access-token' (the access token is redacted from
 *   'sf org display' since the CLI security update, ~May 2026).
 * - Authenticated to a default org (sf org login web or sfdx force:auth:web:login)
 * - Flow RecordTrigger_InspectorTest deployed to the org
 * - At least one Account record in the org
 *
 * Usage: node scripts/set-test-constants-from-org.js [options]
 *   --dry-run       Print the constants without writing the file
 *   --target-org N  Use org alias N instead of default (or set SF_TARGET_ORG)
 */

(function() {
  "use strict";

  const {execFileSync} = require("child_process");
  const fs = require("fs");
  const path = require("path");

  const DRY_RUN = process.argv.includes("--dry-run");
  const TARGET_ORG = (() => {
    const idx = process.argv.indexOf("--target-org");
    return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
  })() || process.env.SF_TARGET_ORG || null;
  const LOCAL_CONSTANTS_PATH = path.join(__dirname, "../tests/e2e/test-constants.local.js");

  const FLOW_API_NAME = "RecordTrigger_InspectorTest";

  function escapeJsString(str) {
    return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function runSfCommand(args, options = {}) {
    try {
      return execFileSync("sf", args, {
        encoding: "utf-8",
        ...options
      });
    } catch (error) {
      throw new Error(`Command failed: sf ${args.join(" ")}\n${error.stderr || error.message}`, {cause: error});
    }
  }

  function getAccessToken() {
    // sf org display no longer returns the access token (redacted since the
    // CLI security update, ~May 2026). The token must be fetched from the
    // dedicated command; --json bypasses the interactive confirmation prompt.
    const args = ["org", "auth", "show-access-token", "--json"];
    if (TARGET_ORG) args.push("--target-org", TARGET_ORG);
    const output = runSfCommand(args);
    const data = JSON.parse(output);
    const accessToken = data.result?.accessToken;
    if (!accessToken || accessToken.startsWith("[REDACTED]")) {
      throw new Error("Could not retrieve access token from 'sf org auth show-access-token'");
    }
    return accessToken;
  }

  function getOrgInfo() {
    const args = ["org", "display", "--json"];
    if (TARGET_ORG) args.push("--target-org", TARGET_ORG);
    const output = runSfCommand(args);
    const data = JSON.parse(output);
    const result = data.result;
    if (!result) {
      throw new Error("No org result in sf org display output");
    }
    const instanceUrl = result.instanceUrl;
    const apiVersion = result.apiVersion || "66.0";

    if (!instanceUrl) {
      throw new Error("Could not extract instanceUrl from org display");
    }

    const accessToken = getAccessToken();
    const host = new URL(instanceUrl).hostname;
    return {host, accessToken, apiVersion};
  }

  function runSoqlQuery(query, useToolingApi = false) {
    const args = ["data", "query", "--query", query, "--json"];
    if (TARGET_ORG) {
      args.push("--target-org", TARGET_ORG);
    }
    if (useToolingApi) {
      args.push("--use-tooling-api");
    }
    const output = runSfCommand(args);
    const data = JSON.parse(output);
    if (data.status !== 0) {
      throw new Error(`SOQL query failed: ${data.message || JSON.stringify(data)}`);
    }
    return data.result;
  }

  function getAccountRecord() {
    // Prefer accounts matching test data (Test Account 1, Test Account 2, etc.)
    let result = runSoqlQuery(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Test Account%' ORDER BY Name LIMIT 1"
    );
    let records = result?.records || [];
    if (records.length === 0) {
      result = runSoqlQuery("SELECT Id, Name FROM Account LIMIT 1");
      records = result?.records || [];
    }
    if (records.length === 0) {
      throw new Error("No Account records found. Create at least one Account in your org.");
    }
    return {id: records[0].Id, name: records[0].Name};
  }

  function getFlowDefinitionId() {
    const result = runSoqlQuery(
      `SELECT DurableId FROM FlowDefinitionView WHERE ApiName='${FLOW_API_NAME}' LIMIT 1`
    );
    const records = result?.records || [];
    if (records.length === 0) {
      throw new Error(
        `Flow '${FLOW_API_NAME}' not found. Deploy the flow from test/main/default/flows/ to your org.`
      );
    }
    return records[0].DurableId;
  }

  function getFlowVersionId() {
    // Flow object requires Tooling API. Prefer inactive (Draft) version as per HOW_TO_RUN_TESTS.md
    const toolingQuery = (statusFilter) =>
      runSoqlQuery(
        `SELECT Id FROM Flow WHERE Definition.DeveloperName='${FLOW_API_NAME}'${statusFilter} LIMIT 1`,
        true
      );
    let result = toolingQuery(" AND Status='Draft'");
    let records = result?.records || [];

    if (records.length === 0) {
      result = toolingQuery("");
      records = result?.records || [];
    }

    if (records.length === 0) {
      throw new Error(
        `No Flow version found for '${FLOW_API_NAME}'. Deploy the flow to your org.`
      );
    }
    return records[0].Id;
  }

  function writeLocalConstants(constants) {
    const content = `/**
 * Local test constants (gitignored).
 * Generated by: npm run set-test-constants
 * Or copied from test-constants.template.js and filled in manually.
 */
export const TEST_CONSTANTS = {
  mockHost: "${escapeJsString(constants.mockHost)}",
  mockToken: "${escapeJsString(constants.mockToken)}",
  apiVersion: "${escapeJsString(constants.apiVersion)}",
  accountRecordId: "${escapeJsString(constants.accountRecordId)}",
  accountRecordName: "${escapeJsString(constants.accountRecordName)}",
  testUserSearchTerm: "Integration User",
  flowId: "${escapeJsString(constants.flowId)}",
  flowDefId: "${escapeJsString(constants.flowDefId)}",
  mockEnabled: ${constants.mockEnabled}
};
`;
    fs.writeFileSync(LOCAL_CONSTANTS_PATH, content);
  }

  function main() {
    console.log("Fetching default org information...\n");

    const {host, accessToken, apiVersion} = getOrgInfo();
    console.log(`  Host: ${host}`);
    console.log(`  API Version: ${apiVersion}`);

    console.log("\nRunning SOQL queries...\n");

    const accountRecord = getAccountRecord();
    const accountRecordId = accountRecord.id;
    const accountRecordName = accountRecord.name;
    console.log(`  Account ID: ${accountRecordId}`);
    console.log(`  Account Name: ${accountRecordName}`);

    const flowDefId = getFlowDefinitionId();
    console.log(`  Flow Definition ID: ${flowDefId}`);

    const flowId = getFlowVersionId();
    console.log(`  Flow Version ID: ${flowId}`);

    const constants = {
      mockHost: host,
      mockToken: accessToken,
      apiVersion,
      accountRecordId,
      accountRecordName,
      flowId,
      flowDefId,
      mockEnabled: false
    };

    // Hide real access tokens (start with the org id prefix "00D") from the
    // printed output to avoid leaking credentials in logs. A non-token value
    // (e.g. a "[REDACTED] ..." placeholder) is shown as-is so it can help
    // diagnose configuration issues.
    const printableConstants = {
      ...constants,
      mockToken: constants.mockToken.startsWith("00D") ? "[MASKED] real token written to file, hidden from logs" : constants.mockToken
    };

    console.log("\n" + "=".repeat(50));
    console.log("TEST_CONSTANTS:");
    console.log("=".repeat(50));
    console.log(JSON.stringify(printableConstants, null, 2));
    console.log("=".repeat(50));

    if (DRY_RUN) {
      console.log("\n[--dry-run] Skipping file write.");
      return;
    }

    writeLocalConstants(constants);
    console.log(`\nGenerated ${LOCAL_CONSTANTS_PATH}`);
  }

  try {
    main();
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
})();
