export const MIN_GUIDE_DIVISIONS = 2;
export const MAX_GUIDE_DIVISIONS = 32;

export const normalizeGuideDivisions = (value: number): number =>
  Math.min(
    MAX_GUIDE_DIVISIONS,
    Math.max(MIN_GUIDE_DIVISIONS, Math.round(value)),
  );

export const getGuidePositions = (divisions: number): readonly number[] => {
  const normalized = normalizeGuideDivisions(divisions);
  return Array.from(
    { length: normalized - 1 },
    (_, index) => ((index + 1) / normalized) * 100,
  );
};
