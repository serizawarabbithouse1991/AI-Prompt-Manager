import { useFileStore } from "@/features/files/store";
import type { GridDensity } from "@/features/files/types";
import { isMobilePlatform } from "@/lib/platform";
import {
  densityFromColumns,
  getGridColumnBounds,
  GRID_DENSITY_LABELS,
} from "@/lib/gridUtils";
import { IOSListRow } from "@/components/ios/IOSGroupedList";

const DENSITY_ORDER: GridDensity[] = ["xs", "sm", "md", "lg", "xl"];

type GridSizeControlProps = {
  variant: "desktop" | "ios-list" | "ios-compact";
};

export function GridSizeControl({ variant }: GridSizeControlProps) {
  const gridColumns = useFileStore((s) => s.gridColumns);
  const platformName = useFileStore((s) => s.platformName);
  const setGridColumns = useFileStore((s) => s.setGridColumns);
  const setGridDensity = useFileStore((s) => s.setGridDensity);

  const isMobile = isMobilePlatform(platformName);
  const { min, max } = getGridColumnBounds(isMobile);
  const activeDensity = densityFromColumns(gridColumns);

  if (variant === "ios-list") {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-[var(--ios-radius-md)] bg-[var(--ios-bg-grouped)]">
          {DENSITY_ORDER.map((density) => (
            <IOSListRow
              key={density}
              label={GRID_DENSITY_LABELS[density]}
              onPress={() => setGridDensity(density)}
              trailing={activeDensity === density ? <span className="text-blue-400">✓</span> : null}
            />
          ))}
        </div>
        <label className="flex items-center justify-between px-1 text-sm text-neutral-400">
          <span>{gridColumns} 列</span>
          <input
            type="range"
            min={min}
            max={max}
            value={gridColumns}
            onChange={(e) => setGridColumns(Number(e.target.value))}
            className="w-40 accent-blue-500"
            aria-label="グリッド列数"
          />
        </label>
      </div>
    );
  }

  if (variant === "ios-compact") {
    return (
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap justify-center gap-2">
          {DENSITY_ORDER.map((density) => (
            <button
              key={density}
              type="button"
              onClick={() => setGridDensity(density)}
              className={[
                "rounded-full px-4 py-2 text-sm",
                activeDensity === density
                  ? "bg-blue-500 text-white"
                  : "bg-[var(--ios-bg-grouped)] text-neutral-300",
              ].join(" ")}
            >
              {GRID_DENSITY_LABELS[density]}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-4 text-sm text-neutral-400">
          <span className="shrink-0">{gridColumns} 列</span>
          <input
            type="range"
            min={min}
            max={max}
            value={gridColumns}
            onChange={(e) => setGridColumns(Number(e.target.value))}
            className="min-w-0 flex-1 accent-blue-500"
            aria-label="グリッド列数"
          />
        </label>
        <p className="text-center text-xs text-neutral-500">
          2本指ピンチでも列数を変更できます
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        {DENSITY_ORDER.map((density) => (
          <button
            key={density}
            type="button"
            onClick={() => setGridDensity(density)}
            className={[
              "rounded border px-2 py-1 text-micro whitespace-nowrap",
              activeDensity === density
                ? "border-blue-500 bg-blue-500/10 text-blue-300"
                : "border-neutral-700 text-neutral-400 hover:bg-neutral-800",
            ].join(" ")}
          >
            {GRID_DENSITY_LABELS[density]}
          </button>
        ))}
      </div>
      <label className="flex shrink-0 items-center gap-2 text-caption text-neutral-500">
        <span className="whitespace-nowrap">{gridColumns}列</span>
        <input
          type="range"
          min={min}
          max={max}
          value={gridColumns}
          onChange={(e) => setGridColumns(Number(e.target.value))}
          className="w-24 accent-blue-500"
          aria-label="グリッド列数"
        />
      </label>
    </>
  );
}
