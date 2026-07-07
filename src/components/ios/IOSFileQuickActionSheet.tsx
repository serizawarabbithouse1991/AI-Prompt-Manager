import { useFileStore } from "@/features/files/store";
import { setFavorite } from "@/lib/tauri";
import { toast } from "@/lib/toast";
import { shareSingleFile } from "@/features/files/useBatchActions";
import { useIOSFileQuickAction } from "@/lib/iosFileQuickAction";

export function IOSFileQuickActionSheet() {
  const file = useIOSFileQuickAction((s) => s.file);
  const close = useIOSFileQuickAction((s) => s.close);
  const enterSelectionMode = useFileStore((s) => s.enterSelectionMode);
  const selectFile = useFileStore((s) => s.selectFile);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const updateFileInList = useFileStore((s) => s.updateFileInList);

  if (!file) return null;

  async function toggleFavorite() {
    const target = file!;
    const next = !target.isFavorite;
    try {
      await setFavorite(target.id, next, target.absolutePath);
      updateFileInList({ ...target, isFavorite: next });
      toast(next ? "お気に入りに追加しました" : "お気に入りを解除しました", "success");
    } catch (e) {
      toast(String(e), "error");
    }
    close();
  }

  async function handleShare() {
    const ok = await shareSingleFile(file!);
    toast(ok ? "共有しました" : "共有できませんでした", ok ? "success" : "error");
    close();
  }

  function handleSelect() {
    enterSelectionMode(file!.id);
    close();
  }

  function handleDetail() {
    if (file!.fileKind === "image") {
      selectFile(file!.id, false, { openInspector: false });
      setLightboxFileId(file!.id);
    } else {
      selectFile(file!.id, false, { openInspector: true });
      setInspectorOpen(true);
    }
    close();
  }

  const actions = [
    { label: "共有", onClick: () => void handleShare() },
    {
      label: file.isFavorite ? "お気に入りを解除" : "お気に入りに追加",
      onClick: () => void toggleFavorite(),
    },
    { label: "選択", onClick: handleSelect },
    { label: "詳細を表示", onClick: handleDetail },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end px-2 pb-[calc(var(--safe-bottom)+0.5rem)]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="閉じる"
        onClick={close}
      />
      <div className="relative space-y-2">
        <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-elevated)]">
          <div className="border-b border-[var(--ios-separator)] px-4 py-3 text-center">
            <p className="truncate text-sm font-semibold text-neutral-200">{file.displayName}</p>
          </div>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="ios-touch-row w-full border-t border-[var(--ios-separator)] text-center text-base text-blue-400"
            >
              {action.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={close}
          className="ios-touch-row w-full rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-elevated)] text-center text-base font-semibold text-blue-400"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
