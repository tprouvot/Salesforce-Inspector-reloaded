import fs from "fs";
import path from "path";
import {getCoverageData} from "./coverage-storage.js";

// Global teardown - runs once after all tests
export default async function globalTeardown() {
  const coverage = getCoverageData();

  // eslint-disable-next-line no-undef
  const coverageDir = path.join(process.cwd(), "tests", "coverage");
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, {recursive: true});
  }

  if (coverage.length === 0) {
    console.log("\nNo coverage data collected.");
    console.log("Note: Coverage collection may not work for Chrome extension code");
    console.log("running in service workers or content scripts.");
    // Still save empty array for debugging
    const coverageFile = path.join(coverageDir, "raw-coverage.json");
    fs.writeFileSync(coverageFile, JSON.stringify([], null, 2));
    return;
  }

  // Save raw coverage data
  const coverageFile = path.join(coverageDir, "raw-coverage.json");
  fs.writeFileSync(coverageFile, JSON.stringify(coverage, null, 2));

  // Log some stats
  const extensionFiles = coverage.filter(c => c.url && c.url.includes("chrome-extension://"));
  console.log(`\nCoverage data collected: ${coverage.length} entries`);
  console.log(`Extension files: ${extensionFiles.length}`);
  console.log(`Raw coverage saved to: ${coverageFile}`);
  console.log("\nTo generate coverage report, run: npm run test:coverage:report");
}

