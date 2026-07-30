import type { PaletteExtraction } from "@/lib/palette";

import type { ConversionOptions, InputAdjustments } from "./types";

export type PixelWorkerRequest =
  | Readonly<{
      type: "set-source";
      requestId: number;
      width: number;
      height: number;
      pixels: ArrayBuffer;
    }>
  | Readonly<{
      type: "convert";
      requestId: number;
      options: ConversionOptions;
    }>
  | Readonly<{
      type: "preview";
      requestId: number;
      adjustments: InputAdjustments;
      preserveTransparency: boolean;
      alphaThreshold: number;
    }>
  | Readonly<{
      type: "extract-palette";
      requestId: number;
      pixels: ArrayBuffer;
      colorCount: number;
    }>;

export type PixelWorkerResponse =
  | Readonly<{
      type: "source-ready";
      requestId: number;
      previewWidth: number;
      previewHeight: number;
      previewPixels: ArrayBuffer;
    }>
  | Readonly<{
      type: "converted";
      requestId: number;
      width: number;
      height: number;
      colorIds: ArrayBuffer;
    }>
  | Readonly<{
      type: "previewed";
      requestId: number;
      width: number;
      height: number;
      pixels: ArrayBuffer;
    }>
  | Readonly<{
      type: "palette-extracted";
      requestId: number;
      extraction: PaletteExtraction;
    }>
  | Readonly<{ type: "error"; requestId: number; message: string }>;
