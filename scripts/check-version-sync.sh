#!/usr/bin/env bash
# Verifies that the version in package.json matches across the workspace's packages.
# If a version is given as an argument, also verifies that all versions match it
# (the "v" prefix, if present, is stripped).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(git ls-files 'packages/*/package.json' 'apps/*/package.json')
if [ "${#files[@]}" -eq 0 ]; then
  echo "NG: no target package.json found (check the workspace configuration)." >&2
  exit 1
fi

expected="${1:-}"
expected="${expected#v}"

declare -A versions
for f in "${files[@]}"; do
  if ! versions["$f"]=$(node -e '
    const fs = require("node:fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (typeof pkg.version !== "string" || pkg.version === "") process.exit(1);
    console.log(pkg.version);
  ' "$f"); then
    echo "NG: ${f} has no version field." >&2
    exit 1
  fi
done

echo "package.json versions:"
for f in "${files[@]}"; do
  echo "  ${f}: ${versions[$f]}"
done

first="${versions[${files[0]}]}"
mismatch=0
for f in "${files[@]}"; do
  if [ "${versions[$f]}" != "$first" ]; then
    mismatch=1
  fi
done

if [ "$mismatch" -eq 1 ]; then
  echo "NG: version mismatch across package.json files." >&2
  exit 1
fi

if [ -n "$expected" ] && [ "$first" != "$expected" ]; then
  echo "NG: version (${first}) does not match the specified value (${expected})." >&2
  exit 1
fi

echo "check-version-sync: OK"
