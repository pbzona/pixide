import type { PixelPaletteColor } from "./types";
import { NO_OVERRIDE_COLOR_ID, TRANSPARENT_COLOR_ID } from "./types";

export const composeColorIds = (
  generated: Uint16Array,
  overrides: Int32Array,
): Uint16Array => {
  if (generated.length !== overrides.length) {
    throw new Error("Generated pixels and overrides must have the same dimensions.");
  }

  const output = generated.slice();
  for (let index = 0; index < output.length; index += 1) {
    if (overrides[index] !== NO_OVERRIDE_COLOR_ID) output[index] = overrides[index];
  }
  return output;
};

export const colorIdsToRgba = (
  colorIds: Uint16Array,
  palette: readonly PixelPaletteColor[],
  visibleColorIds: ReadonlySet<number> | null = null,
): Uint8ClampedArray<ArrayBuffer> => {
  const lookup = new Map(palette.map((entry) => [entry.id, entry.color]));
  const pixels = new Uint8ClampedArray(colorIds.length * 4);

  for (let index = 0; index < colorIds.length; index += 1) {
    const offset = index * 4;
    if (colorIds[index] === TRANSPARENT_COLOR_ID) continue;
    if (visibleColorIds && !visibleColorIds.has(colorIds[index])) continue;
    const color = lookup.get(colorIds[index]);
    if (!color) continue;
    pixels[offset] = color.r;
    pixels[offset + 1] = color.g;
    pixels[offset + 2] = color.b;
    pixels[offset + 3] = Math.round(color.alpha * 255);
  }

  return pixels;
};
