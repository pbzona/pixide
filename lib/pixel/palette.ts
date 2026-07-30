import { adjustColor, parseColor, type PaletteAdjustments } from "@/lib/color";
import type { Palette } from "@/lib/palette";

import type { PixelPaletteColor } from "./types";

export const paletteToPixelColors = (
  palette: Palette,
  adjustments: PaletteAdjustments,
): readonly PixelPaletteColor[] =>
  palette.colors.flatMap((swatch) => {
    const parsed = parseColor(swatch.hex);
    return parsed.ok
      ? [{ id: swatch.id, color: adjustColor(parsed.value, adjustments) }]
      : [];
  });

export const paletteToMatchingColors = (
  palette: Palette,
  adjustments: PaletteAdjustments,
  excludedColorIds: ReadonlySet<number>,
): readonly PixelPaletteColor[] =>
  paletteToPixelColors(palette, adjustments).filter(
    (entry) => !excludedColorIds.has(entry.id),
  );
