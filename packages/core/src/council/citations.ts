import type { CouncilCitation, ParsedDistillFixture } from "./types.ts";

export function fixtureContainsQuote(markdown: string, quote: string): boolean {
  const trimmed = quote.trim();
  if (!trimmed) {
    return false;
  }
  return markdown.includes(trimmed);
}

export function sourceForFilename(
  sources: ParsedDistillFixture[],
  filename: string,
): ParsedDistillFixture | undefined {
  return sources.find((item) => item.filename === filename);
}

/**
 * Citations may only quote text that already appears in the allowed fixture
 * Markdown. Invented "original" wording is rejected.
 */
export function validateCouncilCitations(
  citations: CouncilCitation[],
  allowedSources: ParsedDistillFixture[],
): void {
  for (const citation of citations) {
    const source = sourceForFilename(allowedSources, citation.source_filename);
    if (!source) {
      throw new Error(
        `Council citation source is outside the allowed retrieval scope: ${citation.source_filename}`,
      );
    }
    if (!fixtureContainsQuote(source.markdown, citation.quote)) {
      throw new Error(
        `Council citations must not invent original text: ${citation.quote} is not in ${citation.source_filename}`,
      );
    }
  }
}

export function ensureSourceFilenameInContent(content: string, sourceFilename: string): string {
  if (content.includes(sourceFilename)) {
    return content;
  }
  const trimmed = content.trimEnd();
  return `${trimmed}\n\n来源：${sourceFilename}`;
}

export function uniqueSourceFilenames(filenames: string[]): string {
  const unique = [...new Set(filenames.filter(Boolean))];
  if (unique.length === 0) {
    throw new Error("Council utterance is missing source_filename");
  }
  return unique.join("、");
}
