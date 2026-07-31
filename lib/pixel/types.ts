import type { RgbaColor } from "@/lib/color";

export type ConversionMethod =
  | "dominant"
  | "average"
  | "median"
  | "dither"
  | "center"
  | "bayer"
  | "atkinson"
  | "blue-noise"
  | "riemersma"
  | "geometric-median";

export type InputAdjustments = Readonly<{
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
  detail: number;
}>;

export const DEFAULT_INPUT_ADJUSTMENTS: InputAdjustments = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  detail: 0,
};

export const METHOD_INHERIT = 255;
export const METHOD_DOMINANT = 0;
export const METHOD_AVERAGE = 1;
export const METHOD_MEDIAN = 2;
export const METHOD_DITHER = 3;
export const METHOD_CENTER = 4;
export const METHOD_BAYER = 5;
export const METHOD_ATKINSON = 6;
export const METHOD_BLUE_NOISE = 7;
export const METHOD_RIEMERSMA = 8;
export const METHOD_GEOMETRIC_MEDIAN = 9;

export const conversionMethodCode = (method: ConversionMethod): number => {
  switch (method) {
    case "dominant":
      return METHOD_DOMINANT;
    case "average":
      return METHOD_AVERAGE;
    case "median":
      return METHOD_MEDIAN;
    case "dither":
      return METHOD_DITHER;
    case "center":
      return METHOD_CENTER;
    case "bayer":
      return METHOD_BAYER;
    case "atkinson":
      return METHOD_ATKINSON;
    case "blue-noise":
      return METHOD_BLUE_NOISE;
    case "riemersma":
      return METHOD_RIEMERSMA;
    case "geometric-median":
      return METHOD_GEOMETRIC_MEDIAN;
  }
};

export const conversionMethodFromCode = (code: number): ConversionMethod => {
  switch (code) {
    case METHOD_DOMINANT:
      return "dominant";
    case METHOD_AVERAGE:
      return "average";
    case METHOD_MEDIAN:
      return "median";
    case METHOD_DITHER:
      return "dither";
    case METHOD_CENTER:
      return "center";
    case METHOD_BAYER:
      return "bayer";
    case METHOD_ATKINSON:
      return "atkinson";
    case METHOD_BLUE_NOISE:
      return "blue-noise";
    case METHOD_RIEMERSMA:
      return "riemersma";
    case METHOD_GEOMETRIC_MEDIAN:
      return "geometric-median";
    default:
      throw new RangeError(`Unknown conversion method code: ${code}`);
  }
};

export type PixelPaletteColor = Readonly<{
  id: number;
  color: RgbaColor;
}>;

export type ConversionOptions = Readonly<{
  gridWidth: number;
  gridHeight: number;
  method: ConversionMethod;
  methodOverrides?: Uint8Array;
  palette: readonly PixelPaletteColor[];
  preserveTransparency: boolean;
  alphaThreshold: number;
  inputAdjustments?: InputAdjustments;
}>;

export type ConversionResult = Readonly<{
  width: number;
  height: number;
  colorIds: Uint16Array;
}>;

export const TRANSPARENT_COLOR_ID = 65_535;
export const NO_OVERRIDE_COLOR_ID = -1;
export const MIN_GRID_SIDE = 4;
export const MAX_GRID_SIDE = 512;
export const MAX_EXPORT_SIDE = 8_192;
export const MAX_EXPORT_PIXELS = 40_000_000;
