import { useEffect, useId, useRef, useState } from "react";
import type { Tag } from "@/features/tags/types";
import { filterTagsByQuery } from "@/lib/tagPicker";

const MAX_VISIBLE_OPTIONS = 50;

type TagPickerProps = {
  tags: Tag[];
  value: string | null;
  onChange: (tagId: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
  noTagsLabel?: string;
  className?: string;
};

export function TagPicker({
  tags,
  value,
  onChange,
  placeholder = "タグを検索…",
  emptyLabel = "すべて",
  noTagsLabel = "タグがありません",
  className = "",
}: TagPickerProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedTag = value ? tags.find((tag) => tag.id === value) : null;
  const filteredTags = filterTagsByQuery(tags, query);
  const visibleTags = filteredTags.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = Math.max(0, filteredTags.length - visibleTags.length);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selectedTag?.name ?? "");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, selectedTag?.name]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    setQuery(selectedTag?.name ?? "");
  }, [selectedTag?.id, selectedTag?.name]);

  function handleSelect(tagId: string | null) {
    onChange(tagId);
    const nextTag = tagId ? tags.find((tag) => tag.id === tagId) : null;
    setQuery(nextTag?.name ?? "");
    setOpen(false);
    setActiveIndex(0);
  }

  function handleInputChange(nextQuery: string) {
    setQuery(nextQuery);
    setOpen(true);
    if (value && nextQuery !== selectedTag?.name) {
      onChange(null);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(visibleTags.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (open && visibleTags[activeIndex]) {
        handleSelect(visibleTags[activeIndex].id);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(selectedTag?.name ?? "");
      inputRef.current?.blur();
    }
  }

  if (tags.length === 0) {
    return (
      <span className={["text-caption text-neutral-500", className].join(" ")}>
        {noTagsLabel}
      </span>
    );
  }

  return (
    <div ref={rootRef} className={["relative min-w-[10rem]", className].join(" ")}>
      <div className="flex items-center gap-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1">
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={query}
          placeholder={placeholder}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-neutral-200 outline-none"
        />
        {value && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="text-neutral-500 hover:text-neutral-300"
            aria-label={emptyLabel}
            title={emptyLabel}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded border border-neutral-700 bg-neutral-900 py-1 shadow-lg"
        >
          <li role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(null)}
              className={[
                "block w-full px-3 py-1.5 text-left text-sm",
                !value ? "bg-neutral-800 text-neutral-100" : "text-neutral-400 hover:bg-neutral-800",
              ].join(" ")}
            >
              {emptyLabel}
            </button>
          </li>
          {visibleTags.length === 0 ? (
            <li className="px-3 py-1.5 text-sm text-neutral-500">一致するタグがありません</li>
          ) : (
            visibleTags.map((tag, index) => (
              <li key={tag.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === tag.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(tag.id)}
                  className={[
                    "block w-full px-3 py-1.5 text-left text-sm",
                    index === activeIndex || value === tag.id
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-200 hover:bg-neutral-800",
                  ].join(" ")}
                >
                  {tag.name}
                </button>
              </li>
            ))
          )}
          {hiddenCount > 0 && (
            <li className="px-3 py-1.5 text-xs text-neutral-500">他 {hiddenCount} 件</li>
          )}
        </ul>
      )}
    </div>
  );
}
