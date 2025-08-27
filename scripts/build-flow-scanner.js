#!/usr/bin/env node

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// ANSI color codes for console output
const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  reset: "\x1b[0m"
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${step}`, "blue");
}

function logSuccess(message) {
  log(`✓ ${message}`, "green");
}

function logError(message) {
  log(`✗ ${message}`, "red");
}

function logWarning(message) {
  log(`⚠ ${message}`, "yellow");
}

function getLibraryNameFromViteConfig() {
  "use strict";
  logStep("Reading Vite config to get library name");
  try {
    const viteConfigPath = path.join(process.cwd(), "vite.config.ts");
    const viteConfigContent = fs.readFileSync(viteConfigPath, "utf8");
    const match = viteConfigContent.match(/name:\s*"([^"]+)"/);
    if (!match || !match[1]) {
      throw new Error("Could not find library name in vite.config.ts");
    }
    const libraryName = match[1];
    logSuccess(`Library name found: ${libraryName}`);
    return libraryName;
  } catch (error) {
    logError(`Failed to read library name from Vite config: ${error.message}`);
    process.exit(1);
  }
  return null;
}

function runCommand(command, description) {
  try {
    logStep(description);
    execSync(command, {stdio: "inherit"});
    logSuccess(`${description} completed successfully`);
  } catch (error) {
    logError(`${description} failed`);
    process.exit(1);
  }
}

function readPackageJson() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson;
  } catch (error) {
    logError("Failed to read package.json");
    process.exit(1);
  }
}

function findUMDFile(distDir) {
  try {
    const files = fs.readdirSync(distDir);
    const umdFile = files.find(file => file.endsWith(".umd.js") || file.endsWith(".umd.cjs"));

    if (!umdFile) {
      throw new Error("No UMD file found in dist directory");
    }

    return path.join(distDir, umdFile);
  } catch (error) {
    logError(`Failed to find UMD file: ${error.message}`);
    process.exit(1);
  }
}

function injectVersion(umdFilePath, version, libraryName) {
  try {
    logStep("Reading compiled UMD file");
    const umdContent = fs.readFileSync(umdFilePath, "utf8");
    logSuccess("UMD file read successfully");

    logStep("Injecting version and library name information");

    // Define the library name for dynamic access in the addon
    const libraryNameSnippet = `window.flowScannerLibraryName = "${libraryName}";\n`;

    // Create the version injection snippet
    const versionSnippet = `
// Version injection
if (typeof window !== 'undefined' && window.${libraryName}) {
  window.${libraryName}.version = "${version}";
}`;

    // Prepend library name and append the version snippet to the UMD content
    const finalContent = libraryNameSnippet + umdContent + versionSnippet;

    // Write the final file
    const outputPath = path.join(process.cwd(), "flow-scanner-core.js");
    fs.writeFileSync(outputPath, finalContent, "utf8");

    logSuccess(`Version ${version} injected successfully`);
    logSuccess(`Output file created: ${outputPath}`);

    // Log file size
    const stats = fs.statSync(outputPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    log(`File size: ${fileSizeInKB} KB`, "yellow");

  } catch (error) {
    logError(`Failed to inject version: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  log("🚀 Flow Linter Core Build Script", "green");
  log("============================================", "green");

  // Step 1: Read package.json to get version
  logStep("Reading package.json");
  const packageJson = readPackageJson();
  const version = packageJson.version;
  logSuccess(`Version found: ${version}`);

  const libraryName = getLibraryNameFromViteConfig();

  // Step 2: Install dependencies
  runCommand("npm install", "Installing dependencies");

  // Step 3: Build the project
  runCommand("npm run vite:dist", "Building project with Vite");

  // Step 4: Find the UMD file
  logStep("Locating compiled UMD file");
  const distDir = path.join(process.cwd(), "dist");

  if (!fs.existsSync(distDir)) {
    logError("Dist directory not found. Build may have failed.");
    process.exit(1);
  }

  const umdFilePath = findUMDFile(distDir);
  logSuccess(`UMD file found: ${path.basename(umdFilePath)}`);

  // Step 5: Inject version and create final output
  injectVersion(umdFilePath, version, libraryName);

  log("\n🎉 Build completed successfully!", "green");
  log("The flow-scanner-core.js file is ready for use.", "green");
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {main};
