import { clampRgb, converter } from "culori";

import type { OklabColor, OklchColor, RgbaColor } from "./types";

const convertToRgb = converter("rgb");
const convertToOklab = converter("oklab");
const convertToOklch = converter("oklch");

const clampByte = (value: number) => Math.round(Math.min(255, Math.max(0, value)));

export const rgba = (
  r: number,
  g: number,
  b: number,
  alpha = 1,
): RgbaColor => ({
  r: clampByte(r),
  g: clampByte(g),
  b: clampByte(b),
  alpha: Math.min(1, Math.max(0, alpha)),
});

export const rgbToOklab = (color: RgbaColor): OklabColor => {
  const converted = convertToOklab({
    mode: "rgb",
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    alpha: color.alpha,
  });

  return {
    l: converted.l,
    a: converted.a,
    b: converted.b,
    alpha: converted.alpha ?? color.alpha,
  };
};

export const rgbToOklch = (color: RgbaColor): OklchColor => {
  const converted = convertToOklch({
    mode: "rgb",
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    alpha: color.alpha,
  });

  return {
    l: converted.l,
    c: converted.c,
    h: converted.h ?? 0,
    alpha: converted.alpha ?? color.alpha,
  };
};

export const oklabToRgb = (color: OklabColor): RgbaColor => {
  const converted = clampRgb(
    convertToRgb({
      mode: "oklab",
      l: color.l,
      a: color.a,
      b: color.b,
      alpha: color.alpha,
    }),
  );

  return rgba(
    converted.r * 255,
    converted.g * 255,
    converted.b * 255,
    converted.alpha ?? color.alpha,
  );
};

export const oklchToRgb = (color: OklchColor): RgbaColor => {
  const converted = clampRgb(
    convertToRgb({
      mode: "oklch",
      l: color.l,
      c: color.c,
      h: color.h,
      alpha: color.alpha,
    }),
  );

  return rgba(
    converted.r * 255,
    converted.g * 255,
    converted.b * 255,
    converted.alpha ?? color.alpha,
  );
};

export const srgbByteToLinear = (value: number): number => {
  const normalized = Math.min(255, Math.max(0, value)) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const linearToSrgbByte = (value: number): number => {
  const clamped = Math.min(1, Math.max(0, value));
  const encoded =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return clampByte(encoded * 255);
};
