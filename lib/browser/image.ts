export type DecodedImage = Readonly<{
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
}>;

export const MAX_SOURCE_PIXELS = 40_000_000;

export const decodeImageFile = async (file: File): Promise<DecodedImage> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.type === "image/svg+xml") {
    throw new Error("SVG files are not supported. Export the image as PNG first.");
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (bitmap.width * bitmap.height > MAX_SOURCE_PIXELS) {
      throw new Error("This image is too large. Use an image under 40 megapixels.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser cannot read image pixels.");
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, pixels: image.data };
  } finally {
    bitmap.close();
  }
};
