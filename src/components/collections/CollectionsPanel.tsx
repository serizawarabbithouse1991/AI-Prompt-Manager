import { useCallback, useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import type { CharacterSuggestion, Collection } from "@/features/files/types";
import {
  batchAssignSmartCollections,
  createCollection,
  createSmartCollection,
  deleteCollection,
  dismissCharacterSuggestion,
  diagnoseSmartAssignment,
  listCharacterSuggestions,
  listCollections,
  updateCollectionKeywords,
} from "@/lib/tauri";
import { formatBatchAssignResult, formatSkipReason } from "@/lib/smartAssign";
import { toast } from "@/lib/toast";
import { confirmAction } from "@/lib/confirm";
import { IOSGroupedList, IOSListRow } from "@/components/ios/IOSGroupedList";

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

export function CollectionsPanel({ variant = "default" }: { variant?: "default" | "ios" }) {
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
  const [diagnosisText, setDiagnosisText] = useState<string | null>(null);

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
      const message = formatBatchAssignResult(result);
      if (result.skipReason || result.assignmentsAdded === 0) {
        toast(message, result.skipReason ? "error" : "info");
      } else {
        toast(message, "success");
      }
    } catch (e) {
      toast(String(e), "error");
    } finally {
      setBatchRunning(false);
    }
  }

  async function handleDiagnose() {
    try {
      const d = await diagnoseSmartAssignment();
      const lines = [
        `ファイル: ${d.fileId ?? "—"}`,
        `プロンプト: ${d.hasPrompt ? d.promptPreview ?? "あり" : "なし"}`,
        `スマートキーワード: ${d.cacheCount.toLocaleString()} 件`,
        `トークン: ${d.tokenizedTags.slice(0, 8).join(", ") || "—"}`,
        `マッチ: ${d.matchedCharacterTags.join(", ") || "なし"}`,
      ];
      if (d.skipReason) {
        lines.push(`理由: ${formatSkipReason(d.skipReason)}`);
      }
      setDiagnosisText(lines.join("\n"));
    } catch (e) {
      toast(String(e), "error");
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

  const isIOSVariant = variant === "ios";

  function renderCollectionItem(c: Collection) {
    const isSmart = c.kind === "smart_character";
    const isEditing = editingId === c.id;

    if (isIOSVariant) {
      return (
        <div key={c.id}>
          <IOSListRow
            label={c.name}
            value={`${c.fileCount} 件${isSmart ? " · スマート" : ""}`}
            showChevron
            onPress={() => void openCollection(c.id)}
          />
          {isSmart && isEditing && (
            <div className="space-y-2 border-b border-[var(--ios-separator)] px-4 py-3">
              <input
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                placeholder="hatsune miku, 初音ミク"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => void handleSaveKeywords(c)} className="text-sm text-blue-400">
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setEditKeywords("");
                  }}
                  className="text-sm text-neutral-400"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

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

  if (isIOSVariant) {
    return (
      <div className="ios-collections space-y-6 pb-8">
        <IOSGroupedList title="スマート振り分け" footer="プロンプトの character: タグとスマートコレクションのキーワードで自動振り分けします。">
          <IOSListRow
            label={batchRunning ? "実行中…" : "スマート振り分けを実行"}
            onPress={() => void handleBatchAssign()}
            disabled={batchRunning}
          />
          <IOSListRow label="診断テスト" onPress={() => void handleDiagnose()} />
        </IOSGroupedList>

        {diagnosisText && (
          <pre className="overflow-x-auto rounded-lg bg-neutral-900/50 p-3 text-xs text-neutral-400 whitespace-pre-wrap">
            {diagnosisText}
          </pre>
        )}

        <IOSGroupedList title="新規コレクション">
          <div className="space-y-2 border-b border-[var(--ios-separator)] px-4 py-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="コレクション名"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <button type="button" onClick={() => void handleCreate()} className="text-base text-blue-400">
              手動で作成
            </button>
          </div>
          <div className="space-y-2 px-4 py-3">
            <input
              value={smartName}
              onChange={(e) => setSmartName(e.target.value)}
              placeholder="スマート名（例: 初音ミク）"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <input
              value={smartKeywords}
              onChange={(e) => setSmartKeywords(e.target.value)}
              placeholder="キーワード（カンマ区切り）"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-base"
            />
            <button type="button" onClick={() => void handleCreateSmart()} className="text-base text-blue-400">
              スマート作成
            </button>
          </div>
        </IOSGroupedList>

        {suggestions.length > 0 && (
          <IOSGroupedList title="未作成キャラ">
            {suggestions.map((s) => (
              <IOSListRow
                key={s.tag}
                label={s.tag}
                value={`${s.hitCount} 回`}
                onPress={() => void handleCreateSmart(s.tag)}
              />
            ))}
          </IOSGroupedList>
        )}

        <IOSGroupedList title="一覧">
          {collections.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">コレクションがありません</div>
          ) : (
            collections.map(renderCollectionItem)
          )}
        </IOSGroupedList>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="text-title">コレクション</h1>
          <p className="mt-1 text-caption text-neutral-500">
            プロンプトの character: タグとスマートコレクションのキーワードで自動振り分けします。手動アルバムも利用できます。
          </p>
        </div>

        <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-body font-medium">スマート振り分け</h2>
          <p className="text-caption text-neutral-500">
            既存ライブラリ全体をプロンプトから再スキャンし、コレクションへ振り分けます。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={batchRunning}
              onClick={() => void handleBatchAssign()}
              className="action-btn px-3 py-2 disabled:opacity-50"
            >
              {batchRunning ? "実行中…" : "スマート振り分けを実行"}
            </button>
            <button type="button" onClick={() => void handleDiagnose()} className="action-btn px-3 py-2">
              診断テスト
            </button>
          </div>
          {diagnosisText && (
            <pre className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950 p-2 text-caption text-neutral-400 whitespace-pre-wrap">
              {diagnosisText}
            </pre>
          )}
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
              プロンプトで検出されたがコレクション未作成のキャラタグです。タップでコレクションを作成できます。
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
