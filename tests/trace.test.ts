import { describe, expect, it } from "vitest";

import { parseColor } from "@/lib/color";
import {
  convertImage,
  traceImageConversion,
  type ConversionMethod,
  type PixelPaletteColor,
} from "@/lib/pixel";
import { extractPaletteFromPixels, tracePaletteExtraction } from "@/lib/palette";

const color = (id: number, hex: string): PixelPaletteColor => {
  const parsed = parseColor(hex);
  if (!parsed.ok) throw new Error(parsed.error);
  return { id, color: parsed.value };
};

const palette = [color(10, "#000"), color(20, "#fff")] as const;

const makePattern = () => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const offset = (y * 8 + x) * 4;
      const value = (x + y) % 3 === 0 ? 240 : 64;
      pixels.set([value, value, value, 255], offset);
    }
  }
  return pixels;
};

const options = (method: ConversionMethod) => ({
  gridWidth: 4,
  gridHeight: 4,
  method,
  palette,
  preserveTransparency: true,
  alphaThreshold: 128,
});

describe("image conversion traces", () => {
  it.each<ConversionMethod>([
    "dominant",
    "average",
    "median",
    "center",
    "dither",
    "atkinson",
    "bayer",
  ])("keeps traced %s output identical to production output", (method) => {
    const pixels = makePattern();
    const production = convertImage(pixels, 8, 8, options(method));
    const traced = traceImageConversion(pixels, 8, 8, options(method));

    expect([...traced.result.colorIds]).toEqual([...production.colorIds]);
    expect(traced.cells).toHaveLength(16);
    expect(traced.cells.map((cell) => cell.index)).toEqual(
      Array.from({ length: 16 }, (_, index) => index),
    );
  });

  it("records reducer samples, votes, medians, and palette matches", () => {
    const pixels = makePattern();
    const dominant = traceImageConversion(pixels, 8, 8, options("dominant")).cells[0];
    const average = traceImageConversion(pixels, 8, 8, options("average")).cells[0];
    const median = traceImageConversion(pixels, 8, 8, options("median")).cells[0];
    const center = traceImageConversion(pixels, 8, 8, options("center")).cells[0];

    expect(dominant.details.kind).toBe("dominant");
    if (dominant.details.kind === "dominant") {
      expect(dominant.details.samples).toHaveLength(4);
      expect(dominant.details.counts.reduce((sum, count) => sum + count, 0)).toBe(4);
    }

    expect(average.details.kind).toBe("average");
    if (average.details.kind === "average") {
      expect(average.details.representativeLinear).not.toBeNull();
      expect(average.details.match?.nearestPaletteIndex).toBeTypeOf("number");
    }

    expect(median.details.kind).toBe("median");
    if (median.details.kind === "median") {
      expect(median.details.histograms.r.length).toBeGreaterThan(0);
      expect(median.details.median).not.toBeNull();
    }

    expect(center.details.kind).toBe("center");
    if (center.details.kind === "center") {
      expect(center.details.sample).toMatchObject({ x: 1, y: 1 });
    }
  });

  it("records Bayer thresholds and directional diffusion deliveries", () => {
    const pixels = makePattern();
    const bayer = traceImageConversion(pixels, 8, 8, options("bayer")).cells[0];
    const floyd = traceImageConversion(pixels, 8, 8, options("dither")).cells[0];
    const atkinson = traceImageConversion(pixels, 8, 8, options("atkinson")).cells[0];

    expect(bayer.details.kind).toBe("bayer");
    if (bayer.details.kind === "bayer") {
      expect(bayer.details.matrixValue).toBe(0);
      expect(bayer.details.threshold).toBeCloseTo(0.5 / 16);
    }

    expect(floyd.details.kind).toBe("diffusion");
    if (floyd.details.kind === "diffusion") {
      expect(floyd.details.deliveries.map((delivery) => delivery.weight)).toEqual([
        7 / 16,
        3 / 16,
        5 / 16,
        1 / 16,
      ]);
    }

    expect(atkinson.details.kind).toBe("diffusion");
    if (atkinson.details.kind === "diffusion") {
      expect(atkinson.details.deliveries).toHaveLength(6);
      expect(atkinson.details.deliveries.every((delivery) => delivery.weight === 1 / 8)).toBe(true);
    }
  });
});

describe("palette extraction traces", () => {
  it("records the exact-color path", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      255, 0, 0, 255,
    ]);
    const trace = tracePaletteExtraction(pixels, 8);

    expect(trace.result).toEqual(extractPaletteFromPixels(pixels, 8));
    expect(trace.exactColorCount).toBe(2);
    expect(trace.splits).toHaveLength(0);
  });

  it("records every weighted median-cut split", () => {
    const pixels = new Uint8ClampedArray(100 * 4);
    for (let index = 0; index < 100; index += 1) {
      pixels.set([index * 2, 255 - index * 2, (index * 47) % 255, 255], index * 4);
    }
    const trace = tracePaletteExtraction(pixels, 8, 4);

    expect(trace.result).toEqual(extractPaletteFromPixels(pixels, 8, 4));
    expect(trace.initialBox).not.toBeNull();
    expect(trace.splits).toHaveLength(7);
    expect(trace.splits.at(-1)?.boxes).toHaveLength(8);
  });
});
