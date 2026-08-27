# How to Run Playwright E2E Tests

This guide explains how to set up and run the Playwright end-to-end tests for Salesforce Inspector Reloaded, including how to configure tests to run against a real Salesforce org (without mocks).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (With Mocks)](#quick-start-with-mocks)
- [Running Tests Against a Real Salesforce Org](#running-tests-against-a-real-salesforce-org)
- [Required Salesforce Org Data](#required-salesforce-org-data)
- [Test Configuration](#test-configuration)
- [Available Test Commands](#available-test-commands)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

## Prerequisites

1. **Node.js**: Version 20 or higher
2. **npm**: Comes with Node.js
3. **Playwright**: Will be installed automatically via npm
4. **Chrome/Chromium**: Required for running tests (Playwright will install it)
5. **Extension Source**: The `addon/` directory must exist with a valid `manifest.json` file

## Quick Start (With Mocks)

By default, tests run with mocks enabled, which means they don't require a real Salesforce org connection.

1. **Install dependencies:**

```bash
   npm install
   npx playwright install --with-deps chromium
```

1. **Run all tests:**

```bash
   npm run test:e2e
```

1. **Run tests in debug mode (with UI):**

```bash
   npm run test:e2e:debug
```

1. **Run a specific test file:**

```bash
   npx playwright test data-export.spec.js
```

## Running Tests Against a Real Salesforce Org

To run tests against a real Salesforce org (without mocks), you need to:

1. **Configure test constants** (generates a gitignored local file)
2. **Deploy required metadata** to your Salesforce org
3. **Set up authentication**

### Step 1: Update Test Configuration

Test constants are stored in `tests/e2e/test-constants.local.js`, which is **gitignored** to prevent accidentally committing org credentials. A template file `tests/e2e/test-constants.template.js` is committed for reference.

**Option A: Use the automated script (recommended)**

Run the script to fetch your default org info and generate `test-constants.local.js`:

```bash
npm run set-test-constants
```

Or with options:

```bash
# Preview without writing the file
npm run set-test-constants -- --dry-run

# Use a specific org instead of default
npm run set-test-constants -- --target-org my-org-alias
```

Prerequisites: Salesforce CLI (`sf`) installed, authenticated to an org, Flow `RecordTrigger_InspectorTest` deployed, and at least one Account record.

> **Note:** Since the Salesforce CLI security update (~May 2026), `sf org display` redacts the access token (it returns `[REDACTED] Use 'sf org auth show-access-token' to view`). The script now fetches the token via `sf org auth show-access-token --json`, so make sure your CLI version supports that command. If you set `mockToken` manually (Option B) and see `401` errors, get a valid token with `sf org auth show-access-token --target-org <org>`.

**Important:** Import `tests/account_test_data.csv` before running the script so Account names (e.g. "Test Account 1", "Test Account 2") match test expectations. The script sets both `accountRecordId` and `accountRecordName` from your org.

**Option B: Manual configuration**

Copy the template and fill in real values:

```bash
cp tests/e2e/test-constants.template.js tests/e2e/test-constants.local.js
```

Then edit `tests/e2e/test-constants.local.js`:

```javascript
export const TEST_CONSTANTS = {
  mockHost: "your-org-instance.sandbox.my.salesforce.com",  // Your Salesforce instance URL
  mockToken: "YOUR_ACCESS_TOKEN_HERE",                      // Valid Salesforce access token
  apiVersion: "66.0",                                       // API version (must match your org)
  accountRecordId: "001000000000001AAA",                    // Valid Account record ID
  accountRecordName: "Test Account 1",                      // Account Name (must match record)
  testUserSearchTerm: "Integration User",                   // User search term (exists in all orgs)
  flowId: "301000000000000AAA",                            // Valid Flow version ID
  flowDefId: "300000000000000AAA",                         // Valid Flow Definition ID
  mockEnabled: false                                        // Set to false to disable mocks
};
```

**Note:** If `test-constants.local.js` does not exist, tests automatically fall back to the template file which runs in mock mode.

### Step 2: Deploy Required Metadata

The tests require specific metadata to be deployed to your Salesforce org. This metadata is located in the `test/` directory.
WARNING: the flow must have an inactive version

### Step 3: Assign Permission Set

After deploying, assign the `SfInspector` permission set to your test user:

### Step 4: Create Required Test Data

Some tests require specific data records. See [Required Salesforce Org Data](#required-salesforce-org-data) section below.

### Step 5: Run Tests

Once configured, run tests as usual:

```bash
npm run test:e2e
```

The tests will now make real API calls to your Salesforce org.

## Required Salesforce Org Data

When running tests without mocks, your Salesforce org must have the following data:

### 1. Account Records

**Required:**

- At least 2 Accounts with `Name` like "Test Account%" (e.g. "Test Account 1", "Test Account 2")
- The Account should have:
  - `Name` field populated
  - `Type` field (optional, but some tests check for it)

**Import test data (recommended):** Use `tests/account_test_data.csv` with Data Loader, VS Code Salesforce extension, or similar tool to create Account records with names "Test Account 1" and "Test Account 2".

Or create manually:

```bash
sf data create record --sobject Account --values "Name='Test Account 1' Type='Customer'" --target-org your-org
sf data create record --sobject Account --values "Name='Test Account 2' Type='Customer'" --target-org your-org
```

**Important:** `account_test_data.csv` must be imported so Account names match test expectations. Run `npm run set-test-constants` after importing to populate both `accountRecordId` and `accountRecordName`.

### 2. Test User (for Users Tab tests)

**Required for Users Tab tests:** The default test user search term is "Integration User" (exists in all orgs). Update `testUserSearchTerm` in `test-constants.local.js` if your org uses a different user name for these tests.

### 3. Platform Event (for Event Monitor Generate and Publish test)

**Required for Event Monitor e2e test:** The `TestEvent__e` platform event is included in `test/main/default/objects/`. Deploy the `test/` metadata to your org to run the "Generate and Publish Platform Event" test against a real org.

### 4. Flow (for Flow Scanner Tests)

**Required:**

- A Flow named `RecordTrigger_InspectorTest` (or update test constants)
- Flow Definition ID (DurableId)
- Flow Version ID (Id)

**To get Flow IDs:**

```bash
# Get Flow Definition ID
sf data query --query "SELECT DurableId, ApiName FROM FlowDefinitionView WHERE ApiName='RecordTrigger_InspectorTest'" --target-org your-org

# Get Flow Version ID
sf data query --query "SELECT Id, VersionNumber, Status FROM Flow WHERE Definition.DeveloperName='RecordTrigger_InspectorTest'" --target-org your-org
```

Update `flowDefId` and `flowId` in `test-constants.local.js` with the IDs.

## CI/CD Integration

The GitHub Actions workflow (`.github/workflows/e2e.yml`) runs tests automatically with different strategies depending on the context:

### Fork PRs (mocked)

Pull requests from forks **cannot access repository secrets**, so they run tests with mocks using `npm run test:e2e:mock`. This copies the template as `test-constants.local.js` and runs all tests in mock mode.

### Repo PRs and post-merge pushes (real org)

Pull requests from the same repository, manual dispatches, and pushes to target branches (post-merge) run tests against a real Salesforce org. This ensures that after a fork PR is merged, the code is validated against the real org on the target branch.

**Required repository variables** (set `SF_TEST_MOCKENABLED` to `"false"`):

- `SF_CLI_URL` - Salesforce CLI download URL (<https://developer.salesforce.com/media/salesforce-cli/sf/channels/stable/sf-linux-x64.tar.xz>)
- `SF_TEST_APIVERSION` - API version
- `SF_TEST_ACCOUNTID` - Account record ID
- `SF_TEST_FLOWID` - Flow version ID
- `SF_TEST_FLOWDEFID` - Flow definition ID

**Required repository secrets:**

- `SF_AUTH_URL` - Salesforce authentication URL (sfdx-url format)

The real-org workflow will:

1. Install Salesforce CLI
2. Authenticate using the auth URL
3. Extract access token and instance URL
4. Generate `tests/e2e/test-constants.local.js` with real credentials
5. Run tests against the real org

## Troubleshooting

### Tests Fail with 401 Unauthorized

**Cause:** Invalid or expired access token.

**Solution:**

1. Regenerate your access token
2. Run `npm run set-test-constants` or update `mockToken` in `test-constants.local.js`
3. Ensure your user has API access enabled

### Tests Fail with "Record Not Found"

**Cause:** Test constants reference IDs that don't exist in your org.

**Solution:**

1. Verify Account ID exists: `sf data query --query "SELECT Id FROM Account WHERE Id='YOUR_ID'" --target-org your-org`
2. Verify Flow IDs exist (see Flow section above)
3. Update test constants with valid IDs

### Tests Fail with "Insufficient Privileges"

**Cause:** Missing permissions on `Inspector_Test__c` object.

**Solution:**

1. Deploy the `SfInspector` permission set
2. Assign it to your test user
3. Verify field-level security allows access to all fields

### Extension Not Loading in Tests

**Cause:** Extension path or ID issues.

**Solution:**

1. Ensure `addon/` directory exists and contains `manifest.json`
2. Check Playwright config loads extension correctly
3. Verify extension ID is being captured correctly

### Mock Data Not Matching Real Org

**Cause:** Your org's data structure differs from mocked data.

**Solution:**

1. Review the mock responses in `tests/e2e/test-mock.js`
2. Ensure your org has similar data structure
3. Or update mocks to match your org's structure

### Flow Scanner Tests Fail

**Cause:** Flow not deployed or incorrect Flow IDs.

**Solution:**

1. Deploy the Flow from `test/main/default/flows/`
2. Verify Flow is Active
3. Get correct Flow Definition ID and Version ID
4. Update test constants

## Test Files Overview

| Test File                   | Description                          | Key Dependencies                |
|-----------------------------|--------------------------------------|---------------------------------|
| `inspect.spec.js`           | Tests the Inspect page functionality | Account object, Account record  |
| `options.spec.js`           | Tests the Options page               | User object, API access         |
| `data-export.spec.js`       | Tests data export features           | Account object, SOQL queries    |
| `data-import.spec.js`       | Tests data import features           | Inspector_Test__c object        |
| `field-creator.spec.js`     | Tests field creation                 | Custom objects, Tooling API     |
| `flow-scanner.spec.js`      | Tests Flow Scanner                   | Flow metadata, Flow API         |
| `metadata-retrieve.spec.js` | Tests metadata retrieval             | Metadata API access             |
| `rest-explore.spec.js`      | Tests REST API explorer              | API access                      |
| `popup.spec.js`             | Tests popup functionality            | Basic API access                |
| `event-monitor.spec.js`     | Tests event monitoring               | Platform Events (if applicable) |

## Notes

- **Sandbox vs Production:** Tests can run against sandbox or production orgs. Use sandbox orgs for testing when possible.
- **Test Data Cleanup:** Tests may create/modify data. Consider using a dedicated test org or cleaning up after tests.
- **API Limits:** Running tests against a real org consumes API calls. Monitor your org's API usage.
- **Parallel Execution:** Tests run in parallel by default. This can increase API usage but speeds up test execution.
