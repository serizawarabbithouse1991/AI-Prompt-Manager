import { useEffect, useState } from "react";
import { useFileStore } from "@/features/files/store";
import {
  copyFile,
  moveFile,
  removeFromLibrary,
  revealInFileManager,
  setFavorite,
  trashFile,
} from "@/lib/tauri";
import { isDesktopPlatform, isMobilePlatform } from "@/lib/platform";
import { open } from "@tauri-apps/plugin-dialog";

export function FileContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);
  const files = useFileStore((s) => s.files);
  const platformName = useFileStore((s) => s.platformName);
  const selectFile = useFileStore((s) => s.selectFile);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const enterSelectionMode = useFileStore((s) => s.enterSelectionMode);
  const refresh = useFileStore((s) => s.refresh);
  const navigateTo = useFileStore((s) => s.navigateTo);

  const isDesktop = isDesktopPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);

  useEffect(() => {
    function close() {
      setMenu(null);
    }
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  useEffect(() => {
    function onContextMenu(e: CustomEvent<{ x: number; y: number; fileId: string }>) {
      setMenu(e.detail);
    }
    window.addEventListener("file-context-menu", onContextMenu as EventListener);
    return () => window.removeEventListener("file-context-menu", onContextMenu as EventListener);
  }, []);

  if (!menu) return null;

  const file = files.find((f) => f.id === menu.fileId);
  if (!file) return null;

  async function runAndClose(action: () => Promise<void>) {
    await action();
    setMenu(null);
    await refresh();
  }

  return (
    <div
      className="fixed z-50 min-w-[160px] rounded border border-neutral-700 bg-neutral-900 py-1 shadow-xl"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {!file!.isDirectory && file!.fileKind === "image" && (
        <MenuItem
          label="プレビュー"
          onClick={() => {
            selectFile(file!.id);
            setLightboxFileId(file!.id);
            setMenu(null);
          }}
        />
      )}
      {file!.isDirectory && (
        <MenuItem label="開く" onClick={() => void runAndClose(async () => navigateTo(file!.absolutePath))} />
      )}
      <MenuItem
        label={file!.isFavorite ? "お気に入り解除" : "お気に入り"}
        onClick={() =>
          void runAndClose(async () => {
            await setFavorite(file!.id, !file!.isFavorite, file!.absolutePath);
          })
        }
      />
      <MenuItem
        label="選択モード"
        onClick={() => {
          enterSelectionMode(file!.id);
          setMenu(null);
        }}
      />
      {isDesktop && !file!.isDirectory && (
        <>
          <MenuItem
            label="Finder/Explorer"
            onClick={() => void runAndClose(async () => revealInFileManager(file!.absolutePath))}
          />
          <MenuItem
            label="コピー…"
            onClick={() =>
              void runAndClose(async () => {
                const dest = await open({ directory: true, multiple: false });
                if (typeof dest === "string") await copyFile(file!.absolutePath, dest);
              })
            }
          />
          <MenuItem
            label="移動…"
            onClick={() =>
              void runAndClose(async () => {
                const dest = await open({ directory: true, multiple: false });
                if (typeof dest === "string") await moveFile(file!.absolutePath, dest);
              })
            }
          />
          <MenuItem
            label="ゴミ箱"
            onClick={() =>
              void runAndClose(async () => {
                if (confirm(`「${file!.displayName}」をゴミ箱へ移動しますか？`)) {
                  await trashFile(file!.absolutePath);
                  selectFile(null);
                }
              })
            }
          />
        </>
      )}
      {isMobile && !file!.isDirectory && (
        <MenuItem
          label="ライブラリから削除"
          onClick={() =>
            void runAndClose(async () => {
              if (confirm(`「${file!.displayName}」を削除しますか？`)) {
                await removeFromLibrary(file!.id);
                selectFile(null);
              }
            })
          }
        />
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}

export function showFileContextMenu(x: number, y: number, fileId: string) {
  window.dispatchEvent(
    new CustomEvent("file-context-menu", { detail: { x, y, fileId } }),
  );
}
