import { createInputSampler, type InputSample } from "./input-adjust";
import type { InputAdjustments } from "./types";

export type PixelPreview = Readonly<{
  width: number;
  height: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
}>;

export const previewDimensions = (
  width: number,
  height: number,
  maxSide = 1_024,
): Readonly<{ width: number; height: number }> => {
  if (width < 1 || height < 1 || maxSide < 1) {
    throw new RangeError("Preview dimensions must be positive.");
  }
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const createSourcePreview = (
  sourcePixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  adjustments: InputAdjustments | undefined,
  preserveTransparency: boolean,
  alphaThreshold: number,
  maxSide = 1_024,
): PixelPreview => {
  if (sourcePixels.length !== sourceWidth * sourceHeight * 4) {
    throw new RangeError("Source pixel data does not match its dimensions.");
  }
  const dimensions = previewDimensions(sourceWidth, sourceHeight, maxSide);
  const pixels = new Uint8ClampedArray(dimensions.width * dimensions.height * 4);
  const sampler = createInputSampler(
    sourcePixels,
    sourceWidth,
    sourceHeight,
    adjustments,
    preserveTransparency,
  );
  const sample: InputSample = {
    r: 0,
    g: 0,
    b: 0,
    linearR: 0,
    linearG: 0,
    linearB: 0,
    alpha: 0,
  };

  for (let y = 0; y < dimensions.height; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor(((y + 0.5) * sourceHeight) / dimensions.height),
    );
    for (let x = 0; x < dimensions.width; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor(((x + 0.5) * sourceWidth) / dimensions.width),
      );
      sampler.sample(sourceX, sourceY, sample);
      const offset = (y * dimensions.width + x) * 4;
      pixels[offset] = sample.r;
      pixels[offset + 1] = sample.g;
      pixels[offset + 2] = sample.b;
      pixels[offset + 3] = preserveTransparency
        ? sample.alpha < alphaThreshold
          ? 0
          : sample.alpha
        : 255;
    }
  }

  return { ...dimensions, pixels };
};
