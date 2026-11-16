import { SEARCH_CONTENT_TYPES, type SearchContentType, type SearchHit } from "@bookskill/core";

export type SearchHitGroup = {
  contentType: SearchContentType;
  hits: SearchHit[];
};

/** Group hits by content type, preserving score order within each group. */
export function groupSearchHits(hits: readonly SearchHit[]): SearchHitGroup[] {
  const groups: SearchHitGroup[] = [];
  for (const contentType of SEARCH_CONTENT_TYPES) {
    const grouped = hits.filter((hit) => hit.contentType === contentType);
    if (grouped.length > 0) {
      groups.push({ contentType, hits: grouped });
    }
  }
  return groups;
}

export function flattenGroupedHits(hits: readonly SearchHit[]): SearchHit[] {
  return groupSearchHits(hits).flatMap((group) => group.hits);
}
