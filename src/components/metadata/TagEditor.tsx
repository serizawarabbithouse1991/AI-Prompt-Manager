import { useState } from "react";
import type { Tag } from "@/features/tags/types";
import { addTagToFile, createTag, getFileTags, listTags, removeTagFromFile } from "@/lib/tauri";
import { useFileStore } from "@/features/files/store";

type TagEditorProps = {
  fileId: string;
  tags: Tag[];
  allTags: Tag[];
};

export function TagEditor({ fileId, tags, allTags }: TagEditorProps) {
  const [newTagName, setNewTagName] = useState("");
  const setTags = useFileStore((s) => s.setTags);
  const setAllTags = useFileStore((s) => s.setAllTags);
  const refreshAllTags = useFileStore((s) => s.setAllTags);

  async function handleAddExisting(tagId: string) {
    await addTagToFile(fileId, tagId);
    const updated = await getFileTags(fileId);
    setTags(updated);
  }

  async function handleRemove(tagId: string) {
    await removeTagFromFile(fileId, tagId);
    setTags(tags.filter((t) => t.id !== tagId));
  }

  async function handleCreate() {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTag(name);
    await addTagToFile(fileId, tag.id);
    setNewTagName("");
    const [fileTags, updatedAll] = await Promise.all([
      getFileTags(fileId),
      listTags(),
    ]);
    setTags(fileTags);
    refreshAllTags(updatedAll);
    setAllTags(updatedAll);
  }

  const unattached = allTags.filter((t) => !tags.some((ft) => ft.id === t.id));

  return (
    <div className="space-y-3 border-t border-neutral-800 pt-3">
      <h3 className="text-sm font-medium text-neutral-300">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-1 text-xs"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => void handleRemove(tag.id)}
              className="text-neutral-500 hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="新しいタグ"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          className="rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-500"
        >
          追加
        </button>
      </div>
      {unattached.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {unattached.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => void handleAddExisting(tag.id)}
              className="rounded border border-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:border-neutral-500"
            >
              + {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
