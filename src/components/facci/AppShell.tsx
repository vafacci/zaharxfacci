"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Overview } from "./types";

const NAV = [
  { href: "/", label: "Chat", hint: "Skriv til FACCI" },
  { href: "/approvals", label: "Beslutninger", hint: "Godkendelser" },
  { href: "/projects", label: "Projekter", hint: "Team & hukommelse" },
  { href: "/tasks", label: "Opgaver", hint: "Evidence & status" },
  { href: "/system", label: "System", hint: "Drift & tools" },
  { href: "/partner", label: "Briefing", hint: "Partner-portefølje" },
] as const;

export function AppShell({
  children,
  planner,
  approvalCount = 0,
}: {
  children: React.ReactNode;
  planner?: Overview["planner"] | null;
  approvalCount?: number;
}) {
  const pathname = usePathname();
  const healthy = Boolean(planner?.isLiveModel && planner.health.healthy);

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Hovednavigation">
        <div className="app-sidebar-top">
          <Link href="/" className="app-brand-block">
            <span className="app-brand-crystal" aria-hidden />
            <span className="app-brand-mark">FACCI</span>
          </Link>
          <nav className="app-nav-vert">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const badge =
                item.href === "/approvals" && approvalCount > 0
                  ? approvalCount
                  : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`app-nav-item${active ? " active" : ""}`}
                  title={item.hint}
                >
                  <span className="app-nav-item-label">{item.label}</span>
                  {badge != null ? (
                    <span className="app-nav-badge">{badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="app-sidebar-foot">
          <div className="app-health" title={planner?.health.details ?? undefined}>
            <span className={`app-health-dot${healthy ? " ok" : ""}`} aria-hidden />
            <span>
              Lokal AI{" "}
              <span className={healthy ? "text-[var(--accent)]" : "text-[var(--warn)]"}>
                {healthy ? "klar" : "utilgængelig"}
              </span>
            </span>
          </div>
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
