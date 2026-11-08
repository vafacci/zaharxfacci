import type { Metadata } from "next";
import { PartnerGrupviView } from "@/components/partner/PartnerGrupviView";

export const metadata: Metadata = {
  title: "Grupvi — FACCI × ZAHAR",
  robots: { index: false, follow: false },
};

export default function PartnerGrupviPage() {
  return <PartnerGrupviView />;
}
