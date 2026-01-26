import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Coverage data storage
let coverageData = [];

/**
 * Collect coverage from a page and convert to Istanbul format
 */
export async function collectCoverage(page) {
  try {
    // Start coverage collection
    await page.coverage.startJSCoverage();

    return {
      page,
      startCoverage: async () => {
        await page.coverage.startJSCoverage();
      },
      stopCoverage: async () => {
        const coverage = await page.coverage.stopJSCoverage();
        return coverage;
      }
    };
  } catch (error) {
    console.warn("Coverage collection not available:", error.message);
    return null;
  }
}

/**
 * Convert V8 coverage format to Istanbul format
 */
function v8ToIstanbul(coverage, sourceRoot) {
  const istanbulCoverage = {};

  for (const entry of coverage) {
    // Skip extension:// URLs and chrome-extension:// URLs
    if (entry.url.startsWith("chrome-extension://") ||
        entry.url.startsWith("extension://") ||
        entry.url.startsWith("chrome://")) {
      continue;
    }

    // Only process files from our addon directory
    if (!entry.url.includes("/addon/")) {
      continue;
    }

    // Extract relative path
    const urlPath = new URL(entry.url).pathname;
    const relativePath = urlPath.split("/addon/")[1];

    if (!relativePath || !relativePath.endsWith(".js")) {
      continue;
    }

    const filePath = path.join(sourceRoot, "addon", relativePath);

    // Read source file
    let source;
    try {
      source = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.warn(`Could not read source file ${filePath}:`, error.message);
      continue;
    }

    // Convert ranges to Istanbul format
    const statements = {};
    const functions = {};
    const branches = {};

    // Process function ranges
    if (entry.functions) {
      entry.functions.forEach((func, index) => {
        const key = `${index}`;
        functions[key] = {
          name: func.functionName || `anonymous_${index}`,
          decl: {start: {line: func.ranges[0]?.startLine || 0, column: 0}},
          loc: {start: {line: func.ranges[0]?.startLine || 0, column: 0},
                end: {line: func.ranges[0]?.endLine || 0, column: 0}},
          line: func.ranges[0]?.startLine || 0
        };
      });
    }

    // Process ranges as statements
    if (entry.ranges) {
      entry.ranges.forEach((range, index) => {
        const startLine = range.startLine || 0;
        const startCol = range.startColumn || 0;
        const endLine = range.endLine || 0;
        const endCol = range.endColumn || 0;

        const key = `${startLine}_${startCol}_${endLine}_${endCol}`;
        statements[key] = [startLine, startCol, endLine, endCol, 1];
      });
    }

    istanbulCoverage[filePath] = {
      path: filePath,
      statementMap: {},
      fnMap: functions,
      branchMap: branches,
      s: statements,
      f: {},
      b: {},
      _coverageSchema: "1a1c01bbd47fc00a2c39e90264f9e040c24437c6",
      hash: ""
    };
  }

  return istanbulCoverage;
}

/**
 * Save coverage data to file
 */
export async function saveCoverage(coverageArray, outputDir = path.join(__dirname, "../coverage")) {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {recursive: true});
  }

  const sourceRoot = path.join(__dirname, "../..");
  const allCoverage = {};

  // Merge all coverage data
  for (const coverage of coverageArray) {
    if (!coverage || coverage.length === 0) continue;

    const istanbul = v8ToIstanbul(coverage, sourceRoot);
    Object.assign(allCoverage, istanbul);
  }

  // Save to coverage directory
  const coverageFile = path.join(outputDir, "coverage.json");
  fs.writeFileSync(coverageFile, JSON.stringify(allCoverage, null, 2));

  console.log(`Coverage data saved to ${coverageFile}`);
  return coverageFile;
}

