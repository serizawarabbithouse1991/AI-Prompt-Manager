import type { Tag } from "@/features/tags/types";

export function filterTagsByQuery(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((tag) => tag.name.toLowerCase().includes(q));
}
