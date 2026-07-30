import type { Metadata } from "next";

import { QuantizationLab } from "@/components/learn/quantization-lab";

export const metadata: Metadata = {
  title: "How pixelation works",
  description:
    "Inspect image sampling, palette matching, quantization, dithering, and palette extraction in Pixide.",
};

export default function LearnPage() {
  return <QuantizationLab />;
}
