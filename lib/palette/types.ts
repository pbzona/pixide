import type { PaletteAdjustments } from "@/lib/color";

export type PaletteSwatch = Readonly<{
  id: number;
  hex: string;
}>;

export type Palette = Readonly<{
  id: string;
  name: string;
  colors: readonly PaletteSwatch[];
  builtIn?: boolean;
}>;

export type PaletteImport = Readonly<{
  name: string;
  colors: readonly string[];
}>;

export type AdjustedPalette = Readonly<{
  palette: Palette;
  adjustments: PaletteAdjustments;
  colors: readonly PaletteSwatch[];
}>;

export const MAX_PALETTE_COLORS = 64;
