function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uniqueFragments(fragments: readonly string[]): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of fragments) {
    const part = raw.trim();
    if (part.length < 2) {
      continue;
    }
    const key = part.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    values.push(part);
  }
  return values.sort((left, right) => right.length - left.length);
}

/** Escape a snippet and wrap matched fragments in <mark>. */
export function highlightSnippet(snippet: string, fragments: readonly string[]): string {
  const needles = uniqueFragments(fragments);
  if (needles.length === 0) {
    return escapeHtml(snippet);
  }
  const lower = snippet.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  for (const needle of needles) {
    const target = needle.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(target, from);
      if (at < 0) {
        break;
      }
      ranges.push({ start: at, end: at + needle.length });
      from = at + needle.length;
    }
  }
  if (ranges.length === 0) {
    return escapeHtml(snippet);
  }
  ranges.sort((left, right) => left.start - right.start || right.end - left.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
    }
  }
  let html = "";
  let cursor = 0;
  for (const range of merged) {
    html += escapeHtml(snippet.slice(cursor, range.start));
    html += `<mark>${escapeHtml(snippet.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  }
  html += escapeHtml(snippet.slice(cursor));
  return html;
}

export { escapeHtml };
