import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import v8toIstanbul from "v8-to-istanbul";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "../..");
const addonDir = path.join(projectRoot, "addon");
const coverageDir = path.join(__dirname, "../coverage");
const rawCoverageFile = path.join(coverageDir, "raw-coverage.json");

// Istanbul coverage format
const istanbulCoverage = {};

/**
 * Convert V8 coverage to Istanbul format
 */
function convertToIstanbul(coverage) {
  const fileMap = new Map();

  // Group coverage by file URL
  for (const entry of coverage) {
    // Skip non-extension URLs
    if (!entry.url.startsWith("chrome-extension://")) {
      continue;
    }

    // Extract file path from URL
    // chrome-extension://id/addon/path/to/file.js
    const urlObj = new URL(entry.url);
    const urlPath = urlObj.pathname;

    // Extract relative path from /addon/
    const addonIndex = urlPath.indexOf("/addon/");
    if (addonIndex === -1) continue;

    const relativePath = urlPath.substring(addonIndex + 7); // +7 to skip "/addon/"

    // Only process .js files
    if (!relativePath.endsWith(".js")) continue;

    const filePath = path.join(addonDir, relativePath);

    // Skip if file doesn't exist
    if (!fs.existsSync(filePath)) {
      console.warn(`Source file not found: ${filePath}`);
      continue;
    }

    if (!fileMap.has(filePath)) {
      fileMap.set(filePath, []);
    }
    fileMap.get(filePath).push(entry);
  }

  // Convert each file's coverage
  for (const [filePath, entries] of fileMap.entries()) {
    try {
      const source = fs.readFileSync(filePath, "utf-8");
      const converter = v8toIstanbul(filePath, 0, {source});

      // Merge all coverage entries for this file
      // Combine all functions from all entries
      const allFunctions = [];
      for (const entry of entries) {
        if (entry.functions && Array.isArray(entry.functions)) {
          allFunctions.push(...entry.functions);
        }
      }

      if (allFunctions.length > 0) {
        converter.applyCoverage(allFunctions);
        const istanbulData = converter.toIstanbul();
        Object.assign(istanbulCoverage, istanbulData);
      }
    } catch (error) {
      console.warn(`Error converting coverage for ${filePath}:`, error.message);
    }
  }
}

/**
 * Generate coverage summary
 */
function generateSummary() {
  const summary = {
    total: {statements: 0, branches: 0, functions: 0, lines: 0},
    covered: {statements: 0, branches: 0, functions: 0, lines: 0},
    files: {}
  };

  for (const [filePath, data] of Object.entries(istanbulCoverage)) {
    const fileSummary = {
      statements: {total: 0, covered: 0},
      branches: {total: 0, covered: 0},
      functions: {total: 0, covered: 0},
      lines: {total: 0, covered: 0}
    };

    // Count statements
    for (const count of Object.values(data.s || {})) {
      fileSummary.statements.total++;
      summary.total.statements++;
      if (count > 0) {
        fileSummary.statements.covered++;
        summary.covered.statements++;
      }
    }

    // Count functions
    for (const count of Object.values(data.f || {})) {
      fileSummary.functions.total++;
      summary.total.functions++;
      if (count > 0) {
        fileSummary.functions.covered++;
        summary.covered.functions++;
      }
    }

    // Count branches
    for (const count of Object.values(data.b || {})) {
      fileSummary.branches.total++;
      summary.total.branches++;
      if (count > 0) {
        fileSummary.branches.covered++;
        summary.covered.branches++;
      }
    }

    // Calculate line coverage (simplified)
    const lines = new Set();
    const coveredLines = new Set();

    for (const [key, count] of Object.entries(data.s || {})) {
      const [startLine] = key.split("_").map(Number);
      lines.add(startLine);
      if (count > 0) coveredLines.add(startLine);
    }

    fileSummary.lines.total = lines.size;
    fileSummary.lines.covered = coveredLines.size;
    summary.total.lines += lines.size;
    summary.covered.lines += coveredLines.size;

    summary.files[filePath] = fileSummary;
  }

  return summary;
}

/**
 * Calculate percentage
 */
function percentage(covered, total) {
  if (total === 0) return 100;
  return Math.round((covered / total) * 100 * 100) / 100;
}

/**
 * Main function
 */
async function main() {
  console.log("Generating coverage report...\n");

  // Check if raw coverage file exists
  if (!fs.existsSync(rawCoverageFile)) {
    console.error(`Raw coverage file not found: ${rawCoverageFile}`);
    console.error("Please run tests first with: npm run test:e2e");
    process.exit(1);
  }

  // Read raw coverage data
  const rawCoverage = JSON.parse(fs.readFileSync(rawCoverageFile, "utf-8"));

  if (rawCoverage.length === 0) {
    console.log("No coverage data found.");
    return;
  }

  // Convert to Istanbul format
  convertToIstanbul(rawCoverage);

  // Generate summary
  const summary = generateSummary();

  // Save Istanbul coverage
  const istanbulFile = path.join(coverageDir, "coverage.json");
  fs.writeFileSync(istanbulFile, JSON.stringify(istanbulCoverage, null, 2));

  // Generate text report
  console.log("=".repeat(80));
  console.log("COVERAGE SUMMARY");
  console.log("=".repeat(80));
  console.log(`\nStatements: ${summary.covered.statements}/${summary.total.statements} (${percentage(summary.covered.statements, summary.total.statements)}%)`);
  console.log(`Branches:   ${summary.covered.branches}/${summary.total.branches} (${percentage(summary.covered.branches, summary.total.branches)}%)`);
  console.log(`Functions:  ${summary.covered.functions}/${summary.total.functions} (${percentage(summary.covered.functions, summary.total.functions)}%)`);
  console.log(`Lines:      ${summary.covered.lines}/${summary.total.lines} (${percentage(summary.covered.lines, summary.total.lines)}%)`);
  console.log("\n" + "=".repeat(80));
  console.log("\nFile Coverage:");
  console.log("-".repeat(80));

  // Sort files by coverage percentage
  const fileEntries = Object.entries(summary.files)
    .map(([filePath, data]) => ({
      path: path.relative(projectRoot, filePath),
      statements: percentage(data.statements.covered, data.statements.total),
      branches: percentage(data.branches.covered, data.branches.total),
      functions: percentage(data.functions.covered, data.functions.total),
      lines: percentage(data.lines.covered, data.lines.total)
    }))
    .sort((a, b) => a.statements - b.statements);

  for (const file of fileEntries) {
    console.log(`${file.path.padEnd(50)} ${file.statements.toString().padStart(6)}% statements`);
  }

  // Save summary
  const summaryFile = path.join(coverageDir, "coverage-summary.json");
  fs.writeFileSync(summaryFile, JSON.stringify({
    ...summary,
    percentage: {
      statements: percentage(summary.covered.statements, summary.total.statements),
      branches: percentage(summary.covered.branches, summary.total.branches),
      functions: percentage(summary.covered.functions, summary.total.functions),
      lines: percentage(summary.covered.lines, summary.total.lines)
    }
  }, null, 2));

  console.log(`\n\nCoverage report saved to: ${coverageDir}`);
  console.log(`- Istanbul format: ${path.relative(projectRoot, istanbulFile)}`);
  console.log(`- Summary: ${path.relative(projectRoot, summaryFile)}`);
}

main().catch(error => {
  console.error("Error generating coverage report:", error);
  process.exit(1);
});

