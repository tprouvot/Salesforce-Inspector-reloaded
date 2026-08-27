#!/usr/bin/env node

/**
 * Fetches every third-party library committed into this repository from its
 * declared upstream source, as described by vendors.json.
 *
 *   npm run sync-vendors            refresh the committed copies
 *   npm run sync-vendors -- --check verify them without touching the tree
 *   npm run sync-vendors -- --name react
 *
 * --check makes no network calls: it only hashes what is on disk and compares
 * against the manifest, so it is cheap enough to run in CI on every push.
 */

const {execFileSync} = require("child_process");
const nodeCrypto = require("node:crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "vendors.json");

const colors = {green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", blue: "\x1b[34m", dim: "\x1b[2m", reset: "\x1b[0m"};
function say(msg, color) {
  "use strict";
  console.log(`${colors[color] || ""}${msg}${colors.reset}`);
}

function sha256(file) {
  "use strict";
  return nodeCrypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function parseArgs(argv) {
  "use strict";
  const args = {check: false, name: null, sbom: false};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--check") {
      args.check = true;
    } else if (argv[i] === "--sbom") {
      args.sbom = true;
    } else if (argv[i] === "--name") {
      args.name = argv[++i];
    }
  }
  return args;
}

/**
 * Downloads and unpacks a package, returning its directory.
 *
 * Uses `npm install` rather than `npm pack` + tar: npm does the unpacking
 * itself, which avoids depending on a `tar` binary (Windows bsdtar exits
 * non-zero on npm's extended tar headers). `--ignore-scripts` means no
 * lifecycle script from a fetched package runs on the machine doing the sync.
 */
function fetchNpm(spec, tmp) {
  "use strict";
  const dir = path.join(tmp, spec.replace(/[^a-z0-9.-]/gi, "_"));
  fs.mkdirSync(dir, {recursive: true});
  // Node refuses to spawn npm.cmd without a shell, and a shell does not escape
  // arguments, so the spec is validated against a strict allowlist first.
  if (!/^@?[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)?@[a-z0-9][a-z0-9.+-]*$/i.test(spec)) {
    throw new Error(`Refusing to fetch malformed package spec: ${spec}`);
  }
  const onWindows = process.platform === "win32";
  execFileSync(onWindows ? "npm.cmd" : "npm", [
    "install", spec,
    "--prefix", dir,
    "--no-save", "--no-audit", "--no-fund",
    "--ignore-scripts", "--silent",
  ], {stdio: ["ignore", "ignore", "inherit"], shell: onWindows});

  // "react@15.4.0" -> "react", "@scope/pkg@1.2.3" -> "@scope/pkg"
  const at = spec.lastIndexOf("@");
  const name = at > 0 ? spec.slice(0, at) : spec;
  const pkgDir = path.join(dir, "node_modules", ...name.split("/"));
  if (!fs.existsSync(pkgDir)) {
    throw new Error(`npm install did not produce ${pkgDir} for ${spec}`);
  }
  return pkgDir;
}

function writeOut(dest, buffer, results) {
  "use strict";
  const abs = path.join(ROOT, dest);
  const before = fs.existsSync(abs) ? sha256(abs) : null;
  fs.mkdirSync(path.dirname(abs), {recursive: true});
  fs.writeFileSync(abs, buffer);
  const after = sha256(abs);
  results.push({dest, changed: before !== after, sha256: after});
}

/**
 * The npm-sourced vendors are also declared as exact devDependencies, so that
 * Dependabot proposes upgrades for them and every vulnerability scanner sees
 * them through package-lock.json. That only helps if the two stay in step: when
 * Dependabot bumps package.json, this check fails until someone re-runs the
 * sync and commits the regenerated files.
 */
function verifyPinnedVersion(vendor) {
  "use strict";
  if (!vendor.source || !vendor.source.startsWith("npm:")) {
    return null;
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const declared = (pkg.devDependencies || {})[vendor.name];
  if (!declared) {
    return `${vendor.name} is not declared in devDependencies, so Dependabot and the vulnerability scanners cannot see it`;
  }
  if (declared !== vendor.version) {
    return `devDependencies has ${vendor.name}@${declared} but vendors.json pins ${vendor.version} — run \`npm run sync-vendors\` and commit the result`;
  }
  return null;
}

/** --check: hash what is on disk and compare against the manifest. */
function verify(vendor) {
  "use strict";
  const problems = [];
  const versionProblem = verifyPinnedVersion(vendor);
  if (versionProblem) {
    problems.push(versionProblem);
  }
  const entries = [...(vendor.files || [])];
  if (vendor.bundle && vendor.bundle.sha256) {
    entries.push(vendor.bundle);
  }
  for (const g of vendor.browserGlobals || []) {
    if (g.sha256) {
      entries.push(g);
    }
  }
  for (const f of entries) {
    if (!f.sha256) {
      continue;
    }
    const abs = path.join(ROOT, f.to);
    if (!fs.existsSync(abs)) {
      problems.push(`${f.to}: missing`);
      continue;
    }
    const actual = sha256(abs);
    if (actual !== f.sha256) {
      problems.push(`${f.to}: sha256 ${actual.slice(0, 12)}… expected ${f.sha256.slice(0, 12)}…`);
    }
  }
  return problems;
}

function syncVendor(vendor, tmp) {
  "use strict";
  const results = [];

  if (vendor.source === "manual" || vendor.source.startsWith("script:")) {
    say(`  skipped — ${vendor.source === "manual" ? "no fetchable upstream artifact" : "built by " + vendor.source.slice(7)}`, "dim");
    return results;
  }

  const pkgDir = fetchNpm(vendor.source.slice(4), tmp);

  for (const f of vendor.files || []) {
    if (!f.from) {
      continue;
    }
    writeOut(f.to, fs.readFileSync(path.join(pkgDir, f.from)), results);
  }

  if (vendor.copyDir) {
    const from = path.join(pkgDir, vendor.copyDir.from);
    const exts = (vendor.copyDir.include || []).map(p => p.replace("*", ""));
    for (const entry of fs.readdirSync(from)) {
      if (!exts.some(e => entry.endsWith(e))) {
        continue;
      }
      writeOut(path.join(vendor.copyDir.to, entry), fs.readFileSync(path.join(from, entry)), results);
    }
  }

  for (const g of vendor.browserGlobals || []) {
    // React 19 no longer publishes UMD builds, and these pages load React with a
    // plain <script> tag rather than through a bundler. esbuild turns the npm
    // package into an IIFE assigning the same globals the pages already use, so
    // page code keeps working unchanged.
    //
    // The JS API is used rather than the CLI: it resolves bare imports from
    // resolveDir (the throwaway install tree) and takes `define` as real values,
    // where a Windows shell would strip the quotes around "production".
    const esbuild = require("esbuild");
    const result = esbuild.buildSync({
      stdin: {contents: vendor.browserGlobalEntry, resolveDir: path.resolve(pkgDir, "..", ".."), loader: "js"},
      bundle: true,
      minify: Boolean(g.minify),
      format: "iife",
      define: {"process.env.NODE_ENV": JSON.stringify(g.nodeEnv)},
      write: false,
      logLevel: "warning",
    });
    const banner = Buffer.from(`/* ${vendor.name} ${vendor.version} (${g.nodeEnv}) — bundled as a browser global by scripts/sync-vendors.js. Do not edit. */
`);
    writeOut(g.to, Buffer.concat([banner, Buffer.from(result.outputFiles[0].contents)]), results);
  }

  if (vendor.bundle) {
    const parts = vendor.bundle.parts.map(p => fs.readFileSync(path.join(pkgDir, p)));
    const header = Buffer.from(`/* ${vendor.name} ${vendor.version} — assembled by scripts/sync-vendors.js from ${vendor.bundle.parts.join(", ")} */\n`);
    writeOut(vendor.bundle.to, Buffer.concat([header, ...parts]), results);
  }

  return results;
}

function writeSbom(manifest) {
  "use strict";
  const components = manifest.vendors.filter(v => v.purl).map(v => {
    const files = [...(v.files || []), ...(v.browserGlobals || [])];
    if (v.bundle && v.bundle.sha256) {
      files.push(v.bundle);
    }
    return {
      type: "library",
      name: v.name,
      version: v.version,
      purl: v.purl,
      licenses: v.license ? [{license: {name: v.license}}] : undefined,
      externalReferences: v.homepage ? [{type: "website", url: v.homepage}] : undefined,
      hashes: files.filter(f => f.sha256).map(f => ({alg: "SHA-256", content: f.sha256})),
      properties: [{name: "sif:committedPaths", value: files.map(f => f.to).join(" ")}],
    };
  });
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    version: 1,
    metadata: {component: {type: "application", name: "salesforce-inspector-reloaded"}},
    components,
  };
  const out = path.join(ROOT, "vendored.cdx.json");
  // A literal newline, not os.EOL: this file is committed, and CRLF on Windows
  // would make the tree differ by platform.
  fs.writeFileSync(out, JSON.stringify(sbom, null, 2) + String.fromCharCode(10));
  say(`Wrote ${components.length} components to vendored.cdx.json`, "green");
  say("Vulnerability scanners read this; they only see package-lock.json otherwise.", "dim");
}

function main() {
  "use strict";
  const args = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const vendors = manifest.vendors.filter(v => !args.name || v.name === args.name);

  if (vendors.length === 0) {
    say(`No vendor named "${args.name}" in vendors.json`, "red");
    process.exit(1);
  }

  if (args.sbom) {
    writeSbom(manifest);
    return;
  }

  if (args.check) {
    say("Verifying committed third-party code against vendors.json\n", "blue");
    let failed = 0;
    for (const v of vendors) {
      const problems = verify(v);
      if (problems.length === 0) {
        say(`  ok       ${v.name}@${v.version}`, "green");
      } else {
        failed += problems.length;
        say(`  DRIFTED  ${v.name}@${v.version}`, "red");
        problems.forEach(p => say(`             ${p}`, "red"));
      }
    }
    if (failed > 0) {
      say(`\n${failed} file(s) do not match the manifest. Run \`npm run sync-vendors\` to refresh, or update vendors.json if the change was intended.`, "red");
      process.exit(1);
    }
    say("\nAll committed third-party files match vendors.json.", "green");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sync-vendors-"));
  let changed = 0;
  try {
    for (const v of vendors) {
      say(`\n${v.name}@${v.version}  ${colors.dim}${v.source}${colors.reset}`, "blue");
      if (v.syncNote) {
        say(`  note: ${v.syncNote}`, "dim");
      }
      for (const r of syncVendor(v, tmp)) {
        say(`  ${r.changed ? "updated" : "unchanged"}  ${r.dest}`, r.changed ? "yellow" : "dim");
        if (r.changed) {
          changed++;
        }
      }
    }
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }

  say(`\n${changed} file(s) changed.`, changed ? "yellow" : "green");
  if (changed > 0) {
    say("Review the diff, then update the sha256 values in vendors.json to match:", "yellow");
    say("  npm run sync-vendors -- --check", "dim");
  }
}

main();
