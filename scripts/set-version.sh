#!/usr/bin/env bash
# ワークスペース内の各パッケージの package.json の version フィールドを一括更新する
# jq は再フォーマットしてしまうため使わず、node で対象行だけを置換する
set -euo pipefail

usage() {
  echo "使い方: scripts/set-version.sh <version>" >&2
  echo "  <version> は X.Y.Z 形式（semver、プレリリースは非対応）" >&2
}

version="${1:-}"

if [ -z "$version" ]; then
  usage
  exit 1
fi

if ! [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "NG: '$version' は X.Y.Z 形式の semver ではありません。" >&2
  usage
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

mapfile -t files < <(git ls-files 'packages/*/package.json' 'apps/*/package.json')
if [ "${#files[@]}" -eq 0 ]; then
  echo "NG: 対象の package.json が見つかりません（ワークスペース構成を確認してください）。" >&2
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
