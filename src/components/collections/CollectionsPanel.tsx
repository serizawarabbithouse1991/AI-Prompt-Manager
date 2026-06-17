import { useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import {
  createCollection,
  deleteCollection,
  listCollections,
} from "@/lib/tauri";
import { toast } from "@/lib/toast";
import { confirmAction } from "@/lib/confirm";

export function CollectionsPanel() {
  const collections = useFileStore((s) => s.collections);
  const setCollections = useFileStore((s) => s.setCollections);
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    void listCollections().then(setCollections).catch(() => setCollections([]));
  }, [setCollections]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCollection(name);
      setNewName("");
      const updated = await listCollections();
      setCollections(updated);
      toast("コレクションを作成しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleDelete(id: string, name: string) {
    const ok = await confirmAction({
      title: "コレクションを削除",
      message: `「${name}」を削除しますか？画像ファイル自体は削除されません。`,
      confirmLabel: "削除",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCollection(id);
      const updated = await listCollections();
      setCollections(updated);
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
      }
      toast("コレクションを削除しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function openCollection(id: string) {
    setSelectedCollectionId(id);
    await setViewMode("collections");
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="text-title">コレクション</h1>
          <p className="mt-1 text-caption text-neutral-500">
            手動アルバムで画像を整理できます。Inspector から画像を追加できます。
          </p>
        </div>

        <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-body font-medium">新規作成</h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="コレクション名"
              className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-body"
            />
            <button type="button" onClick={() => void handleCreate()} className="action-btn px-3 py-2">
              作成
            </button>
          </div>
        </section>

        <section className="space-y-2">
          {collections.length === 0 ? (
            <p className="text-caption text-neutral-500">コレクションがありません</p>
          ) : (
            collections.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
              >
                <button
                  type="button"
                  onClick={() => void openCollection(c.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-body font-medium">{c.name}</div>
                  <div className="text-caption text-neutral-500">{c.fileCount} 件</div>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(c.id, c.name)}
                  className="action-btn-danger shrink-0"
                >
                  削除
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
