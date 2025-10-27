#!/usr/bin/env node

const {execSync} = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ANSI color codes for console output
const colors = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  reset: "\x1b[0m"
};

function log(message, color) {
  "use strict";
  color = color || "reset";
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  "use strict";
  log(`\n${step}`, "blue");
}

function logSuccess(message) {
  "use strict";
  log(`✓ ${message}`, "green");
}

function logError(message) {
  "use strict";
  log(`✗ ${message}`, "red");
}


function createTempDir() {
  "use strict";
  const tempDir = path.join(os.tmpdir(), `flow-scanner-build-${Date.now()}`);
  fs.mkdirSync(tempDir, {recursive: true});
  return tempDir;
}

function cleanupTempDir(tempDir) {
  "use strict";
  try {
    fs.rmSync(tempDir, {recursive: true, force: true});
    logSuccess(`Cleaned up temporary directory: ${tempDir}`);
  } catch (error) {
    log(`Warning: Could not clean up temporary directory: ${error.message}`, "yellow");
  }
}

function setupRemoteRepo(tempDir) {
  "use strict";
  const repoUrl = "https://github.com/flow-scanner/lightning-flow-scanner-core";

  logStep("Cloning lightning-flow-scanner-core repository (shallow clone)");

  // Clone directly into tempDir with shallow clone (no history)
  execSync(`git clone --depth 1 ${repoUrl} "${tempDir}"`, {stdio: "inherit"});

  logSuccess("Repository cloned successfully");
}

function getLibraryNameFromViteConfig(tempDir) {
  "use strict";
  logStep("Reading Vite config to get library name");
  try {
    const viteConfigPath = path.join(tempDir, "vite.config.ts");
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

function runCommand(command, description, cwd) {
  "use strict";
  try {
    logStep(description);
    execSync(command, {stdio: "inherit", cwd: cwd || process.cwd()});
    logSuccess(`${description} completed successfully`);
  } catch {
    logError(`${description} failed`);
    process.exit(1);
  }
}

function readPackageJson(tempDir) {
  "use strict";
  try {
    const packageJsonPath = path.join(tempDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return packageJson;
  } catch {
    logError("Failed to read package.json");
    process.exit(1);
  }
  return null;
}

function findUMDFile(distDir) {
  "use strict";
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
  return null;
}

function injectVersion(umdFilePath, version, libraryName) {
  "use strict";
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

    // Write the final file to the addon/lib directory
    const addonLibDir = path.join(process.cwd(), "addon", "lib");
    if (!fs.existsSync(addonLibDir)) {
      fs.mkdirSync(addonLibDir, {recursive: true});
    }
    const outputPath = path.join(addonLibDir, "flow-scanner-core.js");
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
  "use strict";
  log("🚀 Lightning Flow Scanner Core Build Script", "green");
  log("============================================", "green");

  let tempDir;

  try {
    // Step 1: Create temporary directory and setup remote repo
    tempDir = createTempDir();
    logSuccess(`Created temporary directory: ${tempDir}`);

    setupRemoteRepo(tempDir);

    // Step 2: Read package.json to get version
    logStep("Reading package.json");
    const packageJson = readPackageJson(tempDir);
    const version = packageJson.version;
    logSuccess(`Version found: ${version}`);

    const libraryName = getLibraryNameFromViteConfig(tempDir);

    // Step 3: Install dependencies
    runCommand("npm install", "Installing dependencies", tempDir);

    // Step 4: Build the project
    runCommand("npm run vite:dist", "Building project with Vite", tempDir);

    // Step 5: Find the UMD file
    logStep("Locating compiled UMD file");
    const distDir = path.join(tempDir, "dist");

    if (!fs.existsSync(distDir)) {
      logError("Dist directory not found. Build may have failed.");
      process.exit(1);
    }

    const umdFilePath = findUMDFile(distDir);
    logSuccess(`UMD file found: ${path.basename(umdFilePath)}`);

    // Step 6: Inject version and create final output
    injectVersion(umdFilePath, version, libraryName);

    log("\n🎉 Build completed successfully!", "green");
    log("The flow-scanner-core.js file is ready for use in addon/lib/", "green");

  } catch (error) {
    logError(`Build failed: ${error.message}`);
    process.exit(1);
  } finally {
    // Clean up temporary directory
    if (tempDir) {
      cleanupTempDir(tempDir);
    }
  }
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = {main};
