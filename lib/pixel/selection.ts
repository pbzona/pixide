export type SelectionMask = Uint8Array;
export type SelectionCombineMode = "replace" | "add" | "subtract" | "intersect";

type RectangleBounds = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

const selectionSize = (width: number, height: number): number => {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError("Selection dimensions must be positive integers");
  }

  const size = width * height;
  if (!Number.isSafeInteger(size)) {
    throw new RangeError("Selection dimensions are too large");
  }
  return size;
};

const rectangleBounds = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
): RectangleBounds | null => {
  if (
    !Number.isSafeInteger(fromX) ||
    !Number.isSafeInteger(fromY) ||
    !Number.isSafeInteger(toX) ||
    !Number.isSafeInteger(toY)
  ) {
    throw new RangeError("Rectangle coordinates must be integers");
  }

  const left = Math.max(0, Math.min(fromX, toX));
  const top = Math.max(0, Math.min(fromY, toY));
  const right = Math.min(width - 1, Math.max(fromX, toX));
  const bottom = Math.min(height - 1, Math.max(fromY, toY));
  return left <= right && top <= bottom ? { left, top, right, bottom } : null;
};

export const rectangleSelectionIndices = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
): readonly number[] => {
  selectionSize(width, height);
  const bounds = rectangleBounds(fromX, fromY, toX, toY, width, height);
  if (!bounds) return [];

  const indices: number[] = [];
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      indices.push(y * width + x);
    }
  }
  return indices;
};

export const rectangleSelectionMask = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
): SelectionMask => {
  const mask = new Uint8Array(selectionSize(width, height));
  const bounds = rectangleBounds(fromX, fromY, toX, toY, width, height);
  if (!bounds) return mask;

  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      mask[y * width + x] = 1;
    }
  }
  return mask;
};

export const contiguousSelectionMask = (
  startIndex: number,
  visibleColorIds: Uint16Array,
  width: number,
  height: number,
): SelectionMask => {
  const size = selectionSize(width, height);
  if (visibleColorIds.length !== size) {
    throw new RangeError("Visible color IDs must match the selection dimensions");
  }
  if (!Number.isSafeInteger(startIndex) || startIndex < 0 || startIndex >= size) {
    throw new RangeError("Start index is outside the selection dimensions");
  }

  const targetColorId = visibleColorIds[startIndex];
  const mask = new Uint8Array(size);
  const queue = new Uint32Array(size);
  let read = 0;
  let write = 1;
  queue[0] = startIndex;
  mask[startIndex] = 1;

  while (read < write) {
    const index = queue[read++];
    const x = index % width;
    const y = Math.floor(index / width);

    if (x > 0) {
      const neighbor = index - 1;
      if (mask[neighbor] === 0 && visibleColorIds[neighbor] === targetColorId) {
        mask[neighbor] = 1;
        queue[write++] = neighbor;
      }
    }
    if (x + 1 < width) {
      const neighbor = index + 1;
      if (mask[neighbor] === 0 && visibleColorIds[neighbor] === targetColorId) {
        mask[neighbor] = 1;
        queue[write++] = neighbor;
      }
    }
    if (y > 0) {
      const neighbor = index - width;
      if (mask[neighbor] === 0 && visibleColorIds[neighbor] === targetColorId) {
        mask[neighbor] = 1;
        queue[write++] = neighbor;
      }
    }
    if (y + 1 < height) {
      const neighbor = index + width;
      if (mask[neighbor] === 0 && visibleColorIds[neighbor] === targetColorId) {
        mask[neighbor] = 1;
        queue[write++] = neighbor;
      }
    }
  }

  return mask;
};

export const combineSelectionMasks = (
  current: SelectionMask,
  incoming: SelectionMask,
  mode: SelectionCombineMode,
): SelectionMask => {
  if (current.length !== incoming.length) {
    throw new RangeError("Selection masks must have equal lengths");
  }

  const result = new Uint8Array(current.length);
  for (let index = 0; index < result.length; index += 1) {
    const selected = current[index] !== 0;
    const added = incoming[index] !== 0;
    switch (mode) {
      case "replace":
        result[index] = Number(added);
        break;
      case "add":
        result[index] = Number(selected || added);
        break;
      case "subtract":
        result[index] = Number(selected && !added);
        break;
      case "intersect":
        result[index] = Number(selected && added);
        break;
      default:
        throw new RangeError(`Unknown selection combine mode: ${String(mode)}`);
    }
  }
  return result;
};

export const selectAllMask = (width: number, height: number): SelectionMask =>
  new Uint8Array(selectionSize(width, height)).fill(1);

export const invertSelectionMask = (mask: SelectionMask): SelectionMask => {
  const inverted = new Uint8Array(mask.length);
  for (let index = 0; index < mask.length; index += 1) {
    inverted[index] = Number(mask[index] === 0);
  }
  return inverted;
};
