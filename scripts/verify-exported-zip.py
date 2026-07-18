#!/usr/bin/env python3
"""E2E が保存した ReportLab 書き出し zip を展開し、report.py を実行して PDF を検証する。

使い方: python scripts/verify-exported-zip.py <zip のパス>
検査: エントリが report.py + フォントの2つ / report.py の実行成功 /
生成 PDF のページ数 == ソース中の PAGE_COUNT。失敗時は非 0 終了。
"""

import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from pypdf import PdfReader

CODE_FILE = "report.py"
PAGE_COUNT_RE = re.compile(r"^PAGE_COUNT = (\d+)$", re.MULTILINE)
FONT_FILE_RE = re.compile(r'^FONT_FILE = "(.+)"$', re.MULTILINE)


def verify(zip_path):
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        with zipfile.ZipFile(zip_path) as archive:
            names = archive.namelist()
            archive.extractall(tmp)

        if CODE_FILE not in names:
            return f"{CODE_FILE} not found in zip: {names}"
        source = (tmp / CODE_FILE).read_text(encoding="utf-8")

        match = PAGE_COUNT_RE.search(source)
        if match is None:
            return "PAGE_COUNT constant not found"
        expected_pages = int(match.group(1))

        font_match = FONT_FILE_RE.search(source)
        if font_match is None:
            return "FONT_FILE constant not found"
        if sorted(names) != sorted([CODE_FILE, font_match.group(1)]):
            return f"unexpected zip entries: {names}"

        out_pdf = tmp / "out.pdf"
        result = subprocess.run(
            [sys.executable, str(tmp / CODE_FILE), str(out_pdf)],
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
    return None


def main():
    if len(sys.argv) != 2:
        print("usage: verify-exported-zip.py <path-to-zip>")
        return 2
    zip_path = Path(sys.argv[1])
    if not zip_path.is_file():
        print(f"zip not found: {zip_path}")
        return 1
    error = verify(zip_path)
    if error is not None:
        print(f"NG {zip_path}: {error}")
        return 1
    print(f"OK {zip_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
