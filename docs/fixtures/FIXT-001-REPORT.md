# FIXT-001 Report: Licensed Test Fixtures

- Ticket: `docs/tickets/FIXT-001.md`
- Role: product
- Branch: `feat/FIXT-001`
- Worktree: `/workspace/bookskill-worktrees/FIXT-001`
- Date: 2026-11-13 17:17 (Asia/Shanghai)
- Status: complete, locally verified; not pushed, not merged to `main`

## What was delivered

An original two-chapter test read, *BookSkill Test Primer*, was written for
this project and exported in four formats. The text is licensed test data,
not a real book, and it does not copy or adapt any third-party work.

The primer is built so later import and VERT-001 citation tests can point at
stable, locatable passages:

- Principle sentence, paragraph `[P1.3]`: "A knowledge card is valid only when every claim cites a paragraph identifier from the source document."
- Counterexample sentence, paragraph `[P2.2]`: "Cedar trees sing at noon in every harbor."
- Chapter 1 also records a second locatable rule in `[P1.5]` (cite both sides of a disagreement).
- Chapter 2 records a refusal rule in `[P2.4]` (do not save a card whose only support is a hollow echo).

## Deliverable paths

| Path | Role |
| --- | --- |
| `fixtures/bookskill-test-primer.md` | Canonical Markdown (2 chapters, paragraph IDs) |
| `fixtures/bookskill-test-primer.txt` | Plain-text export of the same text |
| `fixtures/bookskill-test-primer.pdf` | Text-based PDF generated in pure Python |
| `fixtures/bookskill-test-primer.epub` | EPUB 3 zip+XML/HTML generated in pure Python |
| `fixtures/LICENSE.md` | CC0-1.0 dedication; states the files are original test data |
| `fixtures/manifest.json` | Filename, format, SHA-256, chapter count |
| `docs/fixtures/build_fixt001.py` | Regenerator for the four formats, license, and manifest |
| `docs/fixtures/verify_fixt001.py` | Required verification script |
| `docs/fixtures/FIXT-001-REPORT.md` | This report |
| `docs/fixtures/pull-request.md` | Local pull-request description |

Regenerate with:

```bash
python3 docs/fixtures/build_fixt001.py
python3 docs/fixtures/verify_fixt001.py
```

## SHA-256

Digests below were produced by `sha256sum` on 2026-11-13 17:17 (Asia/Shanghai)
and match `fixtures/manifest.json`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `fixtures/bookskill-test-primer.md` | 2028 | `f5c32795caeda618ade8b8c0c7b2732c19fb96ca60a76bf20452a1dcec978d85` |
| `fixtures/bookskill-test-primer.txt` | 2123 | `4099d1c78a881369612efb13473e23e1fd440da2bf02f7f039cba8943b647371` |
| `fixtures/bookskill-test-primer.pdf` | 3579 | `114316270ae249b5da515439066cfdb81f514bb238c677610eaf78f7b95d3fd6` |
| `fixtures/bookskill-test-primer.epub` | 3444 | `c475ac89205ea3ee0ec707dd146dac604990e426f83f867fab8568286721e622` |
| `fixtures/LICENSE.md` | 3894 | `b1c9a691331221e84cc38d4e735e66687972e69891e28846e39de05bd8852c45` |
| `fixtures/manifest.json` | 1448 | `c58bfb761b220607e8b9da527ec83114a270eef443f28e266fec25b71584bd64` |

`manifest.json` records SHA-256 for the four content files and for
`LICENSE.md`. It does not hash itself.

## Verification evidence

Command (from the worktree root):

```bash
python3 docs/fixtures/verify_fixt001.py
```

Successful run, exit code **0**:

```
FIXT-001 verification passed.
Root: /workspace/bookskill-worktrees/FIXT-001/fixtures
Title: BookSkill Test Primer
License: CC0-1.0
Chapters: 2
  bookskill-test-primer.md: sha256=f5c32795caeda618ade8b8c0c7b2732c19fb96ca60a76bf20452a1dcec978d85 chapters=2
  bookskill-test-primer.txt: sha256=4099d1c78a881369612efb13473e23e1fd440da2bf02f7f039cba8943b647371 chapters=2
  bookskill-test-primer.pdf: sha256=114316270ae249b5da515439066cfdb81f514bb238c677610eaf78f7b95d3fd6 chapters=2
  bookskill-test-primer.epub: sha256=c475ac89205ea3ee0ec707dd146dac604990e426f83f867fab8568286721e622 chapters=2
```

Negative checks, each restored immediately afterward, exit code **1**:

| Case | Exit | Observed failure |
| --- | ---: | --- |
| Missing `fixtures/bookskill-test-primer.txt` | 1 | `FAIL: missing fixtures/bookskill-test-primer.txt` |
| Manifest SHA-256 for the Markdown file set to `0`*64 | 1 | `FAIL: SHA-256 mismatch for bookskill-test-primer.md: got f5c32795…, manifest has 0000…` |
| Markdown body appended with a forbidden third-party title, hash updated to match | 1 | `FAIL: markdown body contains forbidden third-party title: '论语'` |

The verifier also requires both chapter headings, paragraph IDs `[P1.3]` and
`[P2.2]`, the principle sentence, and the counterexample sentence to appear
in all four formats. PDF text was read with `pdftotext -layout` (poppler-utils
is present on this machine). EPUB text was read by unpacking the zip and
stripping XHTML tags. The EPUB `mimetype` member is first and stored
uncompressed (`ZIP_STORED`).

After the negative checks, the fixtures were restored and the verifier was
run again with exit code 0.

## Originality and license

The primer was drafted for this ticket. It is a short fictional workshop
scene used only as import and citation test data. No third-party book was
copied into the worktree. `fixtures/LICENSE.md` places the fixture files
under CC0-1.0 and states that they are not a substitute for a reader's
library.

The verifier rejects known third-party titles if they appear in fixture
body text or in `LICENSE.md`. Those titles are therefore not named in the
fixture files themselves.

## Scope and limits

- Only `fixtures/**`, `docs/fixtures/**`, and the status field of
  `docs/tickets/FIXT-001.md` were changed.
- No GOV/REPO/BOT directories, other tickets, or governance files were
  edited.
- This branch was not pushed and was not merged to `main`.
- No secrets were read.
- These fixtures are test data only. They do not stand in for a user's
  real books.
