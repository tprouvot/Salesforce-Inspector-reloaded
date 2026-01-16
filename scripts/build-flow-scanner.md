# How to Build flow-scanner-core.js for Salesforce Inspector

**Run this script from the root of the Chrome extension repo.**

## Prerequisites

**pnpm** must be installed globally:
```sh
npm install -g pnpm
```

## Quick Steps

### Build Latest Version (Default)
**Single command to build and install the latest version:**
```sh
npm run build-flow-scanner
```

### Build Specific Version
**To build a specific version of the flow scanner core:**
```sh
node scripts/build-flow-scanner.js 6.13.0
```

Or with the full tag name:
```sh
node scripts/build-flow-scanner.js core-v6.13.0
```

## What the Script Does

This command will:
1. **Clone** the Lightning Flow Scanner monorepo from GitHub
2. **Fetch tags** to enable version selection
3. **Checkout** the specified version (or auto-detect the latest `core-v*` tag)
4. **Install dependencies** using pnpm (handles workspace dependencies)
5. **Build** the project using pnpm dist (Turborepo orchestrates the build)
6. **Install** the compiled file directly to `addon/lib/flow-scanner-core.js`
7. **Clean up** the temporary build directory

No need to manually clone repositories or move files!

## Technical Details

### Version Selection

The script supports two modes:

1. **Auto-detect Latest (Default):**
   - Fetches all tags from the repository
   - Sorts tags using semantic versioning rules
   - Selects the latest `core-v*` tag automatically
   - Falls back to the default branch if no tags are found

2. **Explicit Version:**
   - Accepts version as a command-line argument
   - Supports both formats: `6.13.0` or `core-v6.13.0`
   - Validates the tag exists before checkout
   - Falls back to default branch if tag is not found

### Cross-Platform Compatibility

The script is designed to work on:
- **macOS** - Uses native Unix tools
- **Windows** - Pure JavaScript sorting (no `head` command dependency)
- **Linux** - Works with all standard distributions

Tag sorting is handled in JavaScript using `localeCompare` with numeric comparison, ensuring correct semantic version ordering (e.g., `v1.10` > `v1.2`).

### Build Process

1. Creates a temporary directory for the build
2. Clones the Lightning Flow Scanner monorepo (shallow clone for speed)
3. Fetches all tags explicitly (shallow clones don't include tags by default)
4. Checks out the target version (specified or latest)
5. Installs dependencies using pnpm from monorepo root
6. Builds the project using pnpm dist (Turborepo handles workspace dependencies)
7. Injects version information from `package.json`
8. Places the final `flow-scanner-core.js` file in `addon/lib/`
9. Cleans up the temporary directory

### Why pnpm?

The Lightning Flow Scanner monorepo uses pnpm workspaces with Turborepo. The `@flow-scanner/core` package depends on `@flow-scanner/regex-scanner` (a workspace package). Building with pnpm from the monorepo root ensures all workspace dependencies are resolved correctly.

### Node.js Compatibility

The script uses native Node.js `fs` module and is compatible with:
- Node.js 16.x (LTS)
- Node.js 18.x (LTS)
- Node.js 20.x (LTS)
- Node.js 22.x (Current)