import { normalizePaletteColors } from "./create";
import type { Result } from "@/lib/color";

const validateEntries = (
  entries: readonly unknown[],
  describeIndex: (index: number) => string,
): Result<readonly string[]> => {
  const colors: string[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (typeof entry !== "string") {
      return {
        ok: false,
        error: `${describeIndex(index)} must be a CSS color string.`,
      };
    }
    colors.push(entry.trim());
  }

  return normalizePaletteColors(colors);
};

export const parseJsonPalette = (contents: string): Result<readonly string[]> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: "JSON palettes must be an array of color strings." };
  }

  return validateEntries(parsed, (index) => `Item ${index + 1}`);
};

export const parseTextPalette = (contents: string): Result<readonly string[]> => {
  const entries = contents
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  return validateEntries(entries, (index) => `Line ${index + 1}`);
};

export const parsePaletteContents = (
  contents: string,
  fileName: string,
): Result<readonly string[]> =>
  fileName.toLowerCase().endsWith(".json")
    ? parseJsonPalette(contents)
    : parseTextPalette(contents);
