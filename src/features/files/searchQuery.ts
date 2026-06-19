import type { Tag } from "@/features/tags/types";

export type ParsedTagSearchQuery = {
  tagId: string | null;
  query: string;
};

export function parseTagSearchQuery(input: string, allTags: Tag[]): ParsedTagSearchQuery {
  const trimmed = input.trim();
  if (!trimmed.startsWith("#")) {
    return { tagId: null, query: trimmed };
  }

  const afterHash = trimmed.slice(1);
  if (!afterHash) {
    return { tagId: null, query: trimmed };
  }

  const tagByLowerName = new Map(allTags.map((tag) => [tag.name.toLowerCase(), tag.id]));

  const fullMatch = tagByLowerName.get(afterHash.toLowerCase());
  if (fullMatch) {
    return { tagId: fullMatch, query: "" };
  }

  const spaceIdx = afterHash.indexOf(" ");
  if (spaceIdx > 0) {
    const tagPart = afterHash.slice(0, spaceIdx);
    const rest = afterHash.slice(spaceIdx + 1).trim();
    const tagId = tagByLowerName.get(tagPart.toLowerCase());
    if (tagId) {
      return { tagId, query: rest };
    }
  }

  const sortedTags = [...allTags].sort((a, b) => b.name.length - a.name.length);
  for (const tag of sortedTags) {
    if (afterHash.toLowerCase().startsWith(tag.name.toLowerCase())) {
      const remainder = afterHash.slice(tag.name.length).trimStart();
      return { tagId: tag.id, query: remainder };
    }
  }

  return { tagId: null, query: trimmed };
}
