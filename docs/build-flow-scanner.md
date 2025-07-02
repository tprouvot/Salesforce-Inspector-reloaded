# How to Build flow-scanner-core.js for Salesforce Inspector

**Run this script from the root of [`lightning-flow-scanner-core`](https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner-core) — not from the Chrome extension repo.**

## Quick Steps

1. **Clone and enter the core repo:**
   ```sh
   git clone https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner-core.git
   cd lightning-flow-scanner-core
   ```
2. **Build the core file:**
   ```sh
   node scripts/build-flow-scanner.js
   ```
   - This creates `flow-scanner-core.js` in the core repo root.
3. **Copy the output to your extension:**
   ```sh
   cp flow-scanner-core.js /path/to/Salesforce-Inspector-reloaded/addon/flow-scanner-core.js
   ```
4. **Done!** The extension's `/addon/flow-scanner.js` will use this file.

## Versioning: How It Works

- The build script reads the version from `package.json` in the core repo and injects it into the generated `flow-scanner-core.js` file.
- The injected code sets `window.lightningflowscanner.version` to the current version string.
- In the extension:
  - `flow-scanner.js` reads and displays this version in the Flow Scanner UI, so users and maintainers know exactly which core version is running.
  - `options.js` can also access this version (via `window.lightningflowscanner.version`) to show it in settings, about dialogs, or for debugging/support purposes.
- This ensures the extension always knows which version of the core engine is in use, helping with troubleshooting and upgrade tracking.

## Notes
- Only run the script in the core repo root (where `package.json` is).
- If you change the core, rebuild and re-copy the file.
- If you see errors, make sure dependencies are installed (`npm install`).

For more, see: [lightning-flow-scanner-core on GitHub](https://github.com/Lightning-Flow-Scanner/lightning-flow-scanner-core) 