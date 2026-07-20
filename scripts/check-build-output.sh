#!/usr/bin/env bash
# 各パッケージの dist/ 配下に配布物（エントリ JS・型定義）が揃っていること、
# および targets の同梱フォント資材が dist からの相対パスで実在することを検証する
# 前提: pnpm run build:packages を先に実行していること
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

fail=0

for pkg in core targets designer; do
  entry_js="packages/${pkg}/dist/index.js"
  entry_dts="packages/${pkg}/dist/index.d.ts"
  if [ ! -f "$entry_js" ]; then
    echo "NG: ${entry_js} が見つかりません（pnpm run build:packages を先に実行してください）。" >&2
    fail=1
  fi
  if [ ! -f "$entry_dts" ]; then
    echo "NG: ${entry_dts} が見つかりません（pnpm run build:packages を先に実行してください）。" >&2
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "check-build-output: エントリ JS / d.ts の存在 OK"
fi

if [ "$fail" -eq 1 ]; then
  exit 1
fi

# EMBEDDED_FONT_URL 等は import.meta.url からの相対パスで解決するため、
# dist に配置した状態で実際に import してパスを解決させないと構造保持を検証できない
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
      console.error(`NG: ${name} の解決先が存在しません: ${url}`);
      missing = true;
    }
  }
  if (missing) process.exit(1);
'; then
  echo "NG: targets のフォント資材の相対解決に失敗しました。" >&2
  exit 1
fi

echo "check-build-output: フォント資材の相対解決 OK"
