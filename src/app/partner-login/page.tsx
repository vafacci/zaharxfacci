import type { Metadata } from "next";
import { PartnerLoginForm } from "@/components/partner/PartnerLoginForm";

export const metadata: Metadata = {
  title: "Log ind — FACCI × ZAHAR",
  robots: { index: false, follow: false },
};

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="partner-shell">
      <div className="partner-page pl-wrap">
        <p className="partner-kicker">FACCI × ZAHAR</p>
        <h1 className="partner-title">Log ind</h1>
        <p className="partner-lead">Skriv jeres fælles adgangskode for at åbne partnersiden.</p>
        <PartnerLoginForm next={next ?? "/partner"} />
      </div>
    </div>
  );
}
