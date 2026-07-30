"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_INPUT_ADJUSTMENTS,
  inputAdjustmentsChanged,
  type InputAdjustments,
} from "@/lib/pixel";

type SourceAdjustmentsProps = Readonly<{
  value: InputAdjustments;
  onChange: (value: InputAdjustments) => void;
  compact?: boolean;
}>;

const controls: readonly Readonly<{
  key: keyof InputAdjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
}>[] = [
  { key: "exposure", label: "Exposure", min: -2, max: 2, step: 0.1, suffix: " EV" },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, suffix: "%" },
  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1, suffix: "%" },
  { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1, suffix: "" },
  { key: "detail", label: "Detail", min: -100, max: 100, step: 1, suffix: "" },
];

export function SourceAdjustments({ value, onChange, compact = false }: SourceAdjustmentsProps) {
  const changed = inputAdjustmentsChanged(value);

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        {compact ? <Label>Adjustments</Label> : <div>
          <Label>Source adjustments</Label>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Applied before pixel sampling and palette matching.
          </p>
        </div>}
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={!changed}
          onClick={() => onChange(DEFAULT_INPUT_ADJUSTMENTS)}
        >
          <RotateCcw />
          <span className="sr-only">Reset source adjustments</span>
        </Button>
      </div>
      <div className="space-y-5">
        {controls.map((control) => (
          <label key={control.key} className="block">
            <span className="mb-2 flex items-center justify-between text-xs">
              <span>{control.label}</span>
              <span className="font-mono text-muted-foreground">
                {value[control.key] > 0 ? "+" : ""}
                {Number.isInteger(value[control.key])
                  ? value[control.key]
                  : value[control.key].toFixed(1)}
                {control.suffix}
              </span>
            </span>
            <Slider
              aria-label={control.label}
              min={control.min}
              max={control.max}
              step={control.step}
              value={[value[control.key]]}
              onValueChange={([next]: number[]) =>
                onChange({ ...value, [control.key]: next })
              }
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        <span>Detail: soften</span>
        <span>sharpen</span>
      </div>
    </section>
  );
}
