import { PartnerNav } from "@/components/partner/PartnerNav";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="partner-shell">
      <PartnerNav />
      {children}
    </div>
  );
}
