import type { PaletteAdjustments } from "@/lib/color";

export type PaletteSwatch = Readonly<{
  id: number;
  hex: string;
}>;

export type PaletteSource = "builtin" | "local" | "palette-town";

export type PaletteAttribution = Readonly<{
  text: string | null;
  url: string | null;
  license: string | null;
}>;

export type Palette = Readonly<{
  id: string;
  name: string;
  colors: readonly PaletteSwatch[];
  source: PaletteSource;
  tags?: readonly string[];
  author?: Readonly<{ name: string; url: string | null }> | null;
  attribution?: PaletteAttribution | null;
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

export const paletteIdentity = (palette: Pick<Palette, "id" | "source">) =>
  `${palette.source}:${palette.id}`;
