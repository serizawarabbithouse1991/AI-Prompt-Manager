import type { GridDensity } from "@/features/files/types";

export const GRID_DENSITY_COLUMNS: Record<GridDensity, number> = {
  xs: 6,
  sm: 5,
  md: 4,
  lg: 3,
  xl: 2,
};

export const GRID_DENSITY_LABELS: Record<GridDensity, string> = {
  xs: "小",
  sm: "やや小",
  md: "標準",
  lg: "大",
  xl: "特大",
};

export function getGridColumnBounds(isMobile: boolean): { min: number; max: number } {
  return isMobile ? { min: 2, max: 8 } : { min: 3, max: 12 };
}

export function clampGridColumns(columns: number, isMobile: boolean): number {
  const { min, max } = getGridColumnBounds(isMobile);
  return Math.min(max, Math.max(min, Math.round(columns)));
}

export function getDefaultGridColumns(isMobile: boolean): number {
  return isMobile ? 4 : 5;
}

export function applyGridColumnsCss(columns: number): void {
  document.documentElement.style.setProperty("--grid-columns", String(columns));
}

export function densityFromColumns(columns: number): GridDensity | null {
  const entry = (Object.entries(GRID_DENSITY_COLUMNS) as [GridDensity, number][]).find(
    ([, cols]) => cols === columns,
  );
  return entry?.[0] ?? null;
}
