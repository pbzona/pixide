import { describe, expect, it } from "vitest";

import {
  DEFAULT_INPUT_ADJUSTMENTS,
  createSourcePreview,
  previewDimensions,
} from "@/lib/pixel";

describe("source preview", () => {
  it("caps the longest side while preserving aspect ratio without upscaling", () => {
    expect(previewDimensions(4_000, 2_000)).toEqual({
      width: 1_024,
      height: 512,
    });
    expect(previewDimensions(2_000, 4_000, 300)).toEqual({
      width: 150,
      height: 300,
    });
    expect(previewDimensions(320, 200)).toEqual({ width: 320, height: 200 });
  });

  it("returns source pixels unchanged with neutral adjustments", () => {
    const source = new Uint8ClampedArray([
      12, 34, 56, 78,
      201, 149, 97, 45,
    ]);

    const preview = createSourcePreview(source, 2, 1, undefined, true, 0);

    expect(preview.width).toBe(2);
    expect(preview.height).toBe(1);
    expect([...preview.pixels]).toEqual([...source]);
  });

  it("moves adjusted preview brightness in the direction of exposure", () => {
    const source = new Uint8ClampedArray([96, 96, 96, 255]);
    const neutral = createSourcePreview(source, 1, 1, undefined, true, 0);
    const darker = createSourcePreview(
      source,
      1,
      1,
      { ...DEFAULT_INPUT_ADJUSTMENTS, exposure: -1 },
      true,
      0,
    );
    const brighter = createSourcePreview(
      source,
      1,
      1,
      { ...DEFAULT_INPUT_ADJUSTMENTS, exposure: 1 },
      true,
      0,
    );

    expect(darker.pixels[0]).toBeLessThan(neutral.pixels[0]);
    expect(brighter.pixels[0]).toBeGreaterThan(neutral.pixels[0]);
  });

  it("applies the alpha threshold or forces opaque output", () => {
    const source = new Uint8ClampedArray([
      10, 20, 30, 127,
      40, 50, 60, 128,
    ]);

    const transparent = createSourcePreview(source, 2, 1, undefined, true, 128);
    const opaque = createSourcePreview(source, 2, 1, undefined, false, 128);

    expect([transparent.pixels[3], transparent.pixels[7]]).toEqual([0, 128]);
    expect([opaque.pixels[3], opaque.pixels[7]]).toEqual([255, 255]);
  });
});
