export type CellCrop = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type SourceCrop = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const sourceCropFromCells = (
  crop: CellCrop,
  gridWidth: number,
  gridHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): SourceCrop => {
  if (gridWidth < 1 || gridHeight < 1 || sourceWidth < 1 || sourceHeight < 1) {
    throw new RangeError("Crop dimensions must be positive.");
  }

  const leftCell = clamp(Math.min(crop.left, crop.right), 0, gridWidth);
  const rightCell = clamp(Math.max(crop.left, crop.right), 0, gridWidth);
  const topCell = clamp(Math.min(crop.top, crop.bottom), 0, gridHeight);
  const bottomCell = clamp(Math.max(crop.top, crop.bottom), 0, gridHeight);
  if (leftCell === rightCell || topCell === bottomCell) {
    throw new RangeError("Crop must include at least one cell.");
  }

  const x = clamp(Math.round((leftCell * sourceWidth) / gridWidth), 0, sourceWidth - 1);
  const y = clamp(Math.round((topCell * sourceHeight) / gridHeight), 0, sourceHeight - 1);
  const right = clamp(
    Math.max(x + 1, Math.round((rightCell * sourceWidth) / gridWidth)),
    x + 1,
    sourceWidth,
  );
  const bottom = clamp(
    Math.max(y + 1, Math.round((bottomCell * sourceHeight) / gridHeight)),
    y + 1,
    sourceHeight,
  );

  return { x, y, width: right - x, height: bottom - y };
};

export const cropPixels = (
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  crop: SourceCrop,
): Uint8ClampedArray => {
  if (pixels.length !== sourceWidth * sourceHeight * 4) {
    throw new RangeError("Source pixel data does not match its dimensions.");
  }
  if (
    !Number.isInteger(crop.x) ||
    !Number.isInteger(crop.y) ||
    !Number.isInteger(crop.width) ||
    !Number.isInteger(crop.height) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width < 1 ||
    crop.height < 1 ||
    crop.x + crop.width > sourceWidth ||
    crop.y + crop.height > sourceHeight
  ) {
    throw new RangeError("Crop is outside the source image.");
  }

  const result = new Uint8ClampedArray(crop.width * crop.height * 4);
  const rowLength = crop.width * 4;
  for (let row = 0; row < crop.height; row += 1) {
    const sourceStart = ((crop.y + row) * sourceWidth + crop.x) * 4;
    result.set(pixels.subarray(sourceStart, sourceStart + rowLength), row * rowLength);
  }
  return result;
};
