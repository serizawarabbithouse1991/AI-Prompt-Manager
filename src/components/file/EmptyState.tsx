import { useFileStore } from "@/features/files/store";
import { IconImage } from "@/components/ui/Icons";

type EmptyStateProps = {
  message: string;
  showCta?: boolean;
};

export function EmptyState({ message, showCta }: EmptyStateProps) {
  const setViewMode = useFileStore((s) => s.setViewMode);
  const viewMode = useFileStore((s) => s.viewMode);

  const cta =
    showCta && viewMode === "ai-library" ? (
      <button
        type="button"
        onClick={() => void setViewMode("settings")}
        className="mt-4 action-btn px-4 py-2 text-body"
      >
        写真を取り込む
      </button>
    ) : showCta && viewMode === "collections" ? (
      <p className="mt-2 text-caption text-neutral-500">サイドバーから新しいコレクションを作成できます</p>
    ) : null;

  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center animate-fade-in">
      <IconImage className="mb-3 h-12 w-12 text-neutral-600" />
      <p className="text-body text-neutral-400">{message}</p>
      {cta}
    </div>
  );
}
