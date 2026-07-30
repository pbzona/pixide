/// <reference lib="webworker" />

import { extractPaletteFromPixels } from "@/lib/palette";
import {
  DEFAULT_INPUT_ADJUSTMENTS,
  convertImage,
  createSourcePreview,
  type PixelWorkerRequest,
  type PixelWorkerResponse,
} from "@/lib/pixel";

let sourcePixels: Uint8ClampedArray | null = null;
let sourceWidth = 0;
let sourceHeight = 0;

const respond = (response: PixelWorkerResponse, transfer: Transferable[] = []) => {
  self.postMessage(response, { transfer });
};

self.onmessage = (event: MessageEvent<PixelWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "set-source") {
      sourcePixels = new Uint8ClampedArray(request.pixels);
      sourceWidth = request.width;
      sourceHeight = request.height;
      const preview = createSourcePreview(
        sourcePixels,
        sourceWidth,
        sourceHeight,
        DEFAULT_INPUT_ADJUSTMENTS,
        true,
        0,
      );
      const previewPixels = preview.pixels.buffer as ArrayBuffer;
      respond(
        {
          type: "source-ready",
          requestId: request.requestId,
          previewWidth: preview.width,
          previewHeight: preview.height,
          previewPixels,
        },
        [previewPixels],
      );
      return;
    }

    if (request.type === "convert") {
      if (!sourcePixels) throw new Error("Upload a source image first.");
      const result = convertImage(
        sourcePixels,
        sourceWidth,
        sourceHeight,
        request.options,
      );
      const colorIds = result.colorIds.buffer as ArrayBuffer;
      respond(
        {
          type: "converted",
          requestId: request.requestId,
          width: result.width,
          height: result.height,
          colorIds,
        },
        [colorIds],
      );
      return;
    }

    if (request.type === "preview") {
      if (!sourcePixels) throw new Error("Upload a source image first.");
      const preview = createSourcePreview(
        sourcePixels,
        sourceWidth,
        sourceHeight,
        request.adjustments,
        request.preserveTransparency,
        request.alphaThreshold,
      );
      const pixels = preview.pixels.buffer as ArrayBuffer;
      respond(
        {
          type: "previewed",
          requestId: request.requestId,
          width: preview.width,
          height: preview.height,
          pixels,
        },
        [pixels],
      );
      return;
    }

    const extraction = extractPaletteFromPixels(
      new Uint8ClampedArray(request.pixels),
      request.colorCount,
    );
    respond({
      type: "palette-extracted",
      requestId: request.requestId,
      extraction,
    });
  } catch (error) {
    respond({
      type: "error",
      requestId: request.requestId,
      message: error instanceof Error ? error.message : "Image processing failed.",
    });
  }
};

export {};
