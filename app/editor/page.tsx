import type { Metadata } from "next";

import { PixelStudio } from "@/components/studio/pixel-studio";

export const metadata: Metadata = {
  title: "Editor",
  description:
    "Convert an image into palette-driven pixel art, refine individual cells, and export a crisp PNG.",
};

export default function EditorPage() {
  return <PixelStudio />;
}
