import { useCallback, useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import type { CharacterSuggestion, Collection } from "@/features/files/types";
import {
  batchAssignSmartCollections,
  createCollection,
  createSmartCollection,
  deleteCollection,
  dismissCharacterSuggestion,
  listCharacterSuggestions,
  listCollections,
  updateCollectionKeywords,
} from "@/lib/tauri";
import { toast } from "@/lib/toast";
import { confirmAction } from "@/lib/confirm";

function parseKeywords(input: string): string[] {
  return input
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function formatKeywords(keywords?: string[]): string {
  if (!keywords?.length) return "";
  return keywords.join(", ");
}

export function CollectionsPanel() {
  const collections = useFileStore((s) => s.collections);
  const setCollections = useFileStore((s) => s.setCollections);
  const selectedCollectionId = useFileStore((s) => s.selectedCollectionId);
  const setSelectedCollectionId = useFileStore((s) => s.setSelectedCollectionId);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const [newName, setNewName] = useState("");
  const [smartName, setSmartName] = useState("");
  const [smartKeywords, setSmartKeywords] = useState("");
  const [suggestions, setSuggestions] = useState<CharacterSuggestion[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editKeywords, setEditKeywords] = useState("");

  const refreshCollections = useCallback(async () => {
    const updated = await listCollections();
    setCollections(updated);
    return updated;
  }, [setCollections]);

  const refreshSuggestions = useCallback(async () => {
    try {
      const items = await listCharacterSuggestions(30);
      setSuggestions(items);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    void refreshCollections().catch(() => setCollections([]));
    void refreshSuggestions();
  }, [refreshCollections, refreshSuggestions, setCollections]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCollection(name);
      setNewName("");
      await refreshCollections();
      toast("コレクションを作成しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleCreateSmart(prefillTag?: string) {
    const name = (prefillTag ?? smartName).trim();
    const keywords = prefillTag
      ? [prefillTag, prefillTag.replace(/ /g, "_")]
      : parseKeywords(smartKeywords);
    if (!name || keywords.length === 0) return;
    try {
      await createSmartCollection(name, keywords);
      if (!prefillTag) {
        setSmartName("");
        setSmartKeywords("");
      }
      await refreshCollections();
      await refreshSuggestions();
      toast(`スマートコレクション「${name}」を作成しました`, "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleBatchAssign() {
    setBatchRunning(true);
    try {
      const result = await batchAssignSmartCollections();
      await refreshCollections();
      await refreshSuggestions();
      toast(
        `振り分け完了: ${result.filesProcessed} 件を処理、${result.assignmentsAdded} 件を追加`,
        "success",
      );
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBatchRunning(false);
    }
  }

  async function handleSaveKeywords(collection: Collection) {
    const keywords = parseKeywords(editKeywords);
    if (keywords.length === 0) return;
    try {
      await updateCollectionKeywords(collection.id, keywords);
      setEditingId(null);
      setEditKeywords("");
      await refreshCollections();
      toast("キーワードを更新しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleDismissSuggestion(tag: string) {
    try {
      await dismissCharacterSuggestion(tag);
      await refreshSuggestions();
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
      await refreshCollections();
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

  function renderCollectionItem(c: Collection) {
    const isSmart = c.kind === "smart_character";
    const isEditing = editingId === c.id;

    return (
      <div
        key={c.id}
        className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openCollection(c.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-2">
              <span className="truncate text-body font-medium">{c.name}</span>
              {isSmart && (
                <span className="shrink-0 rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] text-sky-300">
                  スマート
                </span>
              )}
            </div>
            <div className="text-caption text-neutral-500">{c.fileCount} 件</div>
            {isSmart && c.matchKeywords?.length && !isEditing && (
              <div className="mt-1 truncate text-caption text-neutral-600">
                {formatKeywords(c.matchKeywords)}
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(c.id, c.name)}
            className="action-btn-danger shrink-0"
          >
            削除
          </button>
        </div>

        {isSmart && (
          <div className="space-y-2 border-t border-neutral-800 pt-2">
            {isEditing ? (
              <>
                <input
                  value={editKeywords}
                  onChange={(e) => setEditKeywords(e.target.value)}
                  placeholder="hatsune miku, 初音ミク, miku"
                  className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-caption"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveKeywords(c)}
                    className="action-btn px-2 py-1 text-caption"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditKeywords("");
                    }}
                    className="action-btn px-2 py-1 text-caption"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingId(c.id);
                  setEditKeywords(formatKeywords(c.matchKeywords));
                }}
                className="text-caption text-neutral-400 hover:text-neutral-200"
              >
                キーワードを編集
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="text-title">コレクション</h1>
          <p className="mt-1 text-caption text-neutral-500">
            Danbooru 辞書で判別したキャラクタータグごとにコレクションを自動作成し、プロンプトから振り分けます。手動アルバムも利用できます。
          </p>
        </div>

        <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-body font-medium">スマート振り分け</h2>
          <p className="text-caption text-neutral-500">
            既存ライブラリ全体を Danbooru キャラタグで再スキャンし、コレクションへ振り分けます。設定で辞書を更新してから実行してください。
          </p>
          <button
            type="button"
            disabled={batchRunning}
            onClick={() => void handleBatchAssign()}
            className="action-btn px-3 py-2 disabled:opacity-50"
          >
            {batchRunning ? "実行中…" : "スマート振り分けを実行"}
          </button>
        </section>

        <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-body font-medium">エイリアス付きスマートコレクション</h2>
          <p className="text-caption text-neutral-500">
            自動作成に加え、別名キーワード（カンマ区切り）で手動登録もできます。
          </p>
          <input
            value={smartName}
            onChange={(e) => setSmartName(e.target.value)}
            placeholder="コレクション名（例: 初音ミク）"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-body"
          />
          <input
            value={smartKeywords}
            onChange={(e) => setSmartKeywords(e.target.value)}
            placeholder="キーワード（例: hatsune miku, 初音ミク, miku）"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-body"
          />
          <button
            type="button"
            onClick={() => void handleCreateSmart()}
            className="action-btn px-3 py-2"
          >
            スマート作成
          </button>
        </section>

        <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-body font-medium">手動コレクション作成</h2>
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

        {suggestions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-body font-medium">未作成キャラ</h2>
            <p className="text-caption text-neutral-500">
              Danbooru で検出されたがコレクション未作成のキャラタグです。タップでコレクションを作成できます。
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div
                  key={s.tag}
                  className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body">{s.tag}</div>
                    <div className="text-caption text-neutral-500">{s.hitCount} 回出現</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateSmart(s.tag)}
                    className="action-btn shrink-0 px-2 py-1 text-caption"
                  >
                    作成
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDismissSuggestion(s.tag)}
                    className="action-btn-danger shrink-0 px-2 py-1 text-caption"
                  >
                    非表示
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-body font-medium">一覧</h2>
          {collections.length === 0 ? (
            <p className="text-caption text-neutral-500">コレクションがありません</p>
          ) : (
            collections.map(renderCollectionItem)
          )}
        </section>
      </div>
    </div>
  );
}
