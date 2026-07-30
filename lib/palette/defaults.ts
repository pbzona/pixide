import { createPalette } from "./create";
import type { Palette } from "./types";

const definePalette = (id: string, name: string, colors: readonly string[]): Palette => {
  const result = createPalette(id, name, colors, true);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

export const DEFAULT_PALETTES: readonly Palette[] = [
  definePalette("ink-2", "Ink", ["#1e1d1a", "#f4efe4"]),
  definePalette("pocket-4", "Pocket", [
    "#18251d",
    "#47634b",
    "#a8bd71",
    "#f3efd2",
  ]),
  definePalette("ember-8", "Ember", [
    "#221c24",
    "#54313a",
    "#9a473c",
    "#df7442",
    "#f4b35b",
    "#f7e3a0",
    "#5d7b6f",
    "#263b46",
  ]),
  definePalette("arcade-16", "Arcade", [
    "#16171d",
    "#303449",
    "#596275",
    "#9aa4b2",
    "#f2eadf",
    "#5d273d",
    "#a23b52",
    "#e66b58",
    "#f2b85b",
    "#27545d",
    "#2f8071",
    "#68b56b",
    "#b4d96f",
    "#3d3c7a",
    "#6964b3",
    "#b68ac4",
  ]),
];

export const DEFAULT_PALETTE = DEFAULT_PALETTES[3];
