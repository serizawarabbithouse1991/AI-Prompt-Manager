import { convertFileSrc } from "@tauri-apps/api/core";
import type { FileEntry } from "@/features/files/types";
import { shareFileNative } from "@/lib/tauri";

export async function shareFileEntry(file: FileEntry): Promise<boolean> {
  if (file.isDirectory) return false;

  try {
    await shareFileNative(file.absolutePath);
    return true;
  } catch {
    // Web Share API fallback (iOS/Android WebView)
    if (typeof navigator.share === "function") {
      try {
        const url = convertFileSrc(file.absolutePath);
        const response = await fetch(url);
        const blob = await response.blob();
        const shareFile = new File([blob], file.displayName, {
          type: blob.type || "application/octet-stream",
        });
        if (navigator.canShare?.({ files: [shareFile] })) {
          await navigator.share({ files: [shareFile], title: file.displayName });
          return true;
        }
        await navigator.share({ title: file.displayName, text: file.absolutePath });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
