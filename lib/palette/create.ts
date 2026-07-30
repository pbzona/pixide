import {
  formatColorHex,
  normalizeColor,
  oklabToRgb,
  parseColor,
  rgbToOklab,
  type Result,
} from "@/lib/color";

import { MAX_PALETTE_COLORS, type Palette, type PaletteSwatch } from "./types";

export const normalizePaletteColors = (
  colors: readonly string[],
): Result<readonly string[]> => {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const color of colors) {
    const result = normalizeColor(color);
    if (!result.ok) return result;
    const key = result.value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push(result.value);
    }
  }

  if (normalized.length === 0) {
    return { ok: false, error: "A palette needs at least one valid color." };
  }

  if (normalized.length > MAX_PALETTE_COLORS) {
    return {
      ok: false,
      error: `Palettes can contain at most ${MAX_PALETTE_COLORS} colors.`,
    };
  }

  return { ok: true, value: normalized };
};

export const createPalette = (
  id: string,
  name: string,
  colors: readonly string[],
  builtIn = false,
): Result<Palette> => {
  const normalized = normalizePaletteColors(colors);
  if (!normalized.ok) return normalized;

  return {
    ok: true,
    value: {
      id,
      name: name.trim() || "Untitled palette",
      colors: normalized.value.map((hex, index) => ({ id: index, hex })),
      builtIn,
    },
  };
};

export const nextSwatchId = (colors: readonly PaletteSwatch[]): number =>
  colors.reduce((highest, color) => Math.max(highest, color.id), -1) + 1;

export const replaceSwatch = (
  palette: Palette,
  swatchId: number,
  hex: string,
): Result<Palette> => {
  const normalized = normalizeColor(hex);
  if (!normalized.ok) return normalized;
  if (
    palette.colors.some(
      (swatch) =>
        swatch.id !== swatchId &&
        swatch.hex.toLowerCase() === normalized.value.toLowerCase(),
    )
  ) {
    return { ok: false, error: "That color is already in this palette." };
  }

  return {
    ok: true,
    value: {
      ...palette,
      colors: palette.colors.map((swatch) =>
        swatch.id === swatchId ? { ...swatch, hex: normalized.value } : swatch,
      ),
      builtIn: false,
    },
  };
};

export const appendSwatch = (palette: Palette, hex: string): Result<Palette> => {
  if (palette.colors.length >= MAX_PALETTE_COLORS) {
    return {
      ok: false,
      error: `Palettes can contain at most ${MAX_PALETTE_COLORS} colors.`,
    };
  }

  const normalized = normalizeColor(hex);
  if (!normalized.ok) return normalized;

  if (
    palette.colors.some(
      (swatch) => swatch.hex.toLowerCase() === normalized.value.toLowerCase(),
    )
  ) {
    return { ok: false, error: "That color is already in this palette." };
  }

  return {
    ok: true,
    value: {
      ...palette,
      colors: [
        ...palette.colors,
        { id: nextSwatchId(palette.colors), hex: normalized.value },
      ],
      builtIn: false,
    },
  };
};

export const midpointColor = (first: string, second: string): Result<string> => {
  const firstRgb = parseColor(first);
  if (!firstRgb.ok) return firstRgb;
  const secondRgb = parseColor(second);
  if (!secondRgb.ok) return secondRgb;

  const firstLab = rgbToOklab(firstRgb.value);
  const secondLab = rgbToOklab(secondRgb.value);
  const midpoint = oklabToRgb({
    l: (firstLab.l + secondLab.l) / 2,
    a: (firstLab.a + secondLab.a) / 2,
    b: (firstLab.b + secondLab.b) / 2,
    alpha: (firstLab.alpha + secondLab.alpha) / 2,
  });

  return {
    ok: true,
    value: formatColorHex(midpoint, midpoint.alpha < 1),
  };
};

export const insertMidpointSwatch = (
  palette: Palette,
  firstSwatchId: number,
  secondSwatchId: number,
): Result<Palette> => {
  if (palette.colors.length >= MAX_PALETTE_COLORS) {
    return {
      ok: false,
      error: `Palettes can contain at most ${MAX_PALETTE_COLORS} colors.`,
    };
  }

  const firstIndex = palette.colors.findIndex((swatch) => swatch.id === firstSwatchId);
  if (
    firstIndex < 0 ||
    palette.colors[firstIndex + 1]?.id !== secondSwatchId
  ) {
    return { ok: false, error: "Choose two adjacent colors." };
  }

  const midpoint = midpointColor(
    palette.colors[firstIndex].hex,
    palette.colors[firstIndex + 1].hex,
  );
  if (!midpoint.ok) return midpoint;
  if (
    palette.colors.some(
      (swatch) => swatch.hex.toLowerCase() === midpoint.value.toLowerCase(),
    )
  ) {
    return { ok: false, error: "Those colors do not have a distinct midpoint." };
  }

  const colors = [...palette.colors];
  colors.splice(firstIndex + 1, 0, {
    id: nextSwatchId(palette.colors),
    hex: midpoint.value,
  });
  return {
    ok: true,
    value: { ...palette, colors, builtIn: false },
  };
};

export const removeSwatch = (palette: Palette, swatchId: number): Result<Palette> => {
  if (palette.colors.length <= 1) {
    return { ok: false, error: "A palette needs at least one color." };
  }

  return {
    ok: true,
    value: {
      ...palette,
      colors: palette.colors.filter((swatch) => swatch.id !== swatchId),
      builtIn: false,
    },
  };
};

export const moveSwatch = (
  palette: Palette,
  swatchId: number,
  direction: -1 | 1,
): Palette => {
  const index = palette.colors.findIndex((swatch) => swatch.id === swatchId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= palette.colors.length) {
    return palette;
  }

  const colors = [...palette.colors];
  [colors[index], colors[destination]] = [colors[destination], colors[index]];
  return { ...palette, colors, builtIn: false };
};
