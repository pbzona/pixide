"use client";

import { useCallback, useEffect, useRef } from "react";

import type { PaletteExtraction } from "@/lib/palette";
import type {
  ConversionOptions,
  ConversionResult,
  InputAdjustments,
  PixelPreview,
  PixelWorkerRequest,
  PixelWorkerResponse,
} from "@/lib/pixel";

type PendingRequest = Readonly<{
  resolve: (response: PixelWorkerResponse) => void;
  reject: (error: Error) => void;
}>;

type WithoutRequestId<T> = T extends { requestId: number } ? Omit<T, "requestId"> : never;
type PixelWorkerRequestInput = WithoutRequestId<PixelWorkerRequest>;

type ConversionWaiter = Readonly<{
  resolve: (result: ConversionResult) => void;
  reject: (error: Error) => void;
}>;

type QueuedConversion = {
  options: ConversionOptions;
  waiters: ConversionWaiter[];
};

type PreviewWaiter = Readonly<{
  resolve: (result: PixelPreview) => void;
  reject: (error: Error) => void;
}>;

type QueuedPreview = {
  adjustments: InputAdjustments;
  preserveTransparency: boolean;
  alphaThreshold: number;
  waiters: PreviewWaiter[];
};

export const usePixelWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef(new Map<number, PendingRequest>());
  const conversionRunningRef = useRef(false);
  const queuedConversionRef = useRef<QueuedConversion | null>(null);
  const previewRunningRef = useRef(false);
  const queuedPreviewRef = useRef<QueuedPreview | null>(null);

  const ensureWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;

    const worker = new Worker(new URL("../workers/pixel.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<PixelWorkerResponse>) => {
      const response = event.data;
      const pending = pendingRef.current.get(response.requestId);
      if (!pending) return;
      pendingRef.current.delete(response.requestId);
      if (response.type === "error") pending.reject(new Error(response.message));
      else pending.resolve(response);
    };
    const handleWorkerFailure = () => {
      if (workerRef.current !== worker) return;
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("The image worker stopped unexpectedly."));
      }
      pendingRef.current.clear();
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
    };
    worker.onerror = handleWorkerFailure;
    worker.onmessageerror = handleWorkerFailure;
    workerRef.current = worker;
    return worker;
  }, []);

  const send = useCallback(
    (
      request: PixelWorkerRequestInput,
      transfer: Transferable[] = [],
    ): Promise<PixelWorkerResponse> => {
      const requestId = ++requestIdRef.current;
      const worker = ensureWorker();
      return new Promise((resolve, reject) => {
        pendingRef.current.set(requestId, { resolve, reject });
        try {
          worker.postMessage({ ...request, requestId } as PixelWorkerRequest, transfer);
        } catch (error) {
          pendingRef.current.delete(requestId);
          reject(
            error instanceof Error ? error : new Error("Could not start image processing."),
          );
        }
      });
    },
    [ensureWorker],
  );

  const supersedeQueuedProcessing = useCallback(() => {
    const error = new Error("Image processing was superseded by a new source.");
    for (const waiter of queuedConversionRef.current?.waiters ?? []) {
      waiter.reject(error);
    }
    queuedConversionRef.current = null;
    for (const waiter of queuedPreviewRef.current?.waiters ?? []) {
      waiter.reject(error);
    }
    queuedPreviewRef.current = null;
  }, []);

  const cancelActiveWorker = useCallback(() => {
    const worker = workerRef.current;
    if (!worker || pendingRef.current.size === 0) return;
    const error = new Error("Image processing was superseded by a new source.");
    for (const pending of pendingRef.current.values()) pending.reject(error);
    pendingRef.current.clear();
    if (workerRef.current === worker) workerRef.current = null;
    worker.terminate();
  }, []);

  const setSource = useCallback(
    async (pixels: Uint8ClampedArray, width: number, height: number): Promise<PixelPreview> => {
      supersedeQueuedProcessing();
      cancelActiveWorker();
      const buffer = transferableBuffer(pixels);
      const response = await send(
        { type: "set-source", pixels: buffer, width, height },
        [buffer],
      );
      if (response.type !== "source-ready") {
        throw new Error("Source image was not accepted.");
      }
      return {
        width: response.previewWidth,
        height: response.previewHeight,
        pixels: new Uint8ClampedArray(response.previewPixels),
      };
    },
    [cancelActiveWorker, send, supersedeQueuedProcessing],
  );

  const sendConversion = useCallback(
    async (options: ConversionOptions): Promise<ConversionResult> => {
      const methodOverrides = options.methodOverrides?.slice();
      const nextOptions = methodOverrides ? { ...options, methodOverrides } : options;
      const transfer = methodOverrides ? [methodOverrides.buffer as ArrayBuffer] : [];
      const response = await send({ type: "convert", options: nextOptions }, transfer);
      if (response.type !== "converted") throw new Error("Conversion did not finish.");
      return {
        width: response.width,
        height: response.height,
        colorIds: new Uint16Array(response.colorIds),
      };
    },
    [send],
  );

  const drainConversions = useCallback(async () => {
    if (conversionRunningRef.current) return;
    conversionRunningRef.current = true;
    try {
      while (queuedConversionRef.current) {
        const queued = queuedConversionRef.current;
        queuedConversionRef.current = null;
        try {
          const result = await sendConversion(queued.options);
          for (const waiter of queued.waiters) waiter.resolve(result);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error("Conversion failed.");
          for (const waiter of queued.waiters) waiter.reject(failure);
        }
      }
    } finally {
      conversionRunningRef.current = false;
    }
  }, [sendConversion]);

  const convert = useCallback(
    (options: ConversionOptions): Promise<ConversionResult> =>
      new Promise((resolve, reject) => {
        const waiter = { resolve, reject };
        const queued = queuedConversionRef.current;
        if (queued) {
          queued.options = options;
          queued.waiters.push(waiter);
        } else {
          queuedConversionRef.current = { options, waiters: [waiter] };
        }
        void drainConversions();
      }),
    [drainConversions],
  );

  const sendPreview = useCallback(
    async (
      adjustments: InputAdjustments,
      preserveTransparency: boolean,
      alphaThreshold: number,
    ): Promise<PixelPreview> => {
      const response = await send({
        type: "preview",
        adjustments,
        preserveTransparency,
        alphaThreshold,
      });
      if (response.type !== "previewed") throw new Error("Source preview did not finish.");
      return {
        width: response.width,
        height: response.height,
        pixels: new Uint8ClampedArray(response.pixels),
      };
    },
    [send],
  );

  const drainPreviews = useCallback(async () => {
    if (previewRunningRef.current) return;
    previewRunningRef.current = true;
    try {
      while (queuedPreviewRef.current) {
        const queued = queuedPreviewRef.current;
        queuedPreviewRef.current = null;
        try {
          const result = await sendPreview(
            queued.adjustments,
            queued.preserveTransparency,
            queued.alphaThreshold,
          );
          for (const waiter of queued.waiters) waiter.resolve(result);
        } catch (error) {
          const failure = error instanceof Error ? error : new Error("Preview failed.");
          for (const waiter of queued.waiters) waiter.reject(failure);
        }
      }
    } finally {
      previewRunningRef.current = false;
    }
  }, [sendPreview]);

  const preview = useCallback(
    (
      adjustments: InputAdjustments,
      preserveTransparency: boolean,
      alphaThreshold: number,
    ): Promise<PixelPreview> =>
      new Promise((resolve, reject) => {
        const waiter = { resolve, reject };
        const queued = queuedPreviewRef.current;
        if (queued) {
          queued.adjustments = adjustments;
          queued.preserveTransparency = preserveTransparency;
          queued.alphaThreshold = alphaThreshold;
          queued.waiters.push(waiter);
        } else {
          queuedPreviewRef.current = {
            adjustments,
            preserveTransparency,
            alphaThreshold,
            waiters: [waiter],
          };
        }
        void drainPreviews();
      }),
    [drainPreviews],
  );

  const extractPalette = useCallback(
    async (pixels: Uint8ClampedArray, colorCount: number): Promise<PaletteExtraction> => {
      const buffer = transferableBuffer(pixels);
      const response = await send(
        { type: "extract-palette", pixels: buffer, colorCount },
        [buffer],
      );
      if (response.type !== "palette-extracted") {
        throw new Error("Palette extraction did not finish.");
      }
      return response.extraction;
    },
    [send],
  );

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const pending of pendingRef.current.values()) {
        pending.reject(new Error("Image processing was cancelled."));
      }
      pendingRef.current.clear();
      const cancellation = new Error("Image processing was cancelled.");
      for (const waiter of queuedConversionRef.current?.waiters ?? []) {
        waiter.reject(cancellation);
      }
      queuedConversionRef.current = null;
      for (const waiter of queuedPreviewRef.current?.waiters ?? []) {
        waiter.reject(cancellation);
      }
      queuedPreviewRef.current = null;
    },
    [],
  );

  return { setSource, convert, preview, extractPalette };
};

const transferableBuffer = (pixels: Uint8ClampedArray): ArrayBuffer => {
  if (
    pixels.buffer instanceof ArrayBuffer &&
    pixels.byteOffset === 0 &&
    pixels.byteLength === pixels.buffer.byteLength
  ) {
    return pixels.buffer;
  }
  return new Uint8ClampedArray(pixels).buffer;
};
