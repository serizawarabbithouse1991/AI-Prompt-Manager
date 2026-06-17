import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useFileStore } from "@/features/files/store";
import type { DanbooruCacheProgress, ImportResult, PromptTagMode, PromptTagSettings } from "@/features/files/types";
import {
  cancelPhotoLibraryScan,
  importFromSaf,
  importPaths,
  pickImportItems,
  pickImportPhotos,
  getStorageDiagnostics,
  reconcileAiLibrary,
  backfillContentHashes,
  backupDatabase,
  getDanbooruIndexStatus,
  rebuildDanbooruCharacterCache,
  importDanbooruDbFile,
  diagnoseSmartAssignment,
  getPromptTagSettings,
  setPromptTagSettings,
  batchApplyPromptTags,
  type DanbooruIndexStatus,
  type StorageDiagnostics,
} from "@/lib/tauri";
import { formatNovelAiImportResult, formatPhotoScanResult, runPhotoLibraryScan } from "@/lib/photoScan";
import { formatAssignSuffix, formatBatchTagApplyResult, formatSkipReason } from "@/lib/smartAssign";
import { toast } from "@/lib/toast";
import { confirmAction } from "@/lib/confirm";
import {
  loadAutoPhotoScanEnabled,
  saveAutoPhotoScanEnabled,
} from "@/lib/photoScanPrefs";
import {
  isAndroidPlatform,
  isDesktopPlatform,
  isIOSPlatform,
  isMobilePlatform,
} from "@/lib/platform";
import { IOSGroupedList, IOSListRow, IOSSwitch } from "@/components/ios/IOSGroupedList";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp"];

const IMAGE_AND_ZIP_FILTERS = [
  {
    name: "Images & ZIP",
    extensions: [...IMAGE_EXTENSIONS, "zip"],
  },
];

const PHOTO_LIBRARY_OPTIONS = {
  multiple: true,
  pickerMode: "image" as const,
  filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }],
};

function formatImportResult(result: ImportResult, novelaiOnly: boolean): string {
  if (novelaiOnly) {
    return formatNovelAiImportResult(result);
  }
  const duplicates = result.duplicateCount ?? 0;
  const duplicateText = duplicates > 0 ? `, 重複 ${duplicates} 件` : "";
  return `完了: 画像 ${result.imageCount} 件, ZIP ${result.zipCount} 件, エラー ${result.errorCount} 件${duplicateText}${formatAssignSuffix(result)}`;
}

export function SettingsPanel({ variant = "default" }: { variant?: "default" | "ios" }) {
  const platformName = useFileStore((s) => s.platformName);
  const setViewMode = useFileStore((s) => s.setViewMode);
  const setScanning = useFileStore((s) => s.setScanning);
  const setScanProgress = useFileStore((s) => s.setScanProgress);
  const setBatchProgress = useFileStore((s) => s.setBatchProgress);
  const setImportProgress = useFileStore((s) => s.setImportProgress);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [libraryScanning, setLibraryScanning] = useState(false);
  const [autoPhotoScan, setAutoPhotoScan] = useState(loadAutoPhotoScanEnabled);
  const [pngOnlyScan, setPngOnlyScan] = useState(true);
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(null);
  const [danbooruStatus, setDanbooruStatus] = useState<DanbooruIndexStatus | null>(null);
  const [danbooruRebuilding, setDanbooruRebuilding] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<DanbooruCacheProgress | null>(null);
  const [diagnosisText, setDiagnosisText] = useState<string | null>(null);
  const [promptTagSettings, setPromptTagSettingsState] = useState<PromptTagSettings | null>(null);
  const [batchTagRunning, setBatchTagRunning] = useState(false);

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);
  const isIOS = isIOSPlatform(platformName);
  const isAndroid = isAndroidPlatform(platformName);
  const isIOSVariant = variant === "ios";

  function handleAutoPhotoScanToggle(enabled: boolean) {
    setAutoPhotoScan(enabled);
    saveAutoPhotoScanEnabled(enabled);
  }

  async function refreshStorageDiagnostics() {
    try {
      const diagnostics = await getStorageDiagnostics();
      setStorageDiagnostics(diagnostics);
    } catch (e) {
      setLastResult(String(e));
    }
  }

  async function refreshDanbooruStatus() {
    try {
      const status = await getDanbooruIndexStatus();
      setDanbooruStatus(status);
    } catch (e) {
      setDanbooruStatus(null);
      setLastResult(String(e));
    }
  }

  useEffect(() => {
    void refreshDanbooruStatus();
    void getPromptTagSettings()
      .then(setPromptTagSettingsState)
      .catch(() => setPromptTagSettingsState({ mode: "all", autoTagOnImport: true }));
    const unlisten = listen<DanbooruCacheProgress>("danbooru-cache-progress", (event) => {
      setCacheProgress(event.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  async function handlePromptTagModeChange(mode: PromptTagMode) {
    const auto = promptTagSettings?.autoTagOnImport ?? true;
    try {
      await setPromptTagSettings(mode, auto);
      setPromptTagSettingsState({ mode, autoTagOnImport: auto });
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleAutoTagOnImportToggle(enabled: boolean) {
    const mode = promptTagSettings?.mode ?? "all";
    try {
      await setPromptTagSettings(mode, enabled);
      setPromptTagSettingsState({ mode, autoTagOnImport: enabled });
    } catch (e) {
      toast(String(e), "error");
    }
  }

  async function handleBatchApplyPromptTags() {
    setBatchTagRunning(true);
    try {
      const result = await batchApplyPromptTags(promptTagSettings?.mode);
      const message = formatBatchTagApplyResult(result);
      setLastResult(message);
      toast(message, result.skipReason ? "error" : "success");
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    } finally {
      setBatchTagRunning(false);
    }
  }

  async function handleDiagnose() {
    try {
      const d = await diagnoseSmartAssignment();
      const lines = [
        `ファイル: ${d.fileId ?? "—"}`,
        `プロンプト: ${d.hasPrompt ? d.promptPreview ?? "あり" : "なし"}`,
        `辞書: ${d.cacheReady ? `${d.cacheCount.toLocaleString()} タグ` : "未構築"}`,
        `マッチ: ${d.matchedCharacterTags.join(", ") || "なし"}`,
      ];
      if (d.skipReason) {
        lines.push(`理由: ${formatSkipReason(d.skipReason)}`);
      }
      setDiagnosisText(lines.join("\n"));
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    }
  }

  async function handleRebuildDanbooruCache() {
    setDanbooruRebuilding(true);
    setCacheProgress({ phase: "opening", count: 0, message: "開始中…" });
    try {
      const result = await rebuildDanbooruCharacterCache();
      await refreshDanbooruStatus();
      setLastResult(`Danbooru 辞書: ${result.cacheCount.toLocaleString()} キャラタグを読み込みました`);
      toast(`キャラ辞書を更新しました（${result.cacheCount.toLocaleString()} 件）`, "success");
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    } finally {
      setDanbooruRebuilding(false);
      setCacheProgress(null);
    }
  }

  async function handleImportDanbooruDb() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "SQLite DB", extensions: ["db"] }],
    });
    const paths = normalizeSelectedPaths(selected);
    if (paths.length === 0) return;

    setDanbooruRebuilding(true);
    setCacheProgress({ phase: "opening", count: 0, message: "開始中…" });
    try {
      const result = await importDanbooruDbFile(paths[0]);
      await refreshDanbooruStatus();
      setLastResult(`Danbooru DB をインポート: ${result.cacheCount.toLocaleString()} キャラタグ`);
      toast(`辞書をインポートしました（${result.cacheCount.toLocaleString()} 件）`, "success");
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    } finally {
      setDanbooruRebuilding(false);
      setCacheProgress(null);
    }
  }

  async function handleReconcileLibrary() {
    setScanning(true);
    setScanProgress("ライブラリを再同期中…");
    try {
      const result = await reconcileAiLibrary();
      await refreshStorageDiagnostics();
      setLastResult(
        `再同期: ディスク ${result.diskFileCount} 件 / DB ${result.dbLibraryCount} 件 → 復元 ${result.restoredCount} 件 / 整理 ${result.prunedCount} 件`,
      );
      toast(
        result.restoredCount > 0 || result.prunedCount > 0
          ? `復元 ${result.restoredCount} 件、整理 ${result.prunedCount} 件`
          : "再同期が完了しました",
        "success",
      );
      if (result.restoredCount > 0 || result.prunedCount > 0) {
        await setViewMode("ai-library");
      }
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }

  useEffect(() => {
    if (isMobilePlatform(platformName)) {
      void refreshStorageDiagnostics();
    }
  }, [platformName]);

  async function runImport(
    paths: string[],
    label: string,
    options?: { novelaiOnly?: boolean },
  ) {
    if (paths.length === 0) return;
    const novelaiOnly = options?.novelaiOnly ?? false;
    setScanning(true);
    setScanProgress(`${label}中…`);
    setBatchProgress(null);
    setLastResult(null);
    try {
      const result = await importPaths(paths, { novelaiOnly });
      const message = formatImportResult(result, novelaiOnly);
      setScanProgress(message);
      setBatchProgress(null);
      setLastResult(message);
      toast(message, "success");
      await setViewMode("ai-library");
    } catch (e) {
      const message = String(e);
      setScanProgress(message);
      setLastResult(message);
    } finally {
      setScanning(false);
    }
  }

  function normalizeSelectedPaths(
    selected: string | string[] | { path: string } | Array<{ path: string }> | null,
  ): string[] {
    if (!selected) return [];
    if (typeof selected === "string") return [selected];
    if (Array.isArray(selected)) {
      return selected.map((item) => (typeof item === "string" ? item : item.path));
    }
    return [selected.path];
  }

  async function handleImportFromICloud() {
    if (isIOS) {
      const paths = await pickImportItems();
      await runImport(paths, "iCloud/ファイル・フォルダからインポート");
      return;
    }

    if (isAndroid) {
      const selected = await open({ multiple: true, filters: IMAGE_AND_ZIP_FILTERS });
      await runImport(normalizeSelectedPaths(selected), "SAF/ファイルからインポート");
      return;
    }

    const selected = await open({ multiple: true, filters: IMAGE_AND_ZIP_FILTERS });
    await runImport(normalizeSelectedPaths(selected), "iCloud/ファイルからインポート");
  }

  async function handleImportAllFromPhotoLibrary() {
    if (isIOS) {
      const paths = await pickImportPhotos();
      await runImport(paths, "写真ライブラリからインポート");
      return;
    }

    if (isAndroid) {
      const selected = await open(PHOTO_LIBRARY_OPTIONS);
      await runImport(normalizeSelectedPaths(selected), "画像からインポート");
      return;
    }

    const selected = await open(PHOTO_LIBRARY_OPTIONS);
    await runImport(normalizeSelectedPaths(selected), "写真ライブラリからインポート");
  }

  async function handleImportNovelAiFromPhotoLibrary() {
    if (isIOS) {
      const paths = await pickImportPhotos();
      await runImport(paths, "NovelAI 判別・取込", { novelaiOnly: true });
      return;
    }

    if (isAndroid) {
      const selected = await open(PHOTO_LIBRARY_OPTIONS);
      await runImport(normalizeSelectedPaths(selected), "NovelAI 判別・取込", {
        novelaiOnly: true,
      });
      return;
    }

    const selected = await open(PHOTO_LIBRARY_OPTIONS);
    await runImport(normalizeSelectedPaths(selected), "NovelAI 判別・取込", {
      novelaiOnly: true,
    });
  }

  async function handleScanPhotoLibraryNovelAi() {
    if (!isIOS) return;

    const confirmed = await confirmAction({
      title: "写真ライブラリをスキャン",
      message:
        "写真ライブラリ全体をスキャンし、NovelAI メタデータ付き画像のみ取り込みます。枚数が多い場合は時間がかかります。続行しますか？",
      confirmLabel: "スキャン開始",
    });
    if (!confirmed) return;

    setLibraryScanning(true);
    setScanning(true);
    setScanProgress("写真ライブラリをスキャン中…");
    setBatchProgress("準備中…");
    setImportProgress(null);
    setLastResult(null);

    try {
      const result = await runPhotoLibraryScan(true, { pngOnly: pngOnlyScan });
      const message = formatPhotoScanResult(result);
      setScanProgress(message);
      setBatchProgress(null);
      setLastResult(message);
      toast(message, "success");
      if ((result.novelaiCount ?? result.importedCount) > 0) {
        await setViewMode("ai-library");
      }
    } catch (e) {
      const message = String(e);
      setScanProgress(message);
      setLastResult(message);
    } finally {
      setLibraryScanning(false);
      setScanning(false);
      setImportProgress(null);
    }
  }

  async function handleCancelLibraryScan() {
    setScanProgress("中断中…");
    try {
      await cancelPhotoLibraryScan();
      setScanProgress("スキャンを中断しました");
      setLastResult("スキャンを中断しました");
    } catch (e) {
      setScanProgress(String(e));
    } finally {
      setLibraryScanning(false);
      setScanning(false);
      setBatchProgress(null);
      setImportProgress(null);
    }
  }

  async function handleImportFolder() {
    if (isAndroid) {
      const selected = await open({ directory: true, multiple: false });
      if (typeof selected !== "string") return;
      await runImport([selected], "フォルダからインポート");
      return;
    }

    const selected = await open({ directory: true, multiple: false, recursive: true });
    if (typeof selected !== "string") return;
    await runImport([selected], "フォルダからインポート");
  }

  async function handleBackfillHashes() {
    setScanning(true);
    setScanProgress("content_hash をバックフィル中…");
    try {
      const result = await backfillContentHashes();
      const message = `バックフィル完了: 更新 ${result.updatedCount} 件 / スキップ ${result.skippedCount} 件`;
      setLastResult(message);
      toast(message, "success");
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }

  async function handleBackupDatabase() {
    try {
      const path = await backupDatabase();
      setLastResult(`バックアップ: ${path}`);
      toast("データベースをバックアップしました", "success");
    } catch (e) {
      setLastResult(String(e));
      toast(String(e), "error");
    }
  }

  async function handleSafImport() {
    const selected = await open({ multiple: false, filters: IMAGE_AND_ZIP_FILTERS });
    const paths = normalizeSelectedPaths(selected);
    if (paths.length === 0) return;
    const uri = paths[0];
    setScanning(true);
    setScanProgress("SAF インポート中…");
    try {
      await importFromSaf(uri);
      setScanProgress("SAF インポート完了");
      setLastResult("SAF インポート完了");
      await setViewMode("ai-library");
    } catch {
      await runImport(paths, "ファイルからインポート（フォールバック）");
    } finally {
      setScanning(false);
    }
  }

  if (isIOSVariant) {
    return (
      <div className="ios-settings space-y-6 px-4 py-2 pb-10">
        <IOSGroupedList
          title="インポート"
          footer="写真ライブラリはオリジナルファイルを保持してインポートします。"
        >
          <IOSListRow label="iCloud / ファイル・フォルダを選択" onPress={() => void handleImportFromICloud()} />
          <IOSListRow label="写真を選択してすべて取り込む" onPress={() => void handleImportAllFromPhotoLibrary()} />
          <IOSListRow
            label="写真を選択して NovelAI のみ取り込む"
            onPress={() => void handleImportNovelAiFromPhotoLibrary()}
          />
          <IOSSwitch
            label="起動時に新しい写真を自動スキャン"
            checked={autoPhotoScan}
            onChange={handleAutoPhotoScanToggle}
          />
          <IOSSwitch
            label="PNG のみ高速スキャン"
            checked={pngOnlyScan}
            onChange={setPngOnlyScan}
          />
          <IOSListRow
            label={libraryScanning ? "スキャン中…" : "写真ライブラリをスキャン（NovelAI のみ）"}
            onPress={() => void handleScanPhotoLibraryNovelAi()}
            disabled={libraryScanning}
          />
          {libraryScanning && (
            <IOSListRow label="スキャンを中断" destructive onPress={() => void handleCancelLibraryScan()} />
          )}
        </IOSGroupedList>

        <IOSGroupedList title="プロンプトからタグ付け">
          <IOSListRow
            label="全トークン"
            onPress={() => void handlePromptTagModeChange("all")}
            trailing={(promptTagSettings?.mode ?? "all") === "all" ? <span className="text-blue-400">✓</span> : null}
          />
          <IOSListRow
            label="キャラクターのみ"
            onPress={() => void handlePromptTagModeChange("character")}
            trailing={promptTagSettings?.mode === "character" ? <span className="text-blue-400">✓</span> : null}
          />
          <IOSSwitch
            label="取り込み時に自動でタグ付け"
            checked={promptTagSettings?.autoTagOnImport ?? true}
            onChange={(v) => void handleAutoTagOnImportToggle(v)}
          />
          <IOSListRow
            label={batchTagRunning ? "タグ付け中…" : "ライブラリ全体にタグ付け"}
            onPress={() => void handleBatchApplyPromptTags()}
            disabled={batchTagRunning}
          />
        </IOSGroupedList>

        <IOSGroupedList title="キャラクター辞書（Danbooru）">
          {danbooruStatus && (
            <IOSListRow
              label="キャッシュ"
              value={
                danbooruStatus.cacheReady
                  ? `${danbooruStatus.cacheCount.toLocaleString()} タグ`
                  : "未構築"
              }
            />
          )}
          <IOSListRow
            label={danbooruRebuilding ? "辞書を更新中…" : "辞書を更新"}
            onPress={() => void handleRebuildDanbooruCache()}
            disabled={danbooruRebuilding}
          />
          <IOSListRow
            label="danbooru2023.db をインポート"
            onPress={() => void handleImportDanbooruDb()}
            disabled={danbooruRebuilding}
          />
          <IOSListRow label="状態を更新" onPress={() => void refreshDanbooruStatus()} />
          <IOSListRow label="振り分け診断テスト" onPress={() => void handleDiagnose()} />
        </IOSGroupedList>

        {cacheProgress && (
          <p className="px-2 text-xs text-neutral-400">
            {cacheProgress.message}
            {cacheProgress.count > 0 && ` (${cacheProgress.count.toLocaleString()} 件)`}
          </p>
        )}
        {diagnosisText && (
          <pre className="overflow-x-auto rounded-lg bg-neutral-900/50 p-3 text-xs text-neutral-400 whitespace-pre-wrap">
            {diagnosisText}
          </pre>
        )}

        <IOSGroupedList title="ストレージ">
          {storageDiagnostics && (
            <>
              <IOSListRow label="ディスク上の画像" value={`${storageDiagnostics.diskFileCount} 件`} />
              <IOSListRow label="DB 登録（Library）" value={`${storageDiagnostics.dbLibraryCount} 件`} />
              <IOSListRow
                label="実体のない DB 登録"
                value={`${storageDiagnostics.missingDbFileCount} 件`}
              />
              <IOSListRow label="DB サイズ" value={`${Math.round(storageDiagnostics.databaseBytes / 1024)} KB`} />
            </>
          )}
          <IOSListRow label="ストレージ情報を更新" onPress={() => void refreshStorageDiagnostics()} />
          <IOSListRow label="ライブラリを再同期" onPress={() => void handleReconcileLibrary()} />
          <IOSListRow label="content_hash をバックフィル" onPress={() => void handleBackfillHashes()} />
          <IOSListRow label="データベースをバックアップ" onPress={() => void handleBackupDatabase()} />
        </IOSGroupedList>

        {lastResult && (
          <p className="rounded-lg bg-neutral-900/50 px-3 py-2 text-xs text-neutral-400">{lastResult}</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-auto p-3 sm:p-4">
      <div className="mx-auto max-w-lg space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-title">設定</h1>
          <p className="mt-1 text-caption text-neutral-500">
            iCloud Drive・写真ライブラリ・画像フォルダから AI Library に取り込みます。
          </p>
        </div>

        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">インポート</h2>
          <p className="text-xs text-neutral-500">
            {isIOS
              ? "写真ライブラリはオリジナルファイルを保持してインポートします。NovelAI のみ取り込む場合は PNG 内メタデータで判別します（再エンコード済み写真は判別できない場合があります）。"
              : isAndroid
                ? "Android ではファイルピッカー（SAF）経由で画像・ZIP・フォルダをインポートします。"
                : "ファイルピッカーで iCloud Drive 内の画像・ZIP、またはフォルダを選べます。"}
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => void handleImportFromICloud()} className="action-btn">
              {isIOS
                ? "iCloud / ファイル・フォルダを選択"
                : isAndroid
                  ? "ファイルを選択（SAF）"
                  : "画像・ZIP を選択"}
            </button>
            {isMobile && (
              <>
                <button
                  type="button"
                  onClick={() => void handleImportAllFromPhotoLibrary()}
                  className="action-btn"
                >
                  {isAndroid ? "画像を選択してすべて取り込む" : "写真を選択してすべて取り込む"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleImportNovelAiFromPhotoLibrary()}
                  className="action-btn"
                >
                  写真を選択して NovelAI のみ取り込む
                </button>
              </>
            )}
            {isIOS && (
              <>
                <label className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={autoPhotoScan}
                    onChange={(e) => handleAutoPhotoScanToggle(e.target.checked)}
                  />
                  起動時に新しい写真を自動スキャン（NovelAI のみ取込）
                </label>
                <label className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-caption text-neutral-300">
                  <input
                    type="checkbox"
                    checked={pngOnlyScan}
                    onChange={(e) => setPngOnlyScan(e.target.checked)}
                  />
                  PNG のみ高速スキャン（推奨・NovelAI 先読み判別）
                </label>
                <button
                  type="button"
                  onClick={() => void handleScanPhotoLibraryNovelAi()}
                  disabled={libraryScanning}
                  className="action-btn"
                >
                  写真ライブラリをスキャン（NovelAI のみ）
                </button>
                {libraryScanning && (
                  <button
                    type="button"
                    onClick={() => void handleCancelLibraryScan()}
                    className="action-btn border-red-900/50 text-red-400"
                  >
                    スキャンを中断
                  </button>
                )}
              </>
            )}
            {(isDesktop || isAndroid) && (
              <button type="button" onClick={() => void handleImportFolder()} className="action-btn">
                フォルダを選択
              </button>
            )}
            {isAndroid && (
              <button type="button" onClick={() => void handleSafImport()} className="action-btn">
                SAF 単一ファイルインポート
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">プロンプトからタグ付け</h2>
          <p className="text-xs text-neutral-500">
            画像の positive_prompt からタグを自動付与します。付与されたタグは kind=auto として保存されます。
          </p>
          <div className="space-y-2 text-xs text-neutral-400">
            <p className="font-medium text-neutral-300">タグの範囲</p>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="promptTagMode"
                checked={(promptTagSettings?.mode ?? "all") === "all"}
                onChange={() => void handlePromptTagModeChange("all")}
              />
              全トークン（1girl, masterpiece など）
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="promptTagMode"
                checked={promptTagSettings?.mode === "character"}
                onChange={() => void handlePromptTagModeChange("character")}
              />
              キャラクターのみ（Danbooru 辞書が必要）
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={promptTagSettings?.autoTagOnImport ?? true}
              onChange={(e) => void handleAutoTagOnImportToggle(e.target.checked)}
            />
            取り込み時に自動でタグ付け
          </label>
          <button
            type="button"
            disabled={batchTagRunning}
            onClick={() => void handleBatchApplyPromptTags()}
            className="action-btn disabled:opacity-50"
          >
            {batchTagRunning ? "タグ付け中…" : "ライブラリ全体にタグ付け"}
          </button>
        </section>

        <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <h2 className="text-sm font-medium">キャラクター辞書（Danbooru）</h2>
          <p className="text-xs text-neutral-500">
            danbooru2023.db からキャラクタータグを読み込み、プロンプトに含まれるキャラごとにコレクションへ自動振り分けします。
            {isDesktop
              ? " デフォルトは iCloud の NovelAI フォルダ内の danbooru2023.db です。"
              : " iOS では DB ファイルをアプリへインポートしてください。"}
          </p>
          {danbooruStatus && !danbooruStatus.cacheReady && (
            <p className="rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              辞書が未構築です。DB をインポート（または検出）後、「辞書を更新」を実行してください。更新完了までスマート振り分けは動作しません。
            </p>
          )}
          {cacheProgress && (
            <div className="space-y-1">
              <p className="text-xs text-neutral-400">{cacheProgress.message}</p>
              {cacheProgress.count > 0 && (
                <p className="text-xs text-neutral-500">{cacheProgress.count.toLocaleString()} 件処理済み</p>
              )}
            </div>
          )}
          {danbooruStatus ? (
            <dl className="space-y-1 text-xs text-neutral-400">
              <div className="flex justify-between gap-4">
                <dt>DB</dt>
                <dd className="max-w-[60%] truncate text-right">
                  {danbooruStatus.dbExists ? danbooruStatus.dbPath ?? "検出済み" : "未検出"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>キャッシュ</dt>
                <dd>
                  {danbooruStatus.cacheReady
                    ? `${danbooruStatus.cacheCount.toLocaleString()} タグ`
                    : "未構築"}
                </dd>
              </div>
              {danbooruStatus.cacheBuiltAt && (
                <div className="flex justify-between gap-4">
                  <dt>最終更新</dt>
                  <dd>{new Date(danbooruStatus.cacheBuiltAt).toLocaleString()}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-xs text-neutral-500">読み込み中…</p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={danbooruRebuilding}
              onClick={() => void handleRebuildDanbooruCache()}
              className="action-btn disabled:opacity-50"
            >
              {danbooruRebuilding ? "辞書を更新中…" : "辞書を更新"}
            </button>
            {(isIOS || isAndroid) && (
              <button
                type="button"
                disabled={danbooruRebuilding}
                onClick={() => void handleImportDanbooruDb()}
                className="action-btn disabled:opacity-50"
              >
                danbooru2023.db をインポート
              </button>
            )}
            <button type="button" onClick={() => void refreshDanbooruStatus()} className="action-btn">
              状態を更新
            </button>
            <button type="button" onClick={() => void handleDiagnose()} className="action-btn">
              振り分け診断テスト
            </button>
          </div>
          {diagnosisText && (
            <pre className="overflow-x-auto rounded border border-neutral-800 bg-neutral-950 p-2 text-xs text-neutral-400 whitespace-pre-wrap">
              {diagnosisText}
            </pre>
          )}
        </section>

        {isDesktop && (
          <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium">Desktop</h2>
            <p className="text-xs text-neutral-500">
              Sidebar の NovelAI (iCloud) から直接閲覧・スキャンも利用できます。
            </p>
          </section>
        )}

        {isMobile && (
          <section className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
            <h2 className="text-sm font-medium">ストレージ</h2>
            {storageDiagnostics ? (
              <dl className="space-y-1 text-xs text-neutral-400">
                <div className="flex justify-between gap-4">
                  <dt>ディスク上の画像</dt>
                  <dd>{storageDiagnostics.diskFileCount} 件</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>DB 登録（Library）</dt>
                  <dd>{storageDiagnostics.dbLibraryCount} 件</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>実体のない DB 登録</dt>
                  <dd>{storageDiagnostics.missingDbFileCount} 件</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>DB 全体</dt>
                  <dd>{storageDiagnostics.dbTotalCount} 件</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>処理済み写真 ID</dt>
                  <dd>{storageDiagnostics.processedPhotoCount} 件</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>DB サイズ</dt>
                  <dd>{Math.round(storageDiagnostics.databaseBytes / 1024)} KB</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-neutral-500">読み込み中…</p>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button type="button" onClick={() => void refreshStorageDiagnostics()} className="action-btn">
                ストレージ情報を更新
              </button>
              <button type="button" onClick={() => void handleReconcileLibrary()} className="action-btn">
                ライブラリを再同期（ディスク → DB）
              </button>
              <button type="button" onClick={() => void handleBackfillHashes()} className="action-btn">
                content_hash をバックフィル
              </button>
              <button type="button" onClick={() => void handleBackupDatabase()} className="action-btn">
                データベースをバックアップ
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              一覧が空でもディスク上に画像が残っている場合、再同期で復元できます。
            </p>
          </section>
        )}

        {lastResult && (
          <p className="rounded border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
            {lastResult}
          </p>
        )}
      </div>
    </div>
  );
}
