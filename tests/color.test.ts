import { describe, expect, it } from "vitest";

import {
  DEFAULT_PALETTE_ADJUSTMENTS,
  adjustColor,
  formatColorHex,
  nearestColorIndex,
  normalizeColor,
  parseColor,
} from "@/lib/color";

describe("color tools", () => {
  it("normalizes any supported CSS color into hex", () => {
    expect(normalizeColor("rgb(255 0 128)")).toEqual({ ok: true, value: "#ff0080" });
    expect(normalizeColor("not-a-color").ok).toBe(false);
  });

  it("keeps an unadjusted color unchanged", () => {
    const parsed = parseColor("#ef6a47");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(formatColorHex(adjustColor(parsed.value, DEFAULT_PALETTE_ADJUSTMENTS))).toBe(
      "#ef6a47",
    );
  });

  it("matches colors perceptually without mutating its palette", () => {
    const target = parseColor("#f5f0e5");
    const dark = parseColor("#1e1d1a");
    const light = parseColor("#f4efe4");
    expect(target.ok && dark.ok && light.ok).toBe(true);
    if (!target.ok || !dark.ok || !light.ok) return;
    const palette = [dark.value, light.value] as const;
    expect(nearestColorIndex(target.value, palette)).toBe(1);
    expect(formatColorHex(palette[0])).toBe("#1e1d1a");
  });
});
