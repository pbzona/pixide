import { describe, expect, it } from "vitest";

import {
  createPalette,
  extractPaletteFromPixels,
  insertMidpointSwatch,
  midpointColor,
  parseJsonPalette,
  parseTextPalette,
} from "@/lib/palette";

describe("palette parsing", () => {
  it("parses and deduplicates JSON arrays", () => {
    expect(parseJsonPalette('["#fff", "rgb(0 0 0)", "#ffffff"]')).toEqual({
      ok: true,
      value: ["#ffffff", "#000000"],
    });
  });

  it("reports the location of malformed text entries", () => {
    const result = parseTextPalette("#fff\nwrong color\n#000");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("wrong color");
  });
});

describe("palette editing", () => {
  it("creates a perceptual midpoint in OKLab", () => {
    expect(midpointColor("#000000", "#ffffff")).toEqual({
      ok: true,
      value: "#636363",
    });
  });

  it("inserts a midpoint between adjacent swatches with a stable new id", () => {
    const created = createPalette("test", "Test", ["#000000", "#ffffff", "#ff0000"]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = insertMidpointSwatch(created.value, 0, 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.colors).toEqual([
      { id: 0, hex: "#000000" },
      { id: 3, hex: "#636363" },
      { id: 1, hex: "#ffffff" },
      { id: 2, hex: "#ff0000" },
    ]);
  });

  it("rejects non-adjacent colors and duplicate midpoints", () => {
    const created = createPalette("test", "Test", ["#000000", "#ffffff", "#636363"]);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(insertMidpointSwatch(created.value, 0, 2)).toEqual({
      ok: false,
      error: "Choose two adjacent colors.",
    });
    expect(insertMidpointSwatch(created.value, 0, 1)).toEqual({
      ok: false,
      error: "Those colors do not have a distinct midpoint.",
    });
  });
});

describe("palette extraction", () => {
  it("keeps exact swatch colors in first-seen order", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      255, 0, 0, 255,
    ]);
    expect(extractPaletteFromPixels(pixels, 8)).toEqual({
      mode: "exact",
      colors: ["#ff0000", "#00ff00"],
    });
  });

  it("extracts the requested number from a many-color image", () => {
    const pixels = new Uint8ClampedArray(100 * 4);
    for (let index = 0; index < 100; index += 1) {
      pixels[index * 4] = index * 2;
      pixels[index * 4 + 1] = 255 - index * 2;
      pixels[index * 4 + 2] = (index * 47) % 255;
      pixels[index * 4 + 3] = 255;
    }
    const result = extractPaletteFromPixels(pixels, 8);
    expect(result.mode).toBe("extracted");
    expect(result.colors).toHaveLength(8);
  });

  it("keeps median-cut partitions non-empty with one dominant color", () => {
    const pixels = new Uint8ClampedArray(1_000 * 4);
    for (let index = 0; index < 1_000; index += 1) {
      const offset = index * 4;
      if (index < 900) {
        pixels[offset] = 245;
        pixels[offset + 1] = 240;
        pixels[offset + 2] = 230;
      } else {
        pixels[offset] = 20 + (index % 100) * 2;
        pixels[offset + 1] = 30 + ((index * 31) % 180);
        pixels[offset + 2] = 40 + ((index * 47) % 170);
      }
      pixels[offset + 3] = 255;
    }

    const result = extractPaletteFromPixels(pixels, 16);
    expect(result.colors).toHaveLength(16);
    expect(new Set(result.colors).size).toBe(16);
  });
});
