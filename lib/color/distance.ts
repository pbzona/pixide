import { rgbToOklab } from "./conversion";
import type { OklabColor, RgbaColor } from "./types";

export const oklabDistanceSquared = (a: OklabColor, b: OklabColor): number =>
  (a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2;

export const colorDistanceSquared = (a: RgbaColor, b: RgbaColor): number =>
  oklabDistanceSquared(rgbToOklab(a), rgbToOklab(b));

export const nearestColorIndex = (
  color: RgbaColor,
  palette: readonly RgbaColor[],
): number => {
  if (palette.length === 0) return -1;

  const target = rgbToOklab(color);
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < palette.length; index += 1) {
    const distance = oklabDistanceSquared(target, rgbToOklab(palette[index]));
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }

  return nearestIndex;
};
