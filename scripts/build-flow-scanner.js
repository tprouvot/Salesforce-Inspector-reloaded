#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step) {
  log(`\n${step}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function runCommand(command, description) {
  try {
    logStep(description);
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} completed successfully`);
  } catch (error) {
    logError(`${description} failed`);
    process.exit(1);
  }
}

function readPackageJson() {
  try {
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return packageJson;
  } catch (error) {
    logError('Failed to read package.json');
    process.exit(1);
  }
}

function findUMDFile(distDir) {
  try {
    const files = fs.readdirSync(distDir);
    const umdFile = files.find(file => file.endsWith('.umd.js') || file.endsWith('.umd.cjs'));
    
    if (!umdFile) {
      throw new Error('No UMD file found in dist directory');
    }
    
    return path.join(distDir, umdFile);
  } catch (error) {
    logError(`Failed to find UMD file: ${error.message}`);
    process.exit(1);
  }
}

function injectVersion(umdFilePath, version) {
  try {
    logStep('Reading compiled UMD file');
    const umdContent = fs.readFileSync(umdFilePath, 'utf8');
    logSuccess('UMD file read successfully');
    
    logStep('Injecting version information');
    
    // Create the version injection snippet
    const versionSnippet = `
// Version injection
if (typeof window !== 'undefined' && window.lightningflowscanner) {
  window.lightningflowscanner.version = "${version}";
}`;
    
    // Append the version snippet to the UMD content
    const finalContent = umdContent + versionSnippet;
    
    // Write the final file
    const outputPath = path.join(__dirname, 'flow-scanner-core.js');
    fs.writeFileSync(outputPath, finalContent, 'utf8');
    
    logSuccess(`Version ${version} injected successfully`);
    logSuccess(`Output file created: ${outputPath}`);
    
    // Log file size
    const stats = fs.statSync(outputPath);
    const fileSizeInKB = (stats.size / 1024).toFixed(2);
    log(`File size: ${fileSizeInKB} KB`, 'yellow');
    
  } catch (error) {
    logError(`Failed to inject version: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  log('🚀 Lightning Flow Scanner Core Build Script', 'green');
  log('============================================', 'green');
  
  // Step 1: Read package.json to get version
  logStep('Reading package.json');
  const packageJson = readPackageJson();
  const version = packageJson.version;
  logSuccess(`Version found: ${version}`);
  
  // Step 2: Install dependencies
  runCommand('npm install', 'Installing dependencies');
  
  // Step 3: Build the project
  runCommand('npm run vite:dist', 'Building project with Vite');
  
  // Step 4: Find the UMD file
  logStep('Locating compiled UMD file');
  const distDir = path.join(__dirname, 'dist');
  
  if (!fs.existsSync(distDir)) {
    logError('Dist directory not found. Build may have failed.');
    process.exit(1);
  }
  
  const umdFilePath = findUMDFile(distDir);
  logSuccess(`UMD file found: ${path.basename(umdFilePath)}`);
  
  // Step 5: Inject version and create final output
  injectVersion(umdFilePath, version);
  
  log('\n🎉 Build completed successfully!', 'green');
  log('The flow-scanner-core.js file is ready for use.', 'green');
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main }; 