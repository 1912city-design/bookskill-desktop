#!/usr/bin/env python3
"""Build original BookSkill Test Primer fixtures (Markdown, TXT, PDF, EPUB).

This script emits only project-original test data. It does not copy or
adapt any third-party book. Regenerates fixtures/ and fixtures/manifest.json.
"""

from __future__ import annotations

import hashlib
import io
import json
import textwrap
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures"

TITLE = "BookSkill Test Primer"
AUTHOR = "BookSkill Desktop Project"
LANGUAGE = "en"
CHAPTER_COUNT = 2
LICENSE_ID = "CC0-1.0"
UUID = "urn:uuid:7c3e9d21-6a84-5b12-9f0e-2d18c4a6b5e0"
MODIFIED = "2026-11-13T09:20:00Z"

INTRO = (
    "A short original work created solely as licensed test data for the "
    "BookSkill Desktop project. It is not a real book, and it must not be "
    "treated as a substitute for a reader's own library."
)

CHAPTERS = [
    {
        "number": 1,
        "title": "The Lantern Index Principle",
        "paragraphs": [
            (
                "P1.1",
                "The workshop in Harbor Lane kept a lantern index: every claim "
                "written on a card had to name the shelf, the page, and the "
                "paragraph from which it came.",
            ),
            (
                "P1.2",
                "The governing principle of this primer is stated here in full:",
            ),
            (
                "P1.3",
                "A knowledge card is valid only when every claim cites a "
                "paragraph identifier from the source document.",
            ),
            (
                "P1.4",
                "Readers may locate that principle in Chapter 1, in the "
                "paragraph that begins \"A knowledge card is valid only\". "
                "Downstream citation tests should resolve a highlight of that "
                "sentence to this chapter and paragraph, not to a neighboring line.",
            ),
            (
                "P1.5",
                "The lantern keepers also recorded a second locatable rule: If "
                "two passages disagree, the card must cite both passages and "
                "must not silently prefer one.",
            ),
            (
                "P1.6",
                "This chapter does not discuss any third-party book. It exists "
                "only to give BookSkill a stable, licensed passage to point at.",
            ),
        ],
    },
    {
        "number": 2,
        "title": "The Hollow Echo Counterexample",
        "paragraphs": [
            (
                "P2.1",
                "On the opposite wall the keepers hung a counterexample, so that "
                "importers could practice rejection as well as citation.",
            ),
            (
                "P2.2",
                "The hollow echo is this unsupported sentence: Cedar trees sing "
                "at noon in every harbor. That sentence is a deliberate "
                "counterexample. It is not supported by any other passage in "
                "this primer, and it must not be promoted into a knowledge card "
                "as if it were a cited fact.",
            ),
            (
                "P2.3",
                "A correct system behavior is as follows: when a reader asks for "
                "a source for \"cedar trees sing at noon,\" the product may "
                "point to this counterexample paragraph in Chapter 2, and must "
                "label the claim as unsourced or contradicted, not as an "
                "extracted principle.",
            ),
            (
                "P2.4",
                "The keepers closed the primer with a locatable refusal rule: "
                "No card may be saved when its only support is a hollow echo.",
            ),
            (
                "P2.5",
                "End of the BookSkill Test Primer.",
            ),
        ],
    },
]

LICENSE_MD = """# License for BookSkill Desktop test fixtures

The files in this `fixtures/` directory, including *BookSkill Test Primer*
in Markdown, plain text, PDF, and EPUB forms, are original works created
for the BookSkill Desktop project as licensed test data.

They are not third-party books. They are not a substitute for a reader's
own library. They do not contain, reproduce, or adapt any unauthorized
complete work.

## SPDX identifier

SPDX-License-Identifier: CC0-1.0

## CC0 1.0 Universal

To the extent possible under law, the BookSkill Desktop project has waived
all copyright and related or neighboring rights to these fixture files.

You should have received a copy of the CC0 1.0 Public Domain Dedication
along with this work. The deed and legal code are published at:

https://creativecommons.org/publicdomain/zero/1.0/

### Statement of Purpose

The laws of most jurisdictions throughout the world automatically confer
exclusive Copyright and Related Rights (defined below) upon the creator
and subsequent owner(s) (each and all, an "owner") of an original work of
authorship and/or a database (each, a "Work").

Certain owners wish to permanently relinquish those rights to a Work for
the purpose of contributing to a commons of creative, cultural and
scientific works ("Commons") that the public can reliably and without fear
of later claims of infringement build upon, modify, incorporate in other
works, reuse and redistribute as freely as possible in any form whatsoever
and for any purposes, including without limitation commercial purposes.

For these purposes, the BookSkill Desktop project distributes the fixture
files in this directory under CC0 1.0 Universal.

### Copyright and Related Rights

A Work made available under CC0 may be protected by copyright and related
or neighboring rights. To the greatest extent permitted by, but not in
contravention of, applicable law, the project hereby voluntarily elects to
apply CC0 1.0 to these fixture files and publicly distribute them.

### Waiver

To the greatest extent permitted by, but not in contravention of,
applicable law, the project hereby overtly, fully, permanently,
irrevocably and unconditionally waives, abandons, and surrenders all of
its Copyright and Related Rights and associated claims and causes of
action, whether now known or unknown (including existing as well as
future claims and causes of action), in these fixture files (i) in all
territories worldwide, (ii) for the maximum duration provided by
applicable law or treaty (including future time extensions), (iii) in any
current or future medium and for any number of copies, and (iv) for any
purpose whatsoever, including without limitation commercial, advertising
or promotional purposes (the "Waiver").

### Public License Fallback

Should any part of the Waiver for any reason be judged legally invalid or
ineffective under applicable law, the Waiver shall be preserved to the
maximum extent permitted. If a part of the Waiver is judged invalid, the
project grants each affected person a royalty-free, non transferable, non
sublicensable, non exclusive, irrevocable and unconditional license to
exercise the Copyright and Related Rights in the fixture files, subject
to the same territorial, duration, medium, and purpose terms as the
Waiver. This fallback license is deemed effective as of the date CC0 was
applied to these files.

### Limitations and Disclaimers

- These fixtures are test data for BookSkill Desktop. They make no claim
  to represent a published trade book or a user's private library.
- CC0 does not trademark the BookSkill name. Downstream use of product
  names, logos, or marks remains subject to applicable trademark law.
- The fixtures are provided "AS IS", without warranties of any kind,
  including title, merchantability, fitness for a particular purpose,
  non-infringement, or the absence of latent or other defects.
"""


def chapter_heading(chapter: dict) -> str:
    return f"Chapter {chapter['number']}. {chapter['title']}"


def format_paragraph(pid: str, text: str) -> str:
    return f"[{pid}] {text}"


def render_markdown() -> str:
    lines = [f"# {TITLE}", "", INTRO, ""]
    for chapter in CHAPTERS:
        lines.append(f"## {chapter_heading(chapter)}")
        lines.append("")
        for pid, text in chapter["paragraphs"]:
            lines.append(format_paragraph(pid, text))
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_txt() -> str:
    underline_title = "=" * len(TITLE)
    lines = [TITLE, underline_title, "", INTRO, ""]
    for chapter in CHAPTERS:
        heading = chapter_heading(chapter)
        lines.append(heading)
        lines.append("-" * len(heading))
        lines.append("")
        for pid, text in chapter["paragraphs"]:
            lines.append(format_paragraph(pid, text))
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def pdf_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def wrap_text(text: str, width: int = 82) -> list[str]:
    if not text:
        return [""]
    return textwrap.wrap(
        text,
        width=width,
        break_long_words=False,
        break_on_hyphens=False,
    ) or [""]


def build_pdf_pages() -> list[list[tuple[int, str]]]:
    """Return pages of (font_size, line_text) pairs."""
    blocks: list[tuple[int, str]] = []
    blocks.append((18, TITLE))
    blocks.append((11, ""))
    for line in wrap_text(INTRO, 82):
        blocks.append((11, line))
    blocks.append((11, ""))

    for chapter in CHAPTERS:
        blocks.append((14, chapter_heading(chapter)))
        blocks.append((11, ""))
        for pid, text in chapter["paragraphs"]:
            wrapped = wrap_text(format_paragraph(pid, text), 82)
            for line in wrapped:
                blocks.append((11, line))
            blocks.append((11, ""))

    # Paginate by estimated vertical space on US Letter with 72pt margins.
    page_top = 720
    page_bottom = 72
    y = page_top
    pages: list[list[tuple[int, str]]] = [[]]
    for size, line in blocks:
        leading = size + 6 if line else 8
        if y - leading < page_bottom:
            pages.append([])
            y = page_top
        pages[-1].append((size, line))
        y -= leading
    return pages


def render_pdf() -> bytes:
    pages = build_pdf_pages()
    objects: dict[int, bytes] = {}

    # Object allocation:
    # 1 Catalog, 2 Pages, 3 Font, then per page: page dict + contents
    font_id = 3
    objects[font_id] = (
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    )

    page_ids: list[int] = []
    next_id = 4
    for page_lines in pages:
        page_id = next_id
        contents_id = next_id + 1
        next_id += 2
        page_ids.append(page_id)

        stream_lines = [
            "BT",
            "/F1 11 Tf",
            "14 TL",
            "72 720 Td",
        ]
        current_size = 11
        first = True
        for size, text in page_lines:
            if first:
                if size != current_size:
                    stream_lines.append(f"/F1 {size} Tf")
                    current_size = size
                stream_lines.append(f"({pdf_escape(text)}) Tj")
                first = False
                continue
            leading = size + 6 if text else 8
            if size != current_size:
                stream_lines.append(f"/F1 {size} Tf")
                current_size = size
            stream_lines.append(f"0 -{leading} Td")
            if text:
                stream_lines.append(f"({pdf_escape(text)}) Tj")
        stream_lines.append("ET")
        stream = ("\n".join(stream_lines) + "\n").encode("ascii")
        objects[contents_id] = (
            f"<< /Length {len(stream)} >>\nstream\n".encode("ascii")
            + stream
            + b"endstream"
        )
        objects[page_id] = (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 3 0 R >> >> "
            + f"/Contents {contents_id} 0 R >>".encode("ascii")
        )

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    objects[2] = (
        f"<< /Type /Pages /Kids [ {kids} ] /Count {len(page_ids)} >>".encode(
            "ascii"
        )
    )
    objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"

    # Assemble with a binary marker so consumers treat the file as binary PDF.
    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    chunks: list[bytes] = [header]
    offsets = {0: 0}
    position = len(header)
    max_id = max(objects)
    for obj_id in range(1, max_id + 1):
        body = objects[obj_id]
        chunk = f"{obj_id} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
        offsets[obj_id] = position
        chunks.append(chunk)
        position += len(chunk)

    xref_start = position
    xref_lines = ["xref", f"0 {max_id + 1}", "0000000000 65535 f "]
    for obj_id in range(1, max_id + 1):
        xref_lines.append(f"{offsets[obj_id]:010d} 00000 n ")
    xref = ("\n".join(xref_lines) + "\n").encode("ascii")
    trailer = (
        f"trailer\n<< /Size {max_id + 1} /Root 1 0 R "
        f"/Info << /Title ({pdf_escape(TITLE)}) "
        f"/Author ({pdf_escape(AUTHOR)}) /Creator ({pdf_escape(AUTHOR)}) >> >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("ascii")
    chunks.append(xref)
    chunks.append(trailer)
    return b"".join(chunks)


def xml_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def xhtml_document(title: str, body_inner: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!DOCTYPE html>\n"
        '<html xmlns="http://www.w3.org/1999/xhtml" '
        'xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">\n'
        "<head>\n"
        f"<title>{xml_escape(title)}</title>\n"
        '<link rel="stylesheet" type="text/css" href="style.css"/>\n'
        "</head>\n"
        "<body>\n"
        f"{body_inner}"
        "</body>\n"
        "</html>\n"
    )


def render_epub() -> bytes:
    container = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<container version="1.0" '
        'xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n'
        "  <rootfiles>\n"
        '    <rootfile full-path="EPUB/package.opf" '
        'media-type="application/oebps-package+xml"/>\n'
        "  </rootfiles>\n"
        "</container>\n"
    )
    nav_items = "\n".join(
        (
            f'      <li><a href="chapter-{ch["number"]}.xhtml">'
            f"{xml_escape(chapter_heading(ch))}</a></li>"
        )
        for ch in CHAPTERS
    )
    nav = xhtml_document(
        "Contents",
        "  <nav epub:type=\"toc\" id=\"toc\">\n"
        "    <h1>Contents</h1>\n"
        "    <ol>\n"
        f"{nav_items}\n"
        "    </ol>\n"
        "  </nav>\n",
    )
    chapter_files: dict[str, str] = {}
    manifest_items = [
        '    <item id="nav" href="nav.xhtml" '
        'media-type="application/xhtml+xml" properties="nav"/>',
        '    <item id="css" href="style.css" media-type="text/css"/>',
    ]
    spine_items = []
    for chapter in CHAPTERS:
        cid = f"ch{chapter['number']}"
        href = f"chapter-{chapter['number']}.xhtml"
        paragraphs = "\n".join(
            f'  <p id="{pid}">{xml_escape(format_paragraph(pid, text))}</p>'
            for pid, text in chapter["paragraphs"]
        )
        heading = chapter_heading(chapter)
        body = (
            f'  <h1 id="chapter-{chapter["number"]}">{xml_escape(heading)}</h1>\n'
        )
        if chapter["number"] == 1:
            body = f"  <p class=\"intro\">{xml_escape(INTRO)}</p>\n" + body
        body += paragraphs + "\n"
        chapter_files[href] = xhtml_document(heading, body)
        manifest_items.append(
            f'    <item id="{cid}" href="{href}" '
            'media-type="application/xhtml+xml"/>'
        )
        spine_items.append(f'    <itemref idref="{cid}"/>')

    package = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" '
        'unique-identifier="pub-id" xml:lang="en">\n'
        '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        f'    <dc:identifier id="pub-id">{UUID}</dc:identifier>\n'
        f"    <dc:title>{xml_escape(TITLE)}</dc:title>\n"
        f"    <dc:creator>{xml_escape(AUTHOR)}</dc:creator>\n"
        f"    <dc:language>{LANGUAGE}</dc:language>\n"
        f"    <dc:rights>{LICENSE_ID}</dc:rights>\n"
        "    <dc:description>"
        "Original licensed test data for BookSkill Desktop. Not a real book."
        "</dc:description>\n"
        f'    <meta property="dcterms:modified">{MODIFIED}</meta>\n'
        "  </metadata>\n"
        "  <manifest>\n"
        + "\n".join(manifest_items)
        + "\n  </manifest>\n"
        "  <spine>\n"
        + "\n".join(spine_items)
        + "\n  </spine>\n"
        "</package>\n"
    )
    css = (
        "body { font-family: serif; line-height: 1.45; margin: 1.2em; }\n"
        "h1 { font-size: 1.4em; }\n"
        "p.intro { font-style: italic; }\n"
        "p { margin: 0.75em 0; }\n"
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        info = zipfile.ZipInfo("mimetype")
        info.compress_type = zipfile.ZIP_STORED
        zf.writestr(info, "application/epub+zip")
        zf.writestr(
            "META-INF/container.xml",
            container,
            compress_type=zipfile.ZIP_DEFLATED,
        )
        zf.writestr("EPUB/package.opf", package, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("EPUB/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
        zf.writestr("EPUB/style.css", css, compress_type=zipfile.ZIP_DEFLATED)
        for href, content in chapter_files.items():
            zf.writestr(
                f"EPUB/{href}", content, compress_type=zipfile.ZIP_DEFLATED
            )
    return buffer.getvalue()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def main() -> int:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    artifacts = {
        "LICENSE.md": LICENSE_MD.encode("utf-8"),
        "bookskill-test-primer.md": render_markdown().encode("utf-8"),
        "bookskill-test-primer.txt": render_txt().encode("utf-8"),
        "bookskill-test-primer.pdf": render_pdf(),
        "bookskill-test-primer.epub": render_epub(),
    }
    for name, data in artifacts.items():
        write_bytes(FIXTURES / name, data)

    content_files = [
        ("bookskill-test-primer.md", "markdown"),
        ("bookskill-test-primer.txt", "txt"),
        ("bookskill-test-primer.pdf", "pdf"),
        ("bookskill-test-primer.epub", "epub"),
    ]
    manifest = {
        "title": TITLE,
        "author": AUTHOR,
        "license": LICENSE_ID,
        "identifier": UUID,
        "chapter_count": CHAPTER_COUNT,
        "description": (
            "Original licensed test fixture for BookSkill Desktop import "
            "and source-citation tests. Not a real book."
        ),
        "principle_paragraph_id": "P1.3",
        "counterexample_paragraph_id": "P2.2",
        "files": [
            {
                "filename": name,
                "format": fmt,
                "sha256": sha256_bytes(artifacts[name]),
                "chapter_count": CHAPTER_COUNT,
                "bytes": len(artifacts[name]),
            }
            for name, fmt in content_files
        ],
        "license_file": {
            "filename": "LICENSE.md",
            "format": "markdown",
            "sha256": sha256_bytes(artifacts["LICENSE.md"]),
            "bytes": len(artifacts["LICENSE.md"]),
        },
    }
    manifest_text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
    write_bytes(FIXTURES / "manifest.json", manifest_text.encode("utf-8"))
    print(f"Wrote {len(artifacts) + 1} files under {FIXTURES}")
    for entry in manifest["files"]:
        print(f"  {entry['filename']}  {entry['sha256']}")
    print(f"  LICENSE.md  {manifest['license_file']['sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
