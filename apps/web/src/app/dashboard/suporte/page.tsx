import type { Metadata } from "next";

import { SupportDiagnostics } from "./support-diagnostics";

export const metadata: Metadata = {
  title: "Suporte técnico",
};

export default function SupportPage() {
  return <SupportDiagnostics />;
}
