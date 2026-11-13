#!/usr/bin/env python3
"""GOV-001 delivery verifier.

Exit 0 only when required artifacts exist, an upstream commit hash is recorded,
and the reports do not assert that public distribution has been approved.

This script does not itself approve any legal conclusion.
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

REQUIRED_FILES = [
    "docs/UPSTREAM-LICENSES.md",
    "docs/licenses/upstream-checkout.md",
    "docs/licenses/component-inventory.csv",
    "docs/licenses/npm-dependencies.csv",
    "docs/licenses/npm-dependencies-unique.csv",
    "docs/licenses/media-and-branding.csv",
    "docs/licenses/legal-questions.md",
    "docs/licenses/verify_gov001.py",
    "docs/gov/GOV-001-REPORT.md",
    "docs/gov/pull-request.md",
]

# Files in which an affirmative "approved for public release" conclusion is forbidden.
REPORT_FILES = [
    "docs/UPSTREAM-LICENSES.md",
    "docs/licenses/legal-questions.md",
    "docs/licenses/upstream-checkout.md",
    "docs/gov/GOV-001-REPORT.md",
    "docs/gov/pull-request.md",
]

COMMIT_RE = re.compile(r"\b[0-9a-f]{40}\b")

# Affirmative conclusions that must fail the check.
# Negated wording such as "must not announce legal approval" is allowed.
FORBIDDEN_LINE_PATTERNS = [
    re.compile(r"所有发行事项已批准"),
    re.compile(r"已批准公开发行"),
    re.compile(r"批准公开发行"),
    re.compile(r"法律(审查)?(已|已经)?(批准|通过)"),
    re.compile(r"可公开发行"),
    re.compile(r"可以公开发行"),
    re.compile(r"approved for public (release|distribution)", re.I),
    re.compile(r"cleared for public (release|distribution)", re.I),
    re.compile(r"all (licensing|distribution|issuance) matters (are|have been) approved", re.I),
    re.compile(r"public distribution is (approved|authorized|cleared)", re.I),
]

NEGATION_RE = re.compile(
    r"(不得|禁止|不可|不应|不能|未|没有|不是|勿|严禁|不要|must not|mustn’t|cannot|not |no |never |without )",
    re.I,
)

CSV_REQUIRED_COLUMNS = {
    "docs/licenses/component-inventory.csv": (
        "name",
        "version_or_commit",
        "license_id",
        "source_url",
    ),
    "docs/licenses/npm-dependencies-unique.csv": (
        "name",
        "version_or_commit",
        "license_id",
        "source_url",
    ),
    "docs/licenses/media-and-branding.csv": (
        "path",
        "category",
        "license_id",
    ),
}


def repo_root() -> Path:
    here = Path(__file__).resolve()
    # docs/licenses/verify_gov001.py -> repo root
    return here.parents[2]


def fail(errors: list[str], msg: str) -> None:
    errors.append(msg)


def read_csv_rows(path: Path) -> list[dict]:
    lines = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            lines.append(line)
    import io

    return list(csv.DictReader(io.StringIO("".join(lines))))


def line_is_forbidden(line: str) -> bool:
    text = line.strip()
    if not text or text.startswith("#") and "已批准公开发行" not in text and "approved for public" not in text.lower():
        # still test heading/body lines below
        pass
    for pat in FORBIDDEN_LINE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        # Allow a negation in the same clause before the match.
        prefix = text[: m.start()]
        if NEGATION_RE.search(prefix) or NEGATION_RE.search(text):
            # If the only negation is far after the claim, still fail.
            # Conservative: if any negation exists on the line, treat as discussion/prohibition,
            # unless the line clearly asserts approval first without negation before it.
            if NEGATION_RE.search(prefix):
                continue
            # negation only after the phrase, e.g. "可公开发行，不得..." still fails
            return True
        return True
    return False


def main() -> int:
    root = repo_root()
    errors: list[str] = []

    if not (root / "docs").is_dir():
        fail(errors, f"docs/ not found under expected repo root: {root}")

    for rel in REQUIRED_FILES:
        path = root / rel
        if not path.is_file():
            fail(errors, f"missing required file: {rel}")
            continue
        if path.stat().st_size == 0:
            fail(errors, f"required file is empty: {rel}")

    hash_sources = [
        root / "docs/UPSTREAM-LICENSES.md",
        root / "docs/licenses/upstream-checkout.md",
    ]
    found_hashes: set[str] = set()
    for path in hash_sources:
        if path.is_file():
            found_hashes.update(COMMIT_RE.findall(path.read_text(encoding="utf-8", errors="replace")))
    if not found_hashes:
        fail(
            errors,
            "no 40-character upstream commit hash recorded in docs/UPSTREAM-LICENSES.md or docs/licenses/upstream-checkout.md",
        )

    for rel, cols in CSV_REQUIRED_COLUMNS.items():
        path = root / rel
        if not path.is_file():
            continue
        try:
            rows = read_csv_rows(path)
        except Exception as exc:  # noqa: BLE001
            fail(errors, f"cannot parse CSV {rel}: {exc}")
            continue
        if not rows:
            fail(errors, f"CSV has no data rows: {rel}")
            continue
        missing = [c for c in cols if c not in rows[0]]
        if missing:
            fail(errors, f"CSV {rel} missing columns: {', '.join(missing)}")
            continue
        for i, row in enumerate(rows, start=2):
            for col in cols:
                if not (row.get(col) or "").strip():
                    fail(errors, f"CSV {rel} row {i} has empty {col}")
                    break

    # Inventory must not invent a blanket approval via license_id either.
    inv = root / "docs/licenses/component-inventory.csv"
    if inv.is_file():
        try:
            for row in read_csv_rows(inv):
                for field in row.values():
                    if field and line_is_forbidden(field):
                        fail(errors, f"component-inventory.csv contains a public-release approval claim: {field!r}")
        except Exception as exc:  # noqa: BLE001
            fail(errors, f"cannot scan component-inventory.csv: {exc}")

    for rel in REPORT_FILES:
        path = root / rel
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if line_is_forbidden(line):
                fail(errors, f"{rel}:{lineno} contains a public-release approval claim: {line.strip()!r}")

    if errors:
        print("GOV-001 verify FAILED")
        for e in errors:
            print(f"- {e}")
        print(f"error_count={len(errors)}")
        return 1

    print("GOV-001 verify passed")
    print(f"repo_root={root}")
    print(f"upstream_commit_hashes_found={sorted(found_hashes)}")
    print("required_files=ok")
    print("no_public_release_approval_claim=ok")
    print("note=passing this script is not a legal approval and does not authorize public release")
    return 0


if __name__ == "__main__":
    sys.exit(main())
