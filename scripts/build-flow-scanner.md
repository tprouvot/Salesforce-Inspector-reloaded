# How to Build flow-scanner-core.js for Salesforce Inspector

**Run this script from the root of the Chrome extension repo.**

## Quick Steps

**Single command to build and install flow-scanner-core.js:**
```sh
npm run build-flow-scanner
```

This command will:
1. **Automatically fetch** the latest lightning-flow-scanner-core repository files
2. **Build** the flow-scanner-core.js in a temporary directory
3. **Install** the compiled file directly to `addon/lib/flow-scanner-core.js`
4. **Clean up** the temporary build directory

No need to manually clone repositories or move files!

### What the Script Does

- Creates a temporary directory for the build
- Clones the lightning-flow-scanner-core repository (shallow clone, no history)
- Installs dependencies and builds the project using Vite
- Injects version information from the core project's `package.json`
- Places the final `flow-scanner-core.js` file in the correct location (`addon/lib/`)
- Cleans up the temporary directory and cloned repository

### Version Injection

- The build script reads the version from the core project's `package.json`