#!/usr/bin/env node
/* eslint-env node */
/**
 * Ensures tests/e2e/test-constants.local.js exists.
 * Copies from test-constants.template.js if the file does not exist.
 * Run before E2E tests: npm run ensure-test-constants (or it runs automatically via test:e2e).
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const localPath = path.join(rootDir, "tests", "e2e", "test-constants.local.js");
const templatePath = path.join(rootDir, "tests", "e2e", "test-constants.template.js");

if (!fs.existsSync(localPath)) {
  console.warn("test-constants.local.js not found, copying template (mock mode).");
  console.warn("Run 'npm run set-test-constants' to configure for a real org.\n");
  fs.copyFileSync(templatePath, localPath);
}
