#!/usr/bin/env python3
"""Extracts a ReportLab export zip saved by e2e, runs report.py, and verifies the PDF.

Usage: python scripts/verify-exported-zip.py <path-to-zip>
Checks: entries are report.py + all fonts from FONTS (OFL.txt is optional) / report.py
runs successfully / generated PDF page count == PAGE_COUNT in the source. Exits non-zero
on failure.
"""

import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from pypdf import PdfReader

CODE_FILE = "report.py"
OFL_FILE = "OFL.txt"
PAGE_COUNT_RE = re.compile(r"^PAGE_COUNT = (\d+)$", re.MULTILINE)
FONT_ENTRY_RE = re.compile(r'^    "[^"]+": \("([^"]+)", [-\d.eE+]+\),$', re.MULTILINE)


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

        font_files = FONT_ENTRY_RE.findall(source)
        if not font_files:
            return "FONTS constant not found"
        # OFL.txt is attached only when bundled fonts are used, so allow it either way.
        expected = sorted([CODE_FILE, *font_files])
        actual = sorted(n for n in names if n != OFL_FILE)
        if actual != expected:
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
