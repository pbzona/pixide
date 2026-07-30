import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE_ADJUSTMENTS, parseColor } from "@/lib/color";
import { createPalette } from "@/lib/palette";
import {
  TRANSPARENT_COLOR_ID,
  colorIdsToRgba,
  paletteToMatchingColors,
  paletteToPixelColors,
  type PixelPaletteColor,
} from "@/lib/pixel";

const pixelColor = (id: number, hex: string): PixelPaletteColor => {
  const parsed = parseColor(hex);
  if (!parsed.ok) throw new Error(parsed.error);
  return { id, color: parsed.value };
};

describe("palette matching filters", () => {
  it("omits excluded IDs without changing the complete render palette", () => {
    const created = createPalette("test", "Test", ["#000", "#fff", "#f00"]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const complete = paletteToPixelColors(created.value, DEFAULT_PALETTE_ADJUSTMENTS);
    const matching = paletteToMatchingColors(
      created.value,
      DEFAULT_PALETTE_ADJUSTMENTS,
      new Set([1]),
    );

    expect(complete.map((entry) => entry.id)).toEqual([0, 1, 2]);
    expect(matching.map((entry) => entry.id)).toEqual([0, 2]);
  });
});

describe("isolated color rendering", () => {
  const palette = [
    pixelColor(10, "#ff0000"),
    pixelColor(20, "rgb(0 255 0 / 50%)"),
    pixelColor(30, "#0000ff"),
  ];

  it("renders only the union of visible color IDs", () => {
    const colorIds = new Uint16Array([10, 20, 30, 10]);
    const original = colorIds.slice();

    expect([...colorIdsToRgba(colorIds, palette, new Set([10, 30]))]).toEqual([
      255, 0, 0, 255,
      0, 0, 0, 0,
      0, 0, 255, 255,
      255, 0, 0, 255,
    ]);
    expect(colorIds).toEqual(original);
  });

  it("keeps transparency, palette alpha, and the unfiltered default", () => {
    const colorIds = new Uint16Array([20, TRANSPARENT_COLOR_ID, 999]);

    expect([...colorIdsToRgba(colorIds, palette)]).toEqual([
      0, 255, 0, 128,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
  });
});
