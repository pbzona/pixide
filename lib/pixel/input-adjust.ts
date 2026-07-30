import { linearToSrgbByte, srgbByteToLinear } from "@/lib/color";

import { DEFAULT_INPUT_ADJUSTMENTS, type InputAdjustments } from "./types";

export type InputSample = {
  r: number;
  g: number;
  b: number;
  linearR: number;
  linearG: number;
  linearB: number;
  alpha: number;
};

export type InputSampler = Readonly<{
  sample: (x: number, y: number, target: InputSample) => void;
}>;

const LINEAR_BYTES = Float32Array.from({ length: 256 }, (_, value) =>
  srgbByteToLinear(value),
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const normalizeInputAdjustments = (
  adjustments: InputAdjustments | undefined,
): InputAdjustments => adjustments ?? DEFAULT_INPUT_ADJUSTMENTS;

export const inputAdjustmentsChanged = (adjustments: InputAdjustments): boolean =>
  adjustments.exposure !== 0 ||
  adjustments.contrast !== 0 ||
  adjustments.saturation !== 0 ||
  adjustments.temperature !== 0 ||
  adjustments.detail !== 0;

export const createInputSampler = (
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  adjustmentsValue?: InputAdjustments,
  alphaAwareDetail = true,
): InputSampler => {
  const adjustments = normalizeInputAdjustments(adjustmentsValue);
  const changed = inputAdjustmentsChanged(adjustments);
  const detail = Math.min(1, Math.abs(adjustments.detail) / 100);
  const exposure = 2 ** adjustments.exposure;
  const warmth = adjustments.temperature / 100;
  const warmRed = 2 ** (warmth * 0.45);
  const warmBlue = 2 ** (-warmth * 0.45);
  const saturation = Math.max(0, 1 + adjustments.saturation / 100);
  const contrast = Math.max(0, 1 + adjustments.contrast / 100);
  const midpoint = 0.18;

  return {
    sample(x, y, target) {
      const offset = (y * width + x) * 4;
      const alpha = pixels[offset + 3];
      if (!changed) {
        target.r = pixels[offset];
        target.g = pixels[offset + 1];
        target.b = pixels[offset + 2];
        target.linearR = LINEAR_BYTES[target.r];
        target.linearG = LINEAR_BYTES[target.g];
        target.linearB = LINEAR_BYTES[target.b];
        target.alpha = alpha;
        return;
      }

      let centerR = LINEAR_BYTES[pixels[offset]];
      let centerG = LINEAR_BYTES[pixels[offset + 1]];
      let centerB = LINEAR_BYTES[pixels[offset + 2]];

      if (detail > 0) {
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let totalWeight = 0;
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            const sampleX = Math.min(width - 1, Math.max(0, x + offsetX));
            const sampleY = Math.min(height - 1, Math.max(0, y + offsetY));
            const sampleOffset = (sampleY * width + sampleX) * 4;
            const kernelWeight = (offsetX === 0 ? 2 : 1) * (offsetY === 0 ? 2 : 1);
            const alphaWeight = alphaAwareDetail ? pixels[sampleOffset + 3] / 255 : 1;
            const weight = kernelWeight * alphaWeight;
            sumR += LINEAR_BYTES[pixels[sampleOffset]] * weight;
            sumG += LINEAR_BYTES[pixels[sampleOffset + 1]] * weight;
            sumB += LINEAR_BYTES[pixels[sampleOffset + 2]] * weight;
            totalWeight += weight;
          }
        }
        if (totalWeight > 0) {
          const blurredR = sumR / totalWeight;
          const blurredG = sumG / totalWeight;
          const blurredB = sumB / totalWeight;
          const direction = adjustments.detail < 0 ? 1 : -1;
          centerR += (blurredR - centerR) * detail * direction;
          centerG += (blurredG - centerG) * detail * direction;
          centerB += (blurredB - centerB) * detail * direction;
        }
      }

      let nextR = centerR * exposure * warmRed;
      let nextG = centerG * exposure;
      let nextB = centerB * exposure * warmBlue;
      const luminance = nextR * 0.2126 + nextG * 0.7152 + nextB * 0.0722;
      nextR = luminance + (nextR - luminance) * saturation;
      nextG = luminance + (nextG - luminance) * saturation;
      nextB = luminance + (nextB - luminance) * saturation;
      target.linearR = clamp01(midpoint + (nextR - midpoint) * contrast);
      target.linearG = clamp01(midpoint + (nextG - midpoint) * contrast);
      target.linearB = clamp01(midpoint + (nextB - midpoint) * contrast);
      target.r = linearToSrgbByte(target.linearR);
      target.g = linearToSrgbByte(target.linearG);
      target.b = linearToSrgbByte(target.linearB);
      target.alpha = alpha;
    },
  };
};
