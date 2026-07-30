"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_PALETTE_ADJUSTMENTS,
  type PaletteAdjustments as PaletteAdjustmentsValue,
} from "@/lib/color";

type PaletteAdjustmentsProps = Readonly<{
  value: PaletteAdjustmentsValue;
  onChange: (value: PaletteAdjustmentsValue) => void;
}>;

const controls: readonly Readonly<{
  key: keyof PaletteAdjustmentsValue;
  label: string;
  min: number;
  max: number;
  suffix: string;
}>[] = [
  { key: "hue", label: "Hue", min: -180, max: 180, suffix: "°" },
  { key: "saturation", label: "Chroma", min: -100, max: 100, suffix: "%" },
  { key: "lightness", label: "Light", min: -50, max: 50, suffix: "%" },
  { key: "contrast", label: "Contrast", min: -50, max: 100, suffix: "%" },
];

export function PaletteAdjustments({ value, onChange }: PaletteAdjustmentsProps) {
  const changed = Object.keys(value).some(
    (key) => value[key as keyof PaletteAdjustmentsValue] !== 0,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <SlidersHorizontal data-icon="inline-start" />
          Adjust
          {changed ? <span className="absolute -top-1 -right-1 size-2 bg-[#ef6a47]" /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-none p-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Palette adjustments</p>
            <p className="mt-1 text-xs text-muted-foreground">Assignments stay fixed.</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!changed}
            onClick={() => onChange(DEFAULT_PALETTE_ADJUSTMENTS)}
          >
            <RotateCcw />
            <span className="sr-only">Reset adjustments</span>
          </Button>
        </div>
        <div className="space-y-5">
          {controls.map((control) => (
            <label key={control.key} className="block">
              <span className="mb-2 flex items-center justify-between text-xs">
                <span>{control.label}</span>
                <span className="font-mono text-muted-foreground">
                  {value[control.key] > 0 ? "+" : ""}
                  {value[control.key]}
                  {control.suffix}
                </span>
              </span>
              <Slider
                aria-label={control.label}
                min={control.min}
                max={control.max}
                step={1}
                value={[value[control.key]]}
                onValueChange={([next]: number[]) =>
                  onChange({ ...value, [control.key]: next })
                }
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
