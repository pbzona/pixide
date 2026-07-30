import type { ConversionMethod } from "./types";

export type ConversionMethodDefinition = Readonly<{
  value: ConversionMethod;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  family: "sample" | "reducer" | "diffusion" | "ordered";
}>;

export const CONVERSION_METHODS: readonly ConversionMethodDefinition[] = [
  {
    value: "dominant",
    slug: "dominant-vote",
    label: "Dominant vote",
    shortLabel: "Dominant",
    description: "Uses the most frequent palette color in each cell",
    family: "reducer",
  },
  {
    value: "average",
    slug: "average",
    label: "Average",
    shortLabel: "Average",
    description: "Uses a linear RGB mean",
    family: "reducer",
  },
  {
    value: "median",
    slug: "median",
    label: "Median",
    shortLabel: "Median",
    description: "Uses the median of each RGB channel",
    family: "reducer",
  },
  {
    value: "center",
    slug: "center-sample",
    label: "Center sample",
    shortLabel: "Center",
    description: "Uses the source pixel at the cell center",
    family: "sample",
  },
  {
    value: "dither",
    slug: "floyd-steinberg",
    label: "Floyd-Steinberg",
    shortLabel: "Floyd-Steinberg",
    description: "Sends color error to four nearby cells",
    family: "diffusion",
  },
  {
    value: "atkinson",
    slug: "atkinson",
    label: "Atkinson",
    shortLabel: "Atkinson",
    description: "Sends 75 percent of color error to six nearby cells",
    family: "diffusion",
  },
  {
    value: "bayer",
    slug: "ordered-dither",
    label: "Ordered dither",
    shortLabel: "Bayer 4x4",
    description: "Uses a fixed 4x4 threshold matrix",
    family: "ordered",
  },
];

export const conversionMethodDefinition = (
  method: ConversionMethod,
): ConversionMethodDefinition => {
  const definition = CONVERSION_METHODS.find((entry) => entry.value === method);
  if (!definition) throw new RangeError(`Unknown conversion method: ${method}`);
  return definition;
};
