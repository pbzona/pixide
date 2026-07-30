export type RgbaColor = Readonly<{
  r: number;
  g: number;
  b: number;
  alpha: number;
}>;

export type OklabColor = Readonly<{
  l: number;
  a: number;
  b: number;
  alpha: number;
}>;

export type OklchColor = Readonly<{
  l: number;
  c: number;
  h: number;
  alpha: number;
}>;

export type PaletteAdjustments = Readonly<{
  hue: number;
  saturation: number;
  lightness: number;
  contrast: number;
}>;

export type Result<T, E = string> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: E }>;

export const DEFAULT_PALETTE_ADJUSTMENTS: PaletteAdjustments = {
  hue: 0,
  saturation: 0,
  lightness: 0,
  contrast: 0,
};
