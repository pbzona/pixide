import { formatColorHex, parseColor } from "./format";
import { oklchToRgb, rgbToOklch } from "./conversion";
import type { PaletteAdjustments, RgbaColor } from "./types";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const adjustColor = (
  color: RgbaColor,
  adjustments: PaletteAdjustments,
): RgbaColor => {
  const oklch = rgbToOklch(color);
  const contrastFactor = 1 + adjustments.contrast / 100;

  return oklchToRgb({
    l: clamp(
      0.5 + (oklch.l - 0.5) * contrastFactor + adjustments.lightness / 100,
      0,
      1,
    ),
    c: Math.max(0, oklch.c * (1 + adjustments.saturation / 100)),
    h: (oklch.h + adjustments.hue + 360) % 360,
    alpha: color.alpha,
  });
};

export const adjustHexColor = (
  hex: string,
  adjustments: PaletteAdjustments,
): string => {
  const parsed = parseColor(hex);
  if (!parsed.ok) return hex;
  const adjusted = adjustColor(parsed.value, adjustments);
  return formatColorHex(adjusted, adjusted.alpha < 1);
};

export const adjustHexPalette = (
  colors: readonly string[],
  adjustments: PaletteAdjustments,
): readonly string[] => colors.map((color) => adjustHexColor(color, adjustments));
