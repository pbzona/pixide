import { describe, expect, it } from "vitest";

import { parseColor } from "@/lib/color";
import {
  METHOD_ATKINSON,
  METHOD_AVERAGE,
  METHOD_BAYER,
  METHOD_BLUE_NOISE,
  METHOD_CENTER,
  METHOD_DITHER,
  METHOD_DOMINANT,
  METHOD_GEOMETRIC_MEDIAN,
  METHOD_INHERIT,
  METHOD_MEDIAN,
  METHOD_RIEMERSMA,
  TRANSPARENT_COLOR_ID,
  convertImage,
  dimensionsForAspect,
  getGuidePositions,
  type ConversionMethod,
  type PixelPaletteColor,
} from "@/lib/pixel";

const color = (id: number, hex: string): PixelPaletteColor => {
  const parsed = parseColor(hex);
  if (!parsed.ok) throw new Error(parsed.error);
  return { id, color: parsed.value };
};

const palette = [color(10, "#000"), color(20, "#fff")] as const;

const makeCellPattern = (whiteSamples: number) => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let gridY = 0; gridY < 4; gridY += 1) {
    for (let gridX = 0; gridX < 4; gridX += 1) {
      for (let sample = 0; sample < 4; sample += 1) {
        const x = gridX * 2 + (sample % 2);
        const y = gridY * 2 + Math.floor(sample / 2);
        const offset = (y * 8 + x) * 4;
        const value = sample < whiteSamples ? 255 : 0;
        pixels[offset] = value;
        pixels[offset + 1] = value;
        pixels[offset + 2] = value;
        pixels[offset + 3] = 255;
      }
    }
  }
  return pixels;
};

const convert = (pixels: Uint8ClampedArray, method: ConversionMethod) =>
  convertImage(pixels, 8, 8, {
    gridWidth: 4,
    gridHeight: 4,
    method,
    palette,
    preserveTransparency: true,
    alphaThreshold: 128,
  }).colorIds;

const conversionOptions = (
  method: ConversionMethod,
  methodOverrides?: Uint8Array,
) => ({
  gridWidth: 4,
  gridHeight: 4,
  method,
  methodOverrides,
  palette,
  preserveTransparency: true,
  alphaThreshold: 128,
});

describe("pixel conversion", () => {
  it("uses the most frequent quantized palette color for dominant vote", () => {
    expect([...convert(makeCellPattern(3), "dominant")]).toEqual(Array(16).fill(20));
  });

  it("uses the channel median without being pulled by one highlight", () => {
    expect([...convert(makeCellPattern(1), "median")]).toEqual(Array(16).fill(10));
  });

  it("produces both palette colors when dithering a middle tone", () => {
    const result = new Set(convert(makeCellPattern(2), "dither"));
    expect(result).toEqual(new Set([10, 20]));
  });

  it("samples the source cell center without averaging surrounding pixels", () => {
    expect([...convert(makeCellPattern(3), "center")]).toEqual(Array(16).fill(10));
  });

  it("uses a stable 4x4 Bayer pattern between neighboring palette colors", () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let index = 0; index < 8 * 8; index += 1) {
      pixels.set([188, 188, 188, 255], index * 4);
    }

    expect([...convert(pixels, "bayer")]).toEqual([
      10, 20, 10, 20,
      20, 10, 20, 10,
      10, 20, 10, 20,
      20, 10, 20, 10,
    ]);
  });

  it("produces a lighter two-color Atkinson diffusion pattern", () => {
    expect(new Set(convert(makeCellPattern(2), "atkinson"))).toEqual(
      new Set([10, 20]),
    );
  });

  it("uses a deterministic irregular threshold pattern for blue-noise dithering", () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4);
    for (let index = 0; index < 8 * 8; index += 1) {
      pixels.set([137, 137, 137, 255], index * 4);
    }
    const blueNoiseOptions = {
      ...conversionOptions("blue-noise"),
      gridWidth: 8,
      gridHeight: 8,
    };
    const bayerOptions = { ...blueNoiseOptions, method: "bayer" as const };
    const first = [...convertImage(pixels, 8, 8, blueNoiseOptions).colorIds];
    const second = [...convertImage(pixels, 8, 8, blueNoiseOptions).colorIds];

    expect(first).toEqual(second);
    expect(new Set(first)).toEqual(new Set([10, 20]));
    expect(first).not.toEqual([...convertImage(pixels, 8, 8, bayerOptions).colorIds]);
  });

  it("follows a Hilbert path for Riemersma error diffusion", () => {
    const result = convert(makeCellPattern(2), "riemersma");
    expect(new Set(result)).toEqual(new Set([10, 20]));
  });

  it("uses an OKLab geometric median that resists one bright outlier", () => {
    expect([...convert(makeCellPattern(1), "geometric-median")]).toEqual(
      Array(16).fill(10),
    );
    expect([...convert(makeCellPattern(1), "average")]).toEqual(
      Array(16).fill(20),
    );
  });

  it("preserves fully transparent cells", () => {
    const result = convert(new Uint8ClampedArray(8 * 8 * 4), "average");
    expect([...result]).toEqual(Array(16).fill(TRANSPARENT_COLOR_ID));
  });

  it("validates method override dimensions and codes", () => {
    const pixels = makeCellPattern(1);
    expect(() =>
      convertImage(pixels, 8, 8, {
        ...conversionOptions("average"),
        methodOverrides: new Uint8Array(15),
      }),
    ).toThrowError("Method overrides must match the output grid dimensions.");

    const invalidOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    invalidOverrides[5] = METHOD_GEOMETRIC_MEDIAN + 1;
    expect(() =>
      convertImage(pixels, 8, 8, {
        ...conversionOptions("average"),
        methodOverrides: invalidOverrides,
      }),
    ).toThrowError(`Unknown conversion method code: ${METHOD_GEOMETRIC_MEDIAN + 1}.`);
  });

  it("selects conversion methods independently for mixed cells", () => {
    const methodOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    methodOverrides.set(
      [METHOD_DOMINANT, METHOD_MEDIAN, METHOD_DITHER, METHOD_DITHER],
      0,
    );

    const result = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides,
    }).colorIds;

    expect([...result]).toEqual([
      10, 10, 20, 10,
      ...Array(12).fill(20),
    ]);
  });

  it("does not carry Floyd-Steinberg error across a non-dither cell", () => {
    const adjacentOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    adjacentOverrides.set([METHOD_DITHER, METHOD_DITHER], 0);
    const adjacent = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: adjacentOverrides,
    }).colorIds;

    const separatedOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    separatedOverrides.set([METHOD_DITHER, METHOD_AVERAGE, METHOD_DITHER], 0);
    const separated = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: separatedOverrides,
    }).colorIds;

    expect([...adjacent.slice(0, 2)]).toEqual([20, 10]);
    expect([...separated.slice(0, 3)]).toEqual([20, 20, 20]);
  });

  it("does not jump Atkinson error across a non-Atkinson cell", () => {
    const isolatedOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    isolatedOverrides[2] = METHOD_ATKINSON;
    const isolated = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: isolatedOverrides,
    }).colorIds;

    const separatedOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    separatedOverrides.set([METHOD_ATKINSON, METHOD_AVERAGE, METHOD_ATKINSON], 0);
    const separated = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: separatedOverrides,
    }).colorIds;

    expect(separated[2]).toBe(isolated[2]);
  });

  it("clears Riemersma history at a non-Riemersma cell", () => {
    const isolatedOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    isolatedOverrides[5] = METHOD_RIEMERSMA;
    const isolated = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: isolatedOverrides,
    }).colorIds;

    const separatedOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    separatedOverrides[0] = METHOD_RIEMERSMA;
    separatedOverrides[5] = METHOD_RIEMERSMA;
    const separated = convertImage(makeCellPattern(1), 8, 8, {
      ...conversionOptions("average"),
      methodOverrides: separatedOverrides,
    }).colorIds;

    expect(separated[5]).toBe(isolated[5]);
  });

  it("accepts every regional method code", () => {
    const methodOverrides = new Uint8Array(16).fill(METHOD_INHERIT);
    methodOverrides.set(
      [
        METHOD_CENTER,
        METHOD_BAYER,
        METHOD_ATKINSON,
        METHOD_BLUE_NOISE,
        METHOD_RIEMERSMA,
        METHOD_GEOMETRIC_MEDIAN,
      ],
      0,
    );

    expect(() =>
      convertImage(makeCellPattern(2), 8, 8, {
        ...conversionOptions("average"),
        methodOverrides,
      }),
    ).not.toThrow();
  });
});

describe("grid dimensions", () => {
  it("rounds the linked side from source aspect ratio", () => {
    expect(dimensionsForAspect("width", 64, 1920, 1080)).toEqual({
      width: 64,
      height: 36,
    });
    expect(dimensionsForAspect("height", 40, 1200, 1600)).toEqual({
      width: 30,
      height: 40,
    });
  });

  it("creates only interior composition guide positions", () => {
    expect(getGuidePositions(3)[0]).toBeCloseTo(100 / 3);
    expect(getGuidePositions(3)[1]).toBeCloseTo(200 / 3);
    expect(getGuidePositions(10)).toHaveLength(9);
    expect(getGuidePositions(10)[0]).toBe(10);
    expect(getGuidePositions(10).at(-1)).toBe(90);
  });
});
