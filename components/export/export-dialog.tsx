"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ExportDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width: number;
  height: number;
  scale: number;
  onScaleChange: (scale: number) => void;
  onExport: () => Promise<void>;
  exporting: boolean;
}>;

export function ExportDialog({
  open,
  onOpenChange,
  width,
  height,
  scale,
  onScaleChange,
  onExport,
  exporting,
}: ExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export PNG</DialogTitle>
          <DialogDescription>
            Scale each logical pixel into a crisp square with no smoothing.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Pixel scale
            </p>
            <ToggleGroup
              type="single"
              value={String(scale)}
              variant="outline"
              spacing={0}
              className="w-full"
              onValueChange={(value: string) => {
                if (value) onScaleChange(Number(value));
              }}
            >
              {[1, 2, 4, 8].map((value) => (
                <ToggleGroupItem key={value} value={String(value)} className="flex-1">
                  {value}×
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex items-end justify-between border bg-muted/30 p-4">
            <div>
              <p className="text-xs text-muted-foreground">Output dimensions</p>
              <p className="mt-1 font-mono text-lg tabular-nums">
                {width * scale} × {height * scale}
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              PNG
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={exporting} onClick={() => void onExport()}>
            <Download data-icon="inline-start" />
            {exporting ? "Preparing…" : "Download PNG"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
