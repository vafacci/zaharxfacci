"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/partner", label: "Idéer", exact: true },
  { href: "/partner/rangering", label: "Rangering", exact: false },
  { href: "/partner/resultat", label: "Resultat", exact: false },
  { href: "/partner/aftale", label: "Aftale", exact: false },
];

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <header className="partner-nav">
      <div className="partner-nav-inner">
        <Link href="/partner" className="partner-nav-brand">
          FACCI <span aria-hidden>×</span> ZAHAR
        </Link>
        <nav aria-label="Partner-navigation">
          <ul className="partner-nav-list">
            {LINKS.map((l) => {
              const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`partner-nav-link${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
