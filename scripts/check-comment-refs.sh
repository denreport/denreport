#!/usr/bin/env bash
# Detects references to design documents in source comments and fails (convention:
# references belong only in commit messages).
# Targets: .ts .tsx .js .jsx .astro .css under packages/ apps/
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

targets=$(git ls-files 'packages/**' 'apps/**' | grep -E '\.(ts|tsx|js|jsx|astro|css)$' || true)
if [ -z "$targets" ]; then
  echo "check-comment-refs: no target files (skip)"
  exit 0
fi

# Detection pattern: paths under (dev/)?docs/design, NNN-*.md-style design doc filenames,
# and the words 設計書/設計文書
pattern='(dev/)?docs/design|[0-9]{3}-[a-z0-9-]+\.md|設計書|設計文書'

violations=$(echo "$targets" | xargs grep -nE "$pattern" 2>/dev/null || true)

if [ -n "$violations" ]; then
  echo "NG: found references to design documents in the source code."
  echo "Put references in commit messages instead (see CONTRIBUTING.md)."
  echo "---"
  echo "$violations"
  exit 1
fi

echo "check-comment-refs: OK"
