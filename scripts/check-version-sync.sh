#!/usr/bin/env bash
# ワークスペース内の各パッケージの package.json の version が一致していることを検証する
# 引数でバージョンを与えた場合は、全 version がそれと一致することも検証する（v プレフィックスは剥がす）
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(git ls-files 'packages/*/package.json' 'apps/*/package.json')
if [ "${#files[@]}" -eq 0 ]; then
  echo "NG: 対象の package.json が見つかりません（ワークスペース構成を確認してください）。" >&2
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
    echo "NG: ${f} に version フィールドがありません。" >&2
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
  echo "NG: package.json 間で version が一致していません。" >&2
  exit 1
fi

if [ -n "$expected" ] && [ "$first" != "$expected" ]; then
  echo "NG: version (${first}) が指定値 (${expected}) と一致しません。" >&2
  exit 1
fi

echo "check-version-sync: OK"
