import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useDisplayFiles, useFileStore } from "@/features/files/store";
import { IconChevronLeft, IconChevronRight, IconInfo } from "@/components/ui/Icons";
import { isIOSPlatform } from "@/lib/platform";

const SWIPE_THRESHOLD_PX = 50;

export function Lightbox() {
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const selectFile = useFileStore((s) => s.selectFile);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const displayFiles = useDisplayFiles();
  const platformName = useFileStore((s) => s.platformName);
  const isIOS = isIOSPlatform(platformName);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  const images = displayFiles.filter((f) => f.fileKind === "image" && !f.isDirectory);
  const currentIndex = images.findIndex((f) => f.id === lightboxFileId);
  const current = currentIndex >= 0 ? images[currentIndex] : null;
  const promptPreview = current?.promptPreview;

  useEffect(() => {
    if (lightboxFileId) {
      setVisible(true);
      setPromptExpanded(false);
    } else {
      setVisible(false);
    }
  }, [lightboxFileId]);

  useEffect(() => {
    dragOffsetRef.current = 0;
    setDragOffset(0);
    touchStartRef.current = null;
    setPromptExpanded(false);
  }, [lightboxFileId]);

  useEffect(() => {
    if (!lightboxFileId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxFileId(null);
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        setLightboxFileId(images[currentIndex - 1].id);
      }
      if (e.key === "ArrowRight" && currentIndex < images.length - 1) {
        setLightboxFileId(images[currentIndex + 1].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxFileId, currentIndex, images, setLightboxFileId]);

  useEffect(() => {
    const el = swipeAreaRef.current;
    if (!el || !lightboxFileId) return;

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }

    function onTouchMove(e: TouchEvent) {
      const start = touchStartRef.current;
      if (!start) return;

      const touch = e.touches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;

      if (isIOS && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        e.preventDefault();
        dragOffsetRef.current = dy;
        setDragOffset(dy);
        return;
      }

      if (Math.abs(dx) <= Math.abs(dy)) return;

      e.preventDefault();
      const atStart = currentIndex <= 0 && dx > 0;
      const atEnd = currentIndex >= images.length - 1 && dx < 0;
      const resisted = atStart || atEnd ? dx * 0.35 : dx;
      dragOffsetRef.current = resisted;
      setDragOffset(resisted);
    }

    function onTouchEnd() {
      const offset = dragOffsetRef.current;
      touchStartRef.current = null;
      dragOffsetRef.current = 0;
      setDragOffset(0);

      if (isIOS && offset > 80) {
        setLightboxFileId(null);
        return;
      }

      if (offset <= -SWIPE_THRESHOLD_PX && currentIndex < images.length - 1) {
        setLightboxFileId(images[currentIndex + 1].id);
      } else if (offset >= SWIPE_THRESHOLD_PX && currentIndex > 0) {
        setLightboxFileId(images[currentIndex - 1].id);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [lightboxFileId, currentIndex, images, setLightboxFileId, isIOS]);

  if (!lightboxFileId || !current) return null;

  const goToPrevious = () => {
    if (currentIndex > 0) setLightboxFileId(images[currentIndex - 1].id);
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) setLightboxFileId(images[currentIndex + 1].id);
  };

  function openInspector() {
    if (!current) return;
    selectFile(current.id);
    setLightboxFileId(null);
    setInspectorOpen(true);
  }

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex touch-none items-center justify-center transition-opacity duration-200",
        isIOS ? "ios-lightbox z-[65] bg-black" : "z-50 bg-black/90",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
      }}
      onClick={() => setLightboxFileId(null)}
    >
      {!isIOS && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightboxFileId(null);
          }}
          className="absolute z-10 rounded bg-neutral-800 px-3 py-1 text-body hover:bg-neutral-700 focus-ring"
          style={{
            top: "calc(var(--safe-top) + 0.75rem)",
            right: "calc(var(--safe-right) + 0.75rem)",
          }}
        >
          閉じる
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openInspector();
        }}
        className={[
          "absolute z-10 flex items-center gap-1 rounded px-3 py-1.5 text-body focus-ring",
          isIOS
            ? "ios-lightbox-info-btn bg-white/10 text-white backdrop-blur-sm"
            : "bg-neutral-800 hover:bg-neutral-700 lg:hidden",
        ].join(" ")}
        style={{
          top: "calc(var(--safe-top) + 0.75rem)",
          left: "calc(var(--safe-left) + 0.75rem)",
        }}
      >
        <IconInfo className="h-4 w-4" />
        詳細
      </button>
      {currentIndex > 0 && !isIOS && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 rounded bg-neutral-800 p-2 hover:bg-neutral-700 focus-ring sm:block"
          aria-label="前の画像"
        >
          <IconChevronLeft className="h-6 w-6" />
        </button>
      )}
      {currentIndex < images.length - 1 && !isIOS && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 rounded bg-neutral-800 p-2 hover:bg-neutral-700 focus-ring sm:block"
          aria-label="次の画像"
        >
          <IconChevronRight className="h-6 w-6" />
        </button>
      )}
      <div
        ref={swipeAreaRef}
        className="relative flex max-h-[90vh] max-w-[100vw] items-center justify-center px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={convertFileSrc(current.absolutePath)}
          alt={current.displayName}
          className="max-w-full select-none object-contain animate-fade-in"
          draggable={false}
          style={{
            maxHeight: "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 4.5rem)",
            transform:
              dragOffset !== 0
                ? isIOS
                  ? `translateY(${dragOffset}px)`
                  : `translateX(${dragOffset}px)`
                : undefined,
            transition: dragOffset === 0 ? "transform 0.2s ease-out" : undefined,
            opacity: isIOS && dragOffset > 0 ? Math.max(0.3, 1 - dragOffset / 300) : undefined,
          }}
        />
        {promptPreview && !isIOS && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPromptExpanded((v) => !v);
            }}
            className={[
              "absolute bottom-2 left-2 right-2 rounded-lg border border-neutral-700/80 bg-black/70 px-3 py-2 text-left text-caption text-neutral-200 backdrop-blur-sm transition-all",
              promptExpanded ? "max-h-[40vh] overflow-y-auto" : "max-h-16 overflow-hidden",
            ].join(" ")}
          >
            <span className={promptExpanded ? "whitespace-pre-wrap" : "line-clamp-2"}>
              {promptPreview}
            </span>
            <span className="mt-1 block text-micro text-neutral-500">
              {promptExpanded ? "タップで折りたたむ" : "タップで全文表示"}
            </span>
          </button>
        )}
      </div>
      <div
        className={[
          "pointer-events-none absolute left-1/2 max-w-[90vw] -translate-x-1/2 truncate text-center text-body",
          isIOS ? "ios-lightbox-indicator text-white/90" : "text-neutral-300",
        ].join(" ")}
        style={{ bottom: isIOS ? "calc(var(--safe-bottom) + 2rem)" : "calc(var(--safe-bottom) + 1rem)" }}
      >
        {isIOS && images.length > 1 ? (
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </span>
        ) : (
          <>
            {current.displayName}
            {images.length > 1 && (
              <span className="ml-2 text-neutral-500">
                {currentIndex + 1} / {images.length}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
