# Code Coverage with Playwright

This project uses Playwright's built-in coverage API to collect code coverage metrics for E2E tests.

## Quick Start

1. **Run tests with coverage collection:**
   ```bash
   npm run test:coverage
   ```

2. **Generate coverage report:**
   ```bash
   npm run test:coverage:report
   ```

3. **Run both in sequence:**
   ```bash
   npm run test:coverage:all
   ```

## How It Works

1. **Collection**: When tests run with `COLLECT_COVERAGE=true`, Playwright collects JavaScript coverage data from all pages visited during tests.

2. **Storage**: Raw coverage data is saved to `tests/coverage/raw-coverage.json` after all tests complete.

3. **Conversion**: The coverage report generator converts V8 coverage format to Istanbul format and generates:
   - `tests/coverage/coverage.json` - Istanbul format coverage data
   - `tests/coverage/coverage-summary.json` - Summary with percentages
   - Console output with coverage percentages

## Coverage Metrics

The coverage report includes:
- **Statements**: Percentage of statements executed
- **Branches**: Percentage of branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

## Output Example

```
================================================================================
COVERAGE SUMMARY
================================================================================

Statements: 1250/2000 (62.5%)
Branches:   450/800 (56.25%)
Functions:  180/250 (72%)
Lines:      1100/1800 (61.11%)

================================================================================

File Coverage:
--------------------------------------------------------------------------------
addon/data-import.js                          75.5% statements
addon/data-export.js                          68.2% statements
...
```

## Notes

- Coverage is only collected for files in the `addon/` directory
- Coverage collection can be disabled by setting `COLLECT_COVERAGE=false`
- The coverage directory (`tests/coverage/`) is gitignored

