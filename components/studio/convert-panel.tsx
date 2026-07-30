"use client";

import { useId } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  CONVERSION_METHODS,
  type ConversionMethod,
  type InputAdjustments,
} from "@/lib/pixel";

import { SourceAdjustments } from "./source-adjustments";
import type { SourceMeta } from "./types";

type ConvertPanelProps = Readonly<{
  source: SourceMeta;
  method: ConversionMethod;
  inputAdjustments: InputAdjustments;
  preserveTransparency: boolean;
  alphaThreshold: number;
  onMethodChange: (method: ConversionMethod) => void;
  onInputAdjustmentsChange: (adjustments: InputAdjustments) => void;
  onPreserveTransparencyChange: (preserve: boolean) => void;
  onAlphaThresholdChange: (threshold: number) => void;
}>;

export function ConvertPanel({
  source,
  method,
  inputAdjustments,
  preserveTransparency,
  alphaThreshold,
  onMethodChange,
  onInputAdjustmentsChange,
  onPreserveTransparencyChange,
  onAlphaThresholdChange,
}: ConvertPanelProps) {
  const methodId = useId();
  const preserveTransparencyId = useId();

  return (
    <div className="divide-y divide-border pb-6">
      <section className="px-4 pb-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium">Source</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Adjust before sampling.</p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {source.width}×{source.height}
          </span>
        </div>
        <SourceAdjustments value={inputAdjustments} onChange={onInputAdjustmentsChange} compact />
        <div className="mt-6 border-t pt-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor={preserveTransparencyId}>Preserve transparency</Label>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Keep empty source areas empty.</p>
            </div>
            <Switch
              id={preserveTransparencyId}
              checked={preserveTransparency}
              onCheckedChange={onPreserveTransparencyChange}
            />
          </div>
          {preserveTransparency ? (
            <label className="mt-5 block">
              <span className="mb-2 flex items-center justify-between text-xs">
                <span>Alpha threshold</span>
                <span className="font-mono text-muted-foreground">{alphaThreshold}</span>
              </span>
              <Slider
                aria-label="Alpha threshold"
                min={0}
                max={255}
                step={1}
                value={[alphaThreshold]}
                onValueChange={([value]: number[]) => onAlphaThresholdChange(value)}
              />
            </label>
          ) : null}
        </div>
      </section>

      <section className="px-4 py-6">
        <Label htmlFor={methodId} className="mb-3">Quantization method</Label>
        <Select value={method} onValueChange={(value: string) => onMethodChange(value as ConversionMethod)}>
          <SelectTrigger id={methodId} className="h-9 w-full rounded-none py-0">
            <SelectValue>{CONVERSION_METHODS.find((entry) => entry.value === method)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-none">
            {CONVERSION_METHODS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value} className="rounded-none py-2">
                <span className="flex flex-col items-start">
                  <span>{entry.label}</span>
                  <span className="text-[10px] text-muted-foreground">{entry.description}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {CONVERSION_METHODS.find((entry) => entry.value === method)?.description}.
        </p>
      </section>
    </div>
  );
}
