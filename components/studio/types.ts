import type { SelectionCombineMode } from "@/lib/pixel";

export type EditorMode = "convert" | "select" | "paint";
export type EditorTool = "pencil" | "fill" | "eyedropper" | "restore";
export type SelectionTool = "brush" | "rectangle" | "contiguous";
export type { SelectionCombineMode };

export type SourceMeta = Readonly<{
  name: string;
  url: string;
  width: number;
  height: number;
}>;

export type HistoryPatch =
  | Readonly<{
      kind: "paint";
      indices: Int32Array;
      before: Int32Array;
      after: Int32Array;
    }>
  | Readonly<{
      kind: "method";
      indices: Int32Array;
      before: Uint8Array;
      after: Uint8Array;
    }>;
