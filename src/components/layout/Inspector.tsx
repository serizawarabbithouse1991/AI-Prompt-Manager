import { useFileStore } from "@/features/files/store";
import { FileDetailContent } from "@/components/file/FileDetailContent";
import { isIOSPlatform, isMobilePlatform } from "@/lib/platform";
import { IOSSheet } from "@/components/ios/IOSSheet";

export function Inspector() {
  const selectedFile = useFileStore((s) => s.selectedFile);
  const platformName = useFileStore((s) => s.platformName);
  const inspectorOpen = useFileStore((s) => s.inspectorOpen);
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);

  const isMobile = isMobilePlatform(platformName);
  const isIOS = isIOSPlatform(platformName);
  const imageInLightbox =
    isMobile && selectedFile?.fileKind === "image" && lightboxFileId === selectedFile.id;

  if (!selectedFile) {
    return (
      <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 lg:flex">
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-neutral-500">
          ファイルを選択してください
        </div>
      </aside>
    );
  }

  const content = <FileDetailContent file={selectedFile} />;

  return (
    <>
      {!imageInLightbox && (
        <aside className="hidden h-full min-h-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-950 lg:flex">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{content}</div>
        </aside>
      )}
      {inspectorOpen && isMobile && !isIOS && !imageInLightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-neutral-950 animate-fade-in lg:hidden"
          style={{
            paddingTop: "var(--safe-top)",
            paddingBottom: "var(--safe-bottom)",
            paddingLeft: "var(--safe-left)",
            paddingRight: "var(--safe-right)",
          }}
        >
          <div className="flex shrink-0 items-center border-b border-neutral-800 p-2 sm:p-3">
            <button
              type="button"
              onClick={() => setInspectorOpen(false)}
              className="text-sm text-blue-400"
            >
              ← 戻る
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain animate-slide-in-right">
            {content}
          </div>
        </div>
      )}
      {inspectorOpen && isIOS && selectedFile.fileKind !== "image" && !lightboxFileId && (
        <IOSSheet
          open
          onClose={() => setInspectorOpen(false)}
          title={selectedFile.displayName}
          tall
        >
          {content}
        </IOSSheet>
      )}
    </>
  );
}
