#!/usr/bin/env bash
# Verifies that each package's dist/ has its distributable files (entry JS + type defs),
# that the dist entry can actually be imported by node,
# and that targets' bundled font assets resolve from dist via relative paths.
# Prerequisite: run pnpm run build:packages first.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

for pkg in core targets designer; do
  entry_js="packages/${pkg}/dist/index.js"
  entry_dts="packages/${pkg}/dist/index.d.ts"
  if [ ! -f "$entry_js" ]; then
    echo "NG: ${entry_js} not found (run pnpm run build:packages first)." >&2
    fail=1
  fi
  if [ ! -f "$entry_dts" ]; then
    echo "NG: ${entry_dts} not found (run pnpm run build:packages first)." >&2
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "check-build-output: entry JS / d.ts presence OK"
fi

if [ "$fail" -eq 1 ]; then
  exit 1
fi

# Within the workspace, @denreport/* resolves to dev exports (pointing straight at src),
# so alias @denreport/* to the dist entries before importing, to mimic dist-to-dist
# resolution after publishing.
if ! node --input-type=module -e '
  import { register } from "node:module";
  import { pathToFileURL } from "node:url";
  import { resolve as resolvePath } from "node:path";

  const DIST_ALIASES = {
    "@denreport/core": pathToFileURL(resolvePath("packages/core/dist/index.js")).href,
    "@denreport/targets": pathToFileURL(resolvePath("packages/targets/dist/index.js")).href,
  };
  const hookSource = `
    export async function resolve(specifier, context, nextResolve) {
      const aliases = ${JSON.stringify(DIST_ALIASES)};
      if (aliases[specifier]) return nextResolve(aliases[specifier], context);
      return nextResolve(specifier, context);
    }
  `;
  register(`data:text/javascript,${encodeURIComponent(hookSource)}`, import.meta.url);

  for (const pkg of ["core", "targets", "designer"]) {
    const entry = `packages/${pkg}/dist/index.js`;
    try {
      await import(pathToFileURL(resolvePath(entry)).href);
    } catch (err) {
      console.error(`NG: failed to import ${entry}: ${err.message}`);
      process.exit(1);
    }
  }
'; then
  echo "NG: dist entry import verification failed." >&2
  exit 1
fi

echo "check-build-output: dist entry import OK"

# EMBEDDED_FONT_URL and friends resolve relative to import.meta.url, so we must
# actually import them once placed in dist to let the paths resolve — only then
# can structural preservation be verified.
if ! node --input-type=module -e '
  import * as fs from "node:fs";
  import {
    EMBEDDED_FONT_URL,
    EMBEDDED_BOLD_FONT_URL,
    EMBEDDED_FONT_LICENSE_URL,
  } from "./packages/targets/dist/fonts/embedded.js";

  const urls = { EMBEDDED_FONT_URL, EMBEDDED_BOLD_FONT_URL, EMBEDDED_FONT_LICENSE_URL };
  let missing = false;
  for (const [name, url] of Object.entries(urls)) {
    if (!fs.existsSync(url)) {
      console.error(`NG: resolved path for ${name} does not exist: ${url}`);
      missing = true;
    }
  }
  if (missing) process.exit(1);
'; then
  echo "NG: relative resolution of targets' font assets failed." >&2
  exit 1
fi

echo "check-build-output: font asset relative resolution OK"
