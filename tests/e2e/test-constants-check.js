/**
 * Ensures test-constants.local.js exists before any test module loads it.
 * Import this first in fixtures.js. Throws a clear error if the file is missing.
 */
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localPath = path.join(__dirname, "test-constants.local.js");

if (!fs.existsSync(localPath)) {
  throw new Error(
    "test-constants.local.js not found. Run: npm run ensure-test-constants\n" +
    "Or use: npm run test:e2e (which runs the ensure script automatically)."
  );
}
