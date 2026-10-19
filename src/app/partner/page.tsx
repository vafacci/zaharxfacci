import type { Metadata } from "next";
import { PartnerBriefingView } from "@/components/partner/PartnerBriefingView";

export const metadata: Metadata = {
  title: "Portefølje-briefing — FACCI partnerskab",
  description:
    "Overblik og ranking af AUTIQ, NOFACCI, DREAMit, Grupvi, DailyCap og Scanna til content-partnerskab.",
  robots: { index: false, follow: false },
};

export default function PartnerPage() {
  return <PartnerBriefingView />;
}
