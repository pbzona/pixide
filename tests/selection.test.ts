import { describe, expect, it } from "vitest";

import { floodFillIndices } from "@/lib/pixel/edit";
import {
  combineSelectionMasks,
  contiguousSelectionMask,
  invertSelectionMask,
  rectangleSelectionIndices,
  rectangleSelectionMask,
  selectAllMask,
  type SelectionCombineMode,
  type SelectionMask,
} from "@/lib/pixel/selection";
import { NO_OVERRIDE_COLOR_ID } from "@/lib/pixel/types";

describe("rectangle selection", () => {
  it("returns row-major indices for drags in every direction", () => {
    const drags = [
      [1, 1, 3, 2],
      [3, 2, 1, 1],
      [3, 1, 1, 2],
      [1, 2, 3, 1],
    ] as const;

    for (const [fromX, fromY, toX, toY] of drags) {
      expect(rectangleSelectionIndices(fromX, fromY, toX, toY, 5, 4)).toEqual([
        6, 7, 8, 11, 12, 13,
      ]);
    }
  });

  it("clips masks and indices to the grid", () => {
    expect(rectangleSelectionIndices(-2, 1, 2, 5, 4, 3)).toEqual([
      4, 5, 6, 8, 9, 10,
    ]);

    const mask: SelectionMask = rectangleSelectionMask(-2, 1, 2, 5, 4, 3);
    expect(mask).toBeInstanceOf(Uint8Array);
    expect([...mask]).toEqual([0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0]);
    expect(rectangleSelectionIndices(-5, -5, -1, -1, 4, 3)).toEqual([]);
  });

  it("validates dimensions and cell coordinates", () => {
    expect(() => rectangleSelectionMask(0, 0, 1, 1, 0, 2)).toThrow(RangeError);
    expect(() => rectangleSelectionIndices(0.5, 0, 1, 1, 2, 2)).toThrow(RangeError);
  });
});

describe("contiguous selection", () => {
  const visibleColorIds = new Uint16Array([
    7, 7, 2, 7,
    7, 2, 2, 7,
    2, 7, 7, 2,
    7, 7, 2, 2,
  ]);

  it("selects only an exact four-neighbor color region", () => {
    expect([...contiguousSelectionMask(0, visibleColorIds, 4, 4)]).toEqual([
      1, 1, 0, 0,
      1, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]);
  });

  it("validates the color grid and start index", () => {
    expect(() => contiguousSelectionMask(0, visibleColorIds, 3, 4)).toThrow(RangeError);
    expect(() => contiguousSelectionMask(-1, visibleColorIds, 4, 4)).toThrow(RangeError);
    expect(() => contiguousSelectionMask(16, visibleColorIds, 4, 4)).toThrow(RangeError);
  });
});

describe("selected-area flood fill", () => {
  it("treats unselected cells as barriers between matching selected regions", () => {
    const generated = new Uint16Array([
      4, 4, 4,
      9, 4, 4,
      4, 4, 4,
    ]);
    const overrides = new Int32Array(generated.length).fill(NO_OVERRIDE_COLOR_ID);
    overrides[3] = 4;
    const selection = new Uint8Array([
      1, 0, 1,
      1, 0, 1,
      1, 0, 1,
    ]);

    const filled = floodFillIndices(
      3,
      7,
      generated,
      overrides,
      3,
      3,
      selection,
    );

    expect([...filled].sort((left, right) => left - right)).toEqual([0, 3, 6]);
  });
});

describe("selection mask operations", () => {
  const current = new Uint8Array([1, 1, 0, 0]);
  const incoming = new Uint8Array([0, 1, 1, 0]);
  const expectedByMode: Record<SelectionCombineMode, readonly number[]> = {
    replace: [0, 1, 1, 0],
    add: [1, 1, 1, 0],
    subtract: [1, 0, 0, 0],
    intersect: [0, 1, 0, 0],
  };

  it("combines masks in every mode without changing either input", () => {
    for (const mode of Object.keys(expectedByMode) as SelectionCombineMode[]) {
      expect([...combineSelectionMasks(current, incoming, mode)]).toEqual(
        expectedByMode[mode],
      );
    }
    expect([...current]).toEqual([1, 1, 0, 0]);
    expect([...incoming]).toEqual([0, 1, 1, 0]);
  });

  it("rejects masks with different lengths", () => {
    expect(() =>
      combineSelectionMasks(current, new Uint8Array(3), "replace"),
    ).toThrow(RangeError);
  });

  it("selects all cells and returns an inverted copy", () => {
    const all = selectAllMask(3, 2);
    expect([...all]).toEqual([1, 1, 1, 1, 1, 1]);
    expect([...invertSelectionMask(new Uint8Array([0, 1, 0, 1]))]).toEqual([
      1, 0, 1, 0,
    ]);
    expect(() => selectAllMask(3, -1)).toThrow(RangeError);
  });
});
