import { FileGrid, FileList } from "@/components/file/FileGrid";
import { Lightbox } from "@/components/file/Lightbox";
import { FileContextMenu } from "@/components/file/FileContextMenu";
import { useFileStore } from "@/features/files/store";

export function FileBrowser() {
  const layoutMode = useFileStore((s) => s.layoutMode);

  return (
    <>
      {layoutMode === "list" ? <FileList /> : <FileGrid />}
      <Lightbox />
      <FileContextMenu />
    </>
  );
}
