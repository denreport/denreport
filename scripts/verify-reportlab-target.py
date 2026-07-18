#!/usr/bin/env python3
"""ReportLab 書き出し器のスナップショット .py を同梱フォント配置つきで実行し、
実フォント埋め込みの PDF 生成とページ数を検証する。"""

import argparse
import glob
import json
import py_compile
import re
import runpy
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader

SNAPSHOT_GLOB = "packages/targets/tests/__snapshots__/reportlab-*.py"
TEMPLATE_PREFIX = "reportlab-template-"
FONT_ASSET = Path("packages/targets/assets/fonts/NotoSansJP-Regular.ttf")
PAGE_COUNT_RE = re.compile(r"^PAGE_COUNT = (\d+)$", re.MULTILINE)
FONT_FILE_RE = re.compile(r'^FONT_FILE = "(.+)"$', re.MULTILINE)


def verify(path, keep_dir=None):
    try:
        py_compile.compile(str(path), doraise=True)
    except py_compile.PyCompileError as exc:
        return f"py_compile failed: {exc}"

    source = path.read_text(encoding="utf-8")
    match = PAGE_COUNT_RE.search(source)
    if match is None:
        return "PAGE_COUNT constant not found"
    expected_pages = int(match.group(1))

    font_match = FONT_FILE_RE.search(source)
    if font_match is None:
        return "FONT_FILE constant not found"

    with tempfile.TemporaryDirectory() as tmp_dir:
        script = Path(tmp_dir) / path.name
        shutil.copyfile(path, script)
        shutil.copyfile(FONT_ASSET, Path(tmp_dir) / font_match.group(1))
        out_pdf = Path(tmp_dir) / "out.pdf"
        result = subprocess.run(
            [sys.executable, str(script), str(out_pdf)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return f"execution failed (exit {result.returncode}): {result.stderr}"

        actual_pages = len(PdfReader(str(out_pdf)).pages)
        if actual_pages != expected_pages:
            return (
                f"page count mismatch: PAGE_COUNT={expected_pages}, "
                f"PDF pages={actual_pages}"
            )

        if keep_dir is not None:
            keep_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(out_pdf, keep_dir / f"{path.stem}.pdf")

    return None


def verify_template(path, keep_dir=None):
    try:
        py_compile.compile(str(path), doraise=True)
    except py_compile.PyCompileError as exc:
        return f"py_compile failed: {exc}"

    data_path = path.parent / f"{path.stem}.data.json"
    if not data_path.exists():
        return f"paired data fixture not found: {data_path}"
    payload = json.loads(data_path.read_text(encoding="utf-8"))

    source = path.read_text(encoding="utf-8")
    font_match = FONT_FILE_RE.search(source)
    if font_match is None:
        return "FONT_FILE constant not found"
    has_bind = "_bind_str(" in source or "_bind_rows(" in source

    with tempfile.TemporaryDirectory() as tmp_dir:
        script = Path(tmp_dir) / path.name
        shutil.copyfile(path, script)
        shutil.copyfile(FONT_ASSET, Path(tmp_dir) / font_match.group(1))
        out_pdf = Path(tmp_dir) / "out.pdf"

        # __main__ ブロックを発火させずに build を直接呼ぶ
        module = runpy.run_path(str(script))
        module["build"](str(out_pdf), payload["data"])

        actual_pages = len(PdfReader(str(out_pdf)).pages)
        if actual_pages != payload["pages"]:
            return (
                f"page count mismatch: fixture pages={payload['pages']}, "
                f"PDF pages={actual_pages}"
            )

        if has_bind:
            result = subprocess.run(
                [sys.executable, str(script), str(out_pdf)],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                return "expected a non-zero exit when run without data"

        if keep_dir is not None:
            keep_dir.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(out_pdf, keep_dir / f"{path.stem}.pdf")

    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--keep",
        type=Path,
        metavar="DIR",
        help="検証に合格した生成 PDF をこのディレクトリへ保存する",
    )
    args = parser.parse_args()

    paths = sorted(Path(p) for p in glob.glob(SNAPSHOT_GLOB))
    if not paths:
        print(f"no snapshot files matched: {SNAPSHOT_GLOB}")
        return 1

    failures = []
    for path in paths:
        if path.name.startswith(TEMPLATE_PREFIX):
            error = verify_template(path, keep_dir=args.keep)
        else:
            error = verify(path, keep_dir=args.keep)
        print(f"{path}: {'ok' if error is None else f'FAILED: {error}'}")
        if error is not None:
            failures.append(path)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
