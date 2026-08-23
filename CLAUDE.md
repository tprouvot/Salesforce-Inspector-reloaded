# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome/Firefox extension (Manifest V3) that adds developer and admin tooling to Salesforce orgs. `addon/` **is** the extension, loaded unpacked, and page code is never bundled. The only build steps produce store-ready zips and regenerate vendored libraries; neither runs per-change.

## Commands

```bash
npm install

npm run eslint                       # lint (must be clean; 29 warnings are expected, 0 errors)
npm run eslint -- --fix

npm run test:e2e                     # Playwright e2e, mocked (no org needed)
npm run test:e2e:mock                # same, but resets test-constants.local.js from the template first
npm run test:e2e:debug               # Playwright UI mode
npx playwright test data-export.spec.js          # a single spec
npx playwright test -g "Execute Simple Export"   # a single test by name

npm run set-test-constants           # generate tests/e2e/test-constants.local.js from your default org
npm run set-test-constants -- --dry-run --target-org my-alias

npm run chrome-release-build         # -> target/chrome/dist
npm run firefox-release-build        # -> target/firefox/dist (uses manifest-firefox.json)
npm run chrome-beta-build

npm run sync-vendors                 # refresh committed third-party code from upstream
npm run sync-vendors -- --check      # verify it (no network) — use before committing vendored changes
npm run sync-vendors -- --sbom       # regenerate vendored.cdx.json
npm run build-flow-scanner 6.19.3    # rebuild flow-scanner-core.js at an explicit upstream tag
```

First e2e run also needs `npx playwright install --with-deps chromium`.

Loading locally: Chrome → `chrome://extensions/` → Developer mode → Load unpacked → pick `addon/`. Firefox → run the firefox build, then `about:debugging` → Load Temporary Add-on → `target/firefox/dist/manifest.json`.

## Architecture

### Pages

Each feature is a standalone extension page: `addon/<feature>.html` + `addon/<feature>.js` (17 of them — data-export, data-import, inspect, options, popup, debug-log, event-monitor, flow-scanner, …). They share code but do not share a bundle or a router; each page bootstraps itself.

### The Model + `didUpdate` render loop

This is the single most important pattern to understand, and it is not idiomatic React.

Each page defines a `Model` class that owns all state and business logic. React holds almost none of it. The page bootstrap wires the model to React:

```js
let model = new Model({sfHost, args});
model.reactCallback = cb => { ReactDOM.render(h(App, {model}), root, cb); };
```

Business logic then calls `model.didUpdate()` after mutating itself, which invokes `reactCallback` and re-renders the whole tree. `didUpdate` also fires `model.testCallback`, which is the hook the Playwright tests use to await a settled render.

Consequences when editing:

- To make the UI reflect a change, mutate the model and call `model.didUpdate()`. Do not reach for `setState` for model-owned data.
- `this.setState` is used only for component-local UI state (open/closed, hover, selection index).
- Never assign `this.state` directly outside a constructor, and derive new state from `prevState` in the updater form — `@eslint-react/no-access-state-in-setstate` enforces this.

### React 19 as a global, no JSX

`addon/react.js` / `react-dom.js` are **React 19**, loaded as plain `<script>` tags, not imported. Every page starts with `/* global React ReactDOM */` and `let h = React.createElement;`, and the UI is written as `h("div", {...}, children)`. There is no JSX anywhere.

React 19 publishes no UMD build, so `npm run sync-vendors` bundles the npm package with esbuild into an IIFE that assigns `window.React` / `window.ReactDOM`. This is the only build step in the project, it runs on demand rather than per-change, and the page code stays bundler-free. Never edit those four files by hand — regenerate them.

Two compatibility details live in that bundle rather than in the pages:

- `ReactDOM.render` was removed in React 19. The bundle re-adds it over `createRoot`, caching one root per container (React errors if `createRoot` runs twice on the same node, and pages re-render repeatedly through `reactCallback`) and wrapping in `flushSync` so `didUpdate(cb)` keeps running its callback after the DOM is updated.
- Class components are still used throughout; hooks are not.

String refs were removed in React 19 and are fully migrated: write `ref: el => { this.refs.foo = el; }`, which keeps `this.refs.foo` readable as before. Do not reintroduce `ref: "foo"` — React 19 throws on it, and an uncaught error in render unmounts the whole tree rather than leaving a partial DOM, so the symptom is a blank page far from the cause.

### Salesforce session flow

`addon/inspector.js` is the shared API layer — `sfConn` (REST/SOAP/Tooling calls, `apiVersion`), plus the `XML` helper. 19 of the page modules import it.

Sessions are not obtained by OAuth on the normal path. `sfConn.getSession(sfHost)` messages the `background.js` service worker, which reads the org's `sid` cookie via `chrome.cookies`. That is the only reason the extension requests the `cookies` permission, and it is why the extension can act as the logged-in user without a connected app. A connected-app/OAuth path also exists as an alternative (see the README).

`addon/utils.js` holds cross-page helpers (`Constants`, `UserInfoModel`, `StorageHistory`, org-type styling, option/setting lookups).

### Content scripts

`button.js` (injects the in-page launcher, exports the `initButton` global consumed by several pages), `inspect-inline.js` and `inject.js` run inside Salesforce pages, declared in the manifests' `content_scripts`. Per the design principles, they must stay inert until the user interacts.

### Vendored third-party code

`addon/lib/` (cometd, prism, flow-scanner-core), `addon/react*.js` and `addon/styles/slds/` are committed third-party code, ~2 MB. They are declared in `vendors.json` with an upstream source, version, license and SHA-256 per file, and managed by `scripts/sync-vendors.js`.

Do not hand-edit these files, and do not let a formatter touch them — a 2024 ESLint autofix silently rewrote the vendored React bundle and went unnoticed for two years. They are excluded from linting in `.mega-linter.yml` and `eslint.config.mjs` for that reason.

Upgrading one is two steps, and CI enforces both:

1. bump the version (in `package.json` for the npm-sourced ones, or `vendors.json` for flow-scanner-core)
2. regenerate the committed artifact — `npm run sync-vendors`, or `npm run build-flow-scanner <version>` — then `npm run sync-vendors -- --sbom` and commit everything

The MegaLinter workflow runs `sync-vendors --check` on every push, which fails if a committed file no longer matches its recorded hash, or if `devDependencies` and `vendors.json` disagree on a version. So a Dependabot PR that bumps `package.json` alone will not go green.

`react`, `react-dom`, `cometd` and `prismjs` are declared as exact `devDependencies` even though the pages never import them from `node_modules`. That is deliberate: it is what puts them in `package-lock.json`, which is the file Dependabot and the vulnerability scanners (osv-scanner, grype, trivy) actually read. Do not remove them for being "unused". `vendored.cdx.json` is a CycloneDX SBOM of the same set — useful as a provenance record, but the scanner logs give no evidence it is read, so `devDependencies` is the mechanism to rely on.

`lightning-flow-scanner-core` cannot use that route: its npm package is stalled far behind the GitHub tags it is built from, so its version lives only in `vendors.json`, tracked by a custom manager in `renovate.json`. SLDS has no published source at all and is only checksummed.

## Conventions

- Two-space indent, double quotes, semicolons — enforced by `eslint.config.mjs` (ESLint 10 + `@eslint-react`).
- `ignores` in `eslint.config.mjs` must stay a standalone config object. Merging it into a block that also has `rules` silently scopes it to that block only, which previously left all vendored code being linted.
- A leading underscore marks a private member; `no-underscore-dangle` is off deliberately.
- Files carry their globals in a header comment (`/* global React ReactDOM initButton */`) rather than declaring them in the shared ESLint config.
- Line endings are not normalized (`.gitattributes` is `* -text`), so preserve a file's existing CRLF/LF when editing.

## Contributing

Branch from `releaseCandidate` (the default branch and the work-in-progress next version); it merges to `beta`, then to the release branch when published. PRs are expected to update `CHANGES.md` (newest entry on top) and the relevant page under `docs/`.

CI runs MegaLinter (31 linters, all blocking except markdownlint) and Playwright. `test-real-org` is skipped on fork PRs by design.

The e2e suite is flaky when run locally. `playwright.config.js` uses `retries: 2` and one worker only under `CI`, so a local run has no retries and defaults to one worker per core; repeated local runs of unchanged code fail on different tests each time. Reproduce with `--workers=1 --retries=2` before concluding a change broke something, and confirm any suspected regression by re-running the single test against stashed code.

## Design principles

From the README, and they shape what gets accepted:

- Stay completely inactive until the user explicitly interacts. The extension monkey-patches and uses internal APIs, so merely having it installed must never break Salesforce.
- Ad-hoc manual use only; enabling automation is a non-goal.
- Efficiency over discoverability — advanced features hidden, primary features central, performance matters.
- Surface contextual information automatically rather than on request (e.g. autocomplete everywhere).
- Keep raw Salesforce API access reachable, and degrade gracefully — e.g. still show export results even when the SOQL cannot be parsed.
- Be conservative with the number and complexity of API requests, without sacrificing the above.
