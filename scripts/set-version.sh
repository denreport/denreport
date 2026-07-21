#!/usr/bin/env bash
# Bulk-updates the version field in package.json across the workspace's packages.
# Avoids jq (it reformats the file) and uses node to replace only the target line.
set -euo pipefail

usage() {
  echo "usage: scripts/set-version.sh <version>" >&2
  echo "  <version> must be in X.Y.Z format (semver; pre-release is not supported)" >&2
}

version="${1:-}"

if [ -z "$version" ]; then
  usage
  exit 1
fi

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "NG: '$version' is not valid X.Y.Z semver." >&2
  usage
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(git ls-files 'packages/*/package.json' 'apps/*/package.json')
if [ "${#files[@]}" -eq 0 ]; then
  echo "NG: no target package.json found (check the workspace configuration)." >&2
  exit 1
fi

for f in "${files[@]}"; do
  node -e '
    const fs = require("node:fs");
    const [file, version] = process.argv.slice(1);
    const text = fs.readFileSync(file, "utf8");
    const updated = text.replace(/^(\s*"version":\s*")[^"]*(")/m, `$1${version}$2`);
    fs.writeFileSync(file, updated);
  ' "$f" "$version"
done

bash scripts/check-version-sync.sh "$version"

echo "set-version: OK (${version})"
