import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useDisplayFiles, useFileStore } from "@/features/files/store";
import { FileDetailContent } from "@/components/file/FileDetailContent";
import { IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";
import { isIOSPlatform, isMobilePlatform } from "@/lib/platform";

const SWIPE_THRESHOLD_PX = 50;

export function Lightbox() {
  const lightboxFileId = useFileStore((s) => s.lightboxFileId);
  const setLightboxFileId = useFileStore((s) => s.setLightboxFileId);
  const selectFile = useFileStore((s) => s.selectFile);
  const setInspectorOpen = useFileStore((s) => s.setInspectorOpen);
  const displayFiles = useDisplayFiles();
  const platformName = useFileStore((s) => s.platformName);
  const isIOS = isIOSPlatform(platformName);
  const isMobile = isMobilePlatform(platformName);
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
    if (!isMobile || !lightboxFileId) return;
    selectFile(lightboxFileId, false, { openInspector: false });
  }, [lightboxFileId, isMobile, selectFile]);

  useEffect(() => {
    dragOffsetRef.current = 0;
    setDragOffset(0);
    touchStartRef.current = null;
    setPromptExpanded(false);
  }, [lightboxFileId]);

  useEffect(() => {
    if (!lightboxFileId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
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

      if (isIOS && !isMobile && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
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

      if (isIOS && !isMobile && offset > 50) {
        closeLightbox();
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
  }, [lightboxFileId, currentIndex, images, setLightboxFileId, isIOS, isMobile]);

  if (!lightboxFileId || !current) return null;

  const goToPrevious = () => {
    if (currentIndex > 0) setLightboxFileId(images[currentIndex - 1].id);
  };

  const goToNext = () => {
    if (currentIndex < images.length - 1) setLightboxFileId(images[currentIndex + 1].id);
  };

  function closeLightbox() {
    setLightboxFileId(null);
    setInspectorOpen(false);
  }

  const imageStyle = {
    maxHeight: isMobile
      ? "min(52dvh, 480px)"
      : "calc(100dvh - var(--safe-top) - var(--safe-bottom) - 4.5rem)",
    transform:
      dragOffset !== 0
        ? isIOS && !isMobile
          ? `translateY(${dragOffset}px)`
          : `translateX(${dragOffset}px)`
        : undefined,
    transition: dragOffset === 0 ? "transform 0.2s ease-out" : undefined,
    opacity: isIOS && !isMobile && dragOffset > 0 ? Math.max(0.3, 1 - dragOffset / 300) : undefined,
  };

  if (isMobile) {
    return (
      <div
        className={[
          "ios-lightbox fixed inset-0 z-[65] flex flex-col bg-black transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          paddingLeft: "var(--safe-left)",
          paddingRight: "var(--safe-right)",
        }}
      >
        <div
          className="flex shrink-0 items-center border-b border-white/10 bg-black/80 px-2 backdrop-blur-md"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="flex min-h-11 items-center gap-0.5 px-2 text-base font-medium text-blue-400"
          >
            <IconChevronLeft className="h-5 w-5" />
            戻る
          </button>
          {images.length > 1 && (
            <span className="ml-auto rounded-full bg-white/15 px-3 py-1 text-sm text-white/90">
              {currentIndex + 1} / {images.length}
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            ref={swipeAreaRef}
            className="relative flex touch-none items-center justify-center bg-black px-2 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={convertFileSrc(current.absolutePath)}
              alt={current.displayName}
              className="max-w-full select-none object-contain animate-fade-in"
              draggable={false}
              style={imageStyle}
            />
          </div>

          <div className="rounded-t-2xl bg-neutral-950">
            <FileDetailContent file={current} showPreview={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex items-center justify-center touch-none bg-black/90 transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={{
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "var(--safe-left)",
        paddingRight: "var(--safe-right)",
      }}
      onClick={closeLightbox}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeLightbox();
        }}
        className="absolute z-10 flex items-center gap-1 rounded bg-neutral-800 px-3 py-1.5 text-body hover:bg-neutral-700 focus-ring"
        style={{
          top: "calc(var(--safe-top) + 0.75rem)",
          left: "calc(var(--safe-left) + 0.75rem)",
        }}
      >
        <IconChevronLeft className="h-4 w-4" />
        戻る
      </button>
      {currentIndex > 0 && (
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
      {currentIndex < images.length - 1 && (
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
        className="relative flex max-h-[90vh] max-w-[100vw] touch-none items-center justify-center px-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={convertFileSrc(current.absolutePath)}
          alt={current.displayName}
          className="max-w-full select-none object-contain animate-fade-in"
          draggable={false}
          style={imageStyle}
        />
        {promptPreview && (
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
        className="pointer-events-none absolute left-1/2 max-w-[90vw] -translate-x-1/2 truncate text-center text-body text-neutral-300"
        style={{ bottom: "calc(var(--safe-bottom) + 1rem)" }}
      >
        {current.displayName}
        {images.length > 1 && (
          <span className="ml-2 text-neutral-500">
            {currentIndex + 1} / {images.length}
          </span>
        )}
      </div>
    </div>
  );
}
