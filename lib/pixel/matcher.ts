import {
  oklabDistanceSquared,
  rgbToOklab,
  rgba,
  srgbByteToLinear,
} from "@/lib/color";

import type { PixelPaletteColor } from "./types";

export type PaletteMatcher = Readonly<{
  paletteLabs: readonly ReturnType<typeof rgbToOklab>[];
  paletteLinear: readonly Readonly<{ r: number; g: number; b: number }>[];
  match: (r: number, g: number, b: number) => number;
  second: (r: number, g: number, b: number) => number;
  inspect: (r: number, g: number, b: number) => PaletteMatchInspection;
}>;

export type PaletteMatchInspection = Readonly<{
  input: Readonly<{ r: number; g: number; b: number }>;
  lookupColor: Readonly<{ r: number; g: number; b: number }>;
  nearestPaletteIndex: number;
  secondPaletteIndex: number;
  distances: readonly number[];
}>;

const LUT_SIDE = 32;
const LUT_SIZE = LUT_SIDE ** 3;

const lookupIndex = (r: number, g: number, b: number) =>
  (r >> 3) * LUT_SIDE * LUT_SIDE + (g >> 3) * LUT_SIDE + (b >> 3);

export const createPaletteMatcher = (
  palette: readonly PixelPaletteColor[],
): PaletteMatcher => {
  const paletteLabs = palette.map((entry) => rgbToOklab(entry.color));
  const paletteLinear = palette.map((entry) => ({
    r: srgbByteToLinear(entry.color.r),
    g: srgbByteToLinear(entry.color.g),
    b: srgbByteToLinear(entry.color.b),
  }));
  const lookup = new Uint16Array(LUT_SIZE);
  const secondLookup = new Uint16Array(LUT_SIZE);

  for (let r = 0; r < LUT_SIDE; r += 1) {
    for (let g = 0; g < LUT_SIDE; g += 1) {
      for (let b = 0; b < LUT_SIDE; b += 1) {
        const lab = rgbToOklab(
          rgba((r * 255) / 31, (g * 255) / 31, (b * 255) / 31),
        );
        let bestIndex = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        let secondIndex = 0;
        let secondDistance = Number.POSITIVE_INFINITY;
        for (let index = 0; index < paletteLabs.length; index += 1) {
          const distance = oklabDistanceSquared(lab, paletteLabs[index]);
          if (distance < bestDistance) {
            secondDistance = bestDistance;
            secondIndex = bestIndex;
            bestDistance = distance;
            bestIndex = index;
          } else if (distance < secondDistance) {
            secondDistance = distance;
            secondIndex = index;
          }
        }
        const lookupOffset = r * LUT_SIDE * LUT_SIDE + g * LUT_SIDE + b;
        lookup[lookupOffset] = bestIndex;
        secondLookup[lookupOffset] = secondIndex;
      }
    }
  }

  return {
    paletteLabs,
    paletteLinear,
    match: (r, g, b) => lookup[lookupIndex(r, g, b)],
    second: (r, g, b) => secondLookup[lookupIndex(r, g, b)],
    inspect: (r, g, b) => {
      const lookupR = r >> 3;
      const lookupG = g >> 3;
      const lookupB = b >> 3;
      const lookupColor = {
        r: (lookupR * 255) / 31,
        g: (lookupG * 255) / 31,
        b: (lookupB * 255) / 31,
      };
      const lab = rgbToOklab(rgba(lookupColor.r, lookupColor.g, lookupColor.b));
      const offset = lookupIndex(r, g, b);
      return {
        input: { r, g, b },
        lookupColor,
        nearestPaletteIndex: lookup[offset],
        secondPaletteIndex: secondLookup[offset],
        distances: paletteLabs.map((paletteLab) => oklabDistanceSquared(lab, paletteLab)),
      };
    },
  };
};
