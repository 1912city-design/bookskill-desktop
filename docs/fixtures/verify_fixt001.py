#!/usr/bin/env python3
"""Verify FIXT-001 licensed test fixtures.

Exits non-zero when a required file is missing, a SHA-256 digest does not
match fixtures/manifest.json, a format cannot be read as text, the primer
has fewer than two chapters, or fixture body text contains a known
third-party book title.
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures"
MANIFEST_PATH = FIXTURES / "manifest.json"

REQUIRED_CONTENT = (
    ("bookskill-test-primer.md", "markdown"),
    ("bookskill-test-primer.txt", "txt"),
    ("bookskill-test-primer.pdf", "pdf"),
    ("bookskill-test-primer.epub", "epub"),
)
REQUIRED_SIDE_FILES = ("LICENSE.md", "manifest.json")

FORBIDDEN_TITLES = (
    "孙子兵法",
    "孫子兵法",
    "道德经",
    "道德經",
    "论语",
    "論語",
    "Sun Tzu",
    "The Art of War",
    "Tao Te Ching",
    "Dao De Jing",
    "The Analects",
)

PRINCIPLE = (
    "A knowledge card is valid only when every claim cites a "
    "paragraph identifier from the source document."
)
COUNTEREXAMPLE = "Cedar trees sing at noon in every harbor."
MIN_CHAPTERS = 2

CHAPTER_RE = re.compile(r"Chapter\s+(\d+)\.", re.IGNORECASE)


class Failure(Exception):
    """Verification failure with a user-visible message."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_pdf_text(path: Path) -> str:
    pdftotext = shutil_which("pdftotext")
    if pdftotext:
        result = subprocess.run(
            [pdftotext, "-layout", str(path), "-"],
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            err = result.stderr.decode("utf-8", "replace").strip()
            raise Failure(f"pdftotext failed on {path.name}: {err or result.returncode}")
        return result.stdout.decode("utf-8", "replace")
    return extract_pdf_literals(path)


def shutil_which(name: str) -> str | None:
    from shutil import which

    return which(name)


def extract_pdf_literals(path: Path) -> str:
    data = path.read_bytes()
    if b"%PDF-" not in data[:16]:
        raise Failure(f"{path.name} is not a PDF")
    # Minimal fallback: recover literal strings from Tj/TJ operators.
    pieces: list[str] = []
    for match in re.finditer(rb"\((?:\\.|[^\\)])*\)\s*Tj", data):
        raw = match.group(0)
        literal = raw[1 : raw.rfind(b")")]
        text = (
            literal.replace(b"\\(", b"(")
            .replace(b"\\)", b")")
            .replace(b"\\\\", b"\\")
            .decode("latin-1")
        )
        pieces.append(text)
    if not pieces:
        raise Failure(f"could not read text from {path.name}")
    return "\n".join(pieces)


def extract_epub_text(path: Path) -> str:
    try:
        with zipfile.ZipFile(path) as zf:
            names = zf.namelist()
            if "mimetype" not in names:
                raise Failure(f"{path.name} is missing the mimetype member")
            mime = zf.read("mimetype").decode("ascii", "replace")
            if mime != "application/epub+zip":
                raise Failure(f"{path.name} has unexpected mimetype: {mime!r}")
            chunks: list[str] = []
            for name in names:
                if name.endswith((".xhtml", ".html", ".htm", ".xml")):
                    xml = zf.read(name).decode("utf-8")
                    chunks.append(strip_tags(xml))
            if not chunks:
                raise Failure(f"{path.name} contains no HTML/XML documents")
            return "\n".join(chunks)
    except zipfile.BadZipFile as exc:
        raise Failure(f"{path.name} is not a valid EPUB zip: {exc}") from exc


def strip_tags(xml: str) -> str:
    text = re.sub(r"<!\[CDATA\[(.*?)\]\]>", r"\1", xml, flags=re.S)
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = (
        text.replace("&quot;", '"')
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
    )
    return re.sub(r"\s+", " ", text)


def count_chapters(text: str) -> int:
    return len({int(match.group(1)) for match in CHAPTER_RE.finditer(text)})


def normalize_ws(text: str) -> str:
    return re.sub(r"\s+", " ", text)


def check_forbidden(label: str, text: str) -> list[str]:
    errors: list[str] = []
    for title in FORBIDDEN_TITLES:
        if title in text:
            errors.append(f"{label} contains forbidden third-party title: {title!r}")
    return errors


def load_manifest() -> dict:
    if not MANIFEST_PATH.is_file():
        raise Failure("missing fixtures/manifest.json")
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise Failure(f"fixtures/manifest.json is not valid JSON: {exc}") from exc


def file_entries(manifest: dict) -> list[dict]:
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise Failure("manifest.json is missing a non-empty files array")
    return files


def verify() -> int:
    errors: list[str] = []

    for name in REQUIRED_SIDE_FILES:
        if not (FIXTURES / name).is_file():
            errors.append(f"missing fixtures/{name}")
    for name, _fmt in REQUIRED_CONTENT:
        if not (FIXTURES / name).is_file():
            errors.append(f"missing fixtures/{name}")
    if errors:
        for item in errors:
            print(f"FAIL: {item}", file=sys.stderr)
        return 1

    try:
        manifest = load_manifest()
    except Failure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    try:
        entries = file_entries(manifest)
    except Failure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    by_name = {}
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("manifest files entry is not an object")
            continue
        for key in ("filename", "format", "sha256", "chapter_count"):
            if key not in entry:
                errors.append(f"manifest entry missing {key}: {entry!r}")
        name = entry.get("filename")
        if isinstance(name, str):
            by_name[name] = entry

    for name, fmt in REQUIRED_CONTENT:
        if name not in by_name:
            errors.append(f"manifest.json does not list {name}")
            continue
        entry = by_name[name]
        path = FIXTURES / name
        digest = sha256_file(path)
        expected = str(entry.get("sha256", "")).lower()
        if digest != expected:
            errors.append(
                f"SHA-256 mismatch for {name}: got {digest}, manifest has {expected}"
            )
        if str(entry.get("format", "")).lower() != fmt:
            errors.append(
                f"format mismatch for {name}: got {entry.get('format')!r}, expected {fmt!r}"
            )
        try:
            chapter_count = int(entry.get("chapter_count"))
        except (TypeError, ValueError):
            errors.append(f"chapter_count for {name} is not an integer")
            chapter_count = 0
        if chapter_count < MIN_CHAPTERS:
            errors.append(
                f"chapter_count for {name} is {chapter_count}, expected >= {MIN_CHAPTERS}"
            )

    license_path = FIXTURES / "LICENSE.md"
    license_meta = manifest.get("license_file")
    if isinstance(license_meta, dict) and license_meta.get("sha256"):
        digest = sha256_file(license_path)
        expected = str(license_meta["sha256"]).lower()
        if digest != expected:
            errors.append(
                f"SHA-256 mismatch for LICENSE.md: got {digest}, manifest has {expected}"
            )

    license_text = license_path.read_text(encoding="utf-8")
    if "CC0-1.0" not in license_text and "CC0 1.0" not in license_text:
        errors.append("fixtures/LICENSE.md does not declare CC0-1.0")
    errors.extend(check_forbidden("fixtures/LICENSE.md", license_text))

    texts: dict[str, str] = {}
    try:
        texts["markdown"] = (FIXTURES / "bookskill-test-primer.md").read_text(
            encoding="utf-8"
        )
        texts["txt"] = (FIXTURES / "bookskill-test-primer.txt").read_text(
            encoding="utf-8"
        )
        texts["pdf"] = extract_pdf_text(FIXTURES / "bookskill-test-primer.pdf")
        texts["epub"] = extract_epub_text(FIXTURES / "bookskill-test-primer.epub")
    except Failure as exc:
        errors.append(str(exc))

    for label, text in texts.items():
        errors.extend(check_forbidden(f"{label} body", text))
        normalized = normalize_ws(text)
        if PRINCIPLE not in normalized:
            errors.append(f"{label} body is missing the principle sentence")
        if COUNTEREXAMPLE not in normalized:
            errors.append(f"{label} body is missing the counterexample sentence")
        if "[P1.3]" not in text or "[P2.2]" not in text:
            errors.append(f"{label} body is missing locatable paragraph identifiers")
        found = count_chapters(text)
        if found < MIN_CHAPTERS:
            errors.append(
                f"{label} body has {found} numbered chapter heading(s), expected >= {MIN_CHAPTERS}"
            )

    top_count = manifest.get("chapter_count")
    try:
        if int(top_count) < MIN_CHAPTERS:
            errors.append(
                f"manifest chapter_count is {top_count}, expected >= {MIN_CHAPTERS}"
            )
    except (TypeError, ValueError):
        errors.append("manifest chapter_count is missing or not an integer")

    if errors:
        for item in errors:
            print(f"FAIL: {item}", file=sys.stderr)
        print(f"{len(errors)} check(s) failed.", file=sys.stderr)
        return 1

    print("FIXT-001 verification passed.")
    print(f"Root: {FIXTURES}")
    print(f"Title: {manifest.get('title')}")
    print(f"License: {manifest.get('license')}")
    print(f"Chapters: {manifest.get('chapter_count')}")
    for name, _fmt in REQUIRED_CONTENT:
        entry = by_name[name]
        print(f"  {name}: sha256={entry['sha256']} chapters={entry['chapter_count']}")
    return 0


def main() -> int:
    try:
        return verify()
    except Failure as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
