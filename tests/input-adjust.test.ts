import { describe, expect, it } from "vitest";

import { srgbByteToLinear } from "@/lib/color";
import {
  DEFAULT_INPUT_ADJUSTMENTS,
  createInputSampler,
  type InputAdjustments,
  type InputSample,
} from "@/lib/pixel";

const sampleAt = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  adjustmentOverrides?: Partial<InputAdjustments>,
  alphaAwareDetail = true,
): InputSample => {
  const target: InputSample = {
    r: 0,
    g: 0,
    b: 0,
    linearR: 0,
    linearG: 0,
    linearB: 0,
    alpha: 0,
  };
  const adjustments = adjustmentOverrides
    ? { ...DEFAULT_INPUT_ADJUSTMENTS, ...adjustmentOverrides }
    : undefined;
  createInputSampler(pixels, width, height, adjustments, alphaAwareDetail).sample(
    x,
    y,
    target,
  );
  return target;
};

describe("input adjustment sampler", () => {
  it("returns source samples unchanged when adjustments are neutral", () => {
    const pixels = new Uint8ClampedArray([
      12, 34, 56, 78,
      201, 149, 97, 45,
    ]);

    const first = sampleAt(pixels, 2, 1, 0, 0);
    const second = sampleAt(pixels, 2, 1, 1, 0);

    expect([first.r, first.g, first.b, first.alpha]).toEqual([12, 34, 56, 78]);
    expect([second.r, second.g, second.b, second.alpha]).toEqual([201, 149, 97, 45]);
    expect(first.linearR).toBeCloseTo(srgbByteToLinear(12), 6);
    expect(first.linearG).toBeCloseTo(srgbByteToLinear(34), 6);
    expect(first.linearB).toBeCloseTo(srgbByteToLinear(56), 6);
  });

  it("moves brightness in the direction of signed exposure", () => {
    const pixels = new Uint8ClampedArray([96, 96, 96, 255]);
    const darker = sampleAt(pixels, 1, 1, 0, 0, { exposure: -1 });
    const neutral = sampleAt(pixels, 1, 1, 0, 0);
    const brighter = sampleAt(pixels, 1, 1, 0, 0, { exposure: 1 });

    expect(darker.r).toBeLessThan(neutral.r);
    expect(brighter.r).toBeGreaterThan(neutral.r);
    expect([darker.r, darker.g, darker.b]).toEqual(Array(3).fill(darker.r));
    expect([brighter.r, brighter.g, brighter.b]).toEqual(Array(3).fill(brighter.r));
  });

  it("reduces channel separation when saturation is lowered", () => {
    const pixels = new Uint8ClampedArray([200, 80, 40, 255]);
    const neutral = sampleAt(pixels, 1, 1, 0, 0);
    const desaturated = sampleAt(pixels, 1, 1, 0, 0, { saturation: -100 });
    const neutralRange = Math.max(neutral.r, neutral.g, neutral.b) - Math.min(neutral.r, neutral.g, neutral.b);
    const desaturatedRange =
      Math.max(desaturated.r, desaturated.g, desaturated.b) -
      Math.min(desaturated.r, desaturated.g, desaturated.b);

    expect(desaturatedRange).toBeLessThan(neutralRange);
    expect([desaturated.r, desaturated.g, desaturated.b]).toEqual(
      Array(3).fill(desaturated.r),
    );
  });

  it("warms toward red and cools toward blue", () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const neutral = sampleAt(pixels, 1, 1, 0, 0);
    const warm = sampleAt(pixels, 1, 1, 0, 0, { temperature: 100 });
    const cool = sampleAt(pixels, 1, 1, 0, 0, { temperature: -100 });

    expect(warm.r).toBeGreaterThan(neutral.r);
    expect(warm.b).toBeLessThan(neutral.b);
    expect(cool.r).toBeLessThan(neutral.r);
    expect(cool.b).toBeGreaterThan(neutral.b);
  });

  it("blurs with negative detail and sharpens with positive detail", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let index = 0; index < 9; index += 1) {
      const offset = index * 4;
      const value = index === 4 ? 128 : 64;
      pixels[offset] = value;
      pixels[offset + 1] = value;
      pixels[offset + 2] = value;
      pixels[offset + 3] = 255;
    }

    const blurred = sampleAt(pixels, 3, 3, 1, 1, { detail: -100 });
    const neutral = sampleAt(pixels, 3, 3, 1, 1);
    const sharpened = sampleAt(pixels, 3, 3, 1, 1, { detail: 100 });

    expect(blurred.r).toBeLessThan(neutral.r);
    expect(sharpened.r).toBeGreaterThan(neutral.r);
    expect([blurred.r, blurred.g, blurred.b]).toEqual(Array(3).fill(blurred.r));
    expect([sharpened.r, sharpened.g, sharpened.b]).toEqual(
      Array(3).fill(sharpened.r),
    );
  });

  it("preserves alpha and ignores transparent RGB during edge detail", () => {
    const pixels = new Uint8ClampedArray(3 * 3 * 4);
    for (let index = 0; index < 9; index += 1) {
      pixels.set([255, 0, 255, 0], index * 4);
    }
    pixels.set([80, 120, 160, 173], 4 * 4);

    for (const detail of [-100, 100]) {
      const center = sampleAt(pixels, 3, 3, 1, 1, { detail }, true);
      expect([center.r, center.g, center.b, center.alpha]).toEqual([
        80, 120, 160, 173,
      ]);
    }

    const transparentEdge = sampleAt(pixels, 3, 3, 0, 1, { detail: -100 }, true);
    expect(transparentEdge.alpha).toBe(0);
  });
});
