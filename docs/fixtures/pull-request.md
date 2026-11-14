# FIXT-001: Add licensed BookSkill Test Primer fixtures

Branch: `feat/FIXT-001`  
Base: local `main` (do not merge in this ticket)  
Author role: product  
Remote: none; do not push as part of FIXT-001

## Summary

Add an original, CC0-1.0 licensed test read — *BookSkill Test Primer* — in
Markdown, TXT, text-based PDF, and EPUB, plus a manifest, a regenerator,
and a verifier. The primer has two chapters and locatable paragraph IDs so
later import work and VERT-001 can test source citations (principle
sentence in `[P1.3]`, deliberate counterexample in `[P2.2]`).

This is project-original test data, not a real book, and not a substitute
for a user's library. No third-party work was copied into the repository.

## Test plan

From the repository root (or this worktree):

```bash
python3 docs/fixtures/verify_fixt001.py
```

Expected: exit code 0, and SHA-256 values printed for the four content
files match `fixtures/manifest.json`.

Optional regeneration:

```bash
python3 docs/fixtures/build_fixt001.py
python3 docs/fixtures/verify_fixt001.py
```

The verifier must exit non-zero when a required file is missing, a digest
does not match the manifest, or fixture body text contains a known
third-party book title. Those three failure paths were exercised locally
on 2026-11-13 (Asia/Shanghai) and restored before commit.

## Files

- `fixtures/bookskill-test-primer.md`
- `fixtures/bookskill-test-primer.txt`
- `fixtures/bookskill-test-primer.pdf`
- `fixtures/bookskill-test-primer.epub`
- `fixtures/LICENSE.md`
- `fixtures/manifest.json`
- `docs/fixtures/build_fixt001.py`
- `docs/fixtures/verify_fixt001.py`
- `docs/fixtures/FIXT-001-REPORT.md`
- `docs/fixtures/pull-request.md`
- `docs/tickets/FIXT-001.md` (status field only)

## Review notes

- Confirm the PDF is text-extractable (`pdftotext -layout fixtures/bookskill-test-primer.pdf -`).
- Confirm the EPUB is a zip whose first member is uncompressed `mimetype`.
- Confirm `fixtures/LICENSE.md` is CC0-1.0 and does not present the primer as a third-party book.
- Do not push and do not merge to `main` from this ticket.
