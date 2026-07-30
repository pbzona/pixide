import { converter, formatHex, formatHex8, parse } from "culori";

import { rgba } from "./conversion";
import type { Result, RgbaColor } from "./types";

const convertToRgb = converter("rgb");

export const parseColor = (input: string): Result<RgbaColor> => {
  const parsed = parse(input.trim());
  if (!parsed) {
    return { ok: false, error: `“${input}” is not a valid CSS color.` };
  }

  const converted = convertToRgb(parsed);
  return {
    ok: true,
    value: rgba(
      converted.r * 255,
      converted.g * 255,
      converted.b * 255,
      converted.alpha ?? 1,
    ),
  };
};

export const formatColorHex = (color: RgbaColor, includeAlpha = false): string => {
  const culoriColor = {
    mode: "rgb" as const,
    r: color.r / 255,
    g: color.g / 255,
    b: color.b / 255,
    alpha: color.alpha,
  };

  return includeAlpha ? formatHex8(culoriColor) : formatHex(culoriColor);
};

export const normalizeColor = (input: string): Result<string> => {
  const parsed = parseColor(input);
  return parsed.ok
    ? { ok: true, value: formatColorHex(parsed.value, parsed.value.alpha < 1) }
    : parsed;
};
