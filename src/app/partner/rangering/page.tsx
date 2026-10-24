import type { Metadata } from "next";
import { PartnerRankingView } from "@/components/partner/PartnerRankingView";

export const metadata: Metadata = {
  title: "Rangering — FACCI × ZAHAR",
  description: "Giv point til de seks idéer og se rækkefølgen.",
  robots: { index: false, follow: false },
};

export default function RankingPage() {
  return <PartnerRankingView />;
}
