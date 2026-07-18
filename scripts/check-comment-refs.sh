#!/usr/bin/env bash
# ソースコメント内の設計文書参照を検出して fail する（規約: 参照はコミットメッセージにのみ書く）
# 対象: packages/ apps/ 配下の .ts .tsx .js .jsx .astro .css
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

targets=$(git ls-files 'packages/**' 'apps/**' | grep -E '\.(ts|tsx|js|jsx|astro|css)$' || true)
if [ -z "$targets" ]; then
  echo "check-comment-refs: 対象ファイルなし（skip）"
  exit 0
fi

# 検出パターン: (dev/)?docs/design へのパス、NNN-*.md 形式の設計文書名、「設計書」「設計文書」の語
pattern='(dev/)?docs/design|[0-9]{3}-[a-z0-9-]+\.md|設計書|設計文書'

violations=$(echo "$targets" | xargs grep -nE "$pattern" 2>/dev/null || true)

if [ -n "$violations" ]; then
  echo "NG: ソースコード内に設計文書への参照が見つかりました。"
  echo "参照はコミットメッセージに書いてください（CONTRIBUTING.md 参照）。"
  echo "---"
  echo "$violations"
  exit 1
fi

echo "check-comment-refs: OK"
