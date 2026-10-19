import { describe, expect, it } from "vitest";
import {
  loadBrandPack,
  brandPackReadinessSummary,
  brandPackReportSource,
} from "@/tools/brand-pack";
import { loadAutiqBrandPack } from "@/tools/autiq-brand";
import { buildSpecialistReport } from "@/domain/specialist-reports";

describe("brand packs", () => {
  it("AUTIQ pack is ready and merged with Content Autopilot framing", () => {
    const pack = loadAutiqBrandPack();
    expect(pack.ready).toBe(true);
    expect(pack.promptText).toMatch(/Content Autopilot|content automation/i);
    expect(pack.promptText).toMatch(/#070809|#F4F5F6/);
    expect(brandPackReadinessSummary(pack)).toMatch(/ready/i);
  });

  it("Grupvi pack is ready", () => {
    const pack = loadBrandPack("grupvi");
    expect(pack.ready).toBe(true);
    expect(pack.promptText).toMatch(/studiegruppe|Grupvi/i);
  });

  it("DREAMit pack is ready and enforces spelling", () => {
    const pack = loadBrandPack("dreamit");
    expect(pack.ready).toBe(true);
    expect(pack.promptText).toMatch(/DREAMit/);
    expect(pack.promptText).toMatch(/Fra hobby til webshop/);
  });

  it("specialist reports cite brand packs for portfolio brands", () => {
    const src = brandPackReportSource("dreamit");
    expect(src?.provenance).toBe("observed");
    const report = buildSpecialistReport({
      projectName: "DreamIT",
      projectSlug: "dreamit",
      title: "Research friction",
      objective: "List proposed onboarding friction",
      templateKey: "research",
      projectMission: "DREAMit hobby to webshop",
    });
    expect(report.content).toMatch(/DREAMit brand pack|workspace:\/\/dreamit\/brand/);
  });

  it("NOFACCI and DailyCap packs are ready", () => {
    const n = loadBrandPack("nofacci");
    expect(n.ready).toBe(true);
    expect(n.promptText).toMatch(/Theah Rose|NOFACCI VISUALS/);
    const d = loadBrandPack("dailycap");
    expect(d.ready).toBe(true);
    expect(d.promptText).toMatch(/How much can I safely spend today/i);
  });
});
