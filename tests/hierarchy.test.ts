import { describe, expect, it } from "vitest";
import { SEED_PROJECTS } from "@/agents/templates";

describe("organization hierarchy seed shape", () => {
  it("keeps project-local specialist teams", () => {
    expect(SEED_PROJECTS).toHaveLength(5);
    const slugs = SEED_PROJECTS.map((p) => p.slug);
    expect(slugs).toEqual([
      "autiq",
      "grupvi",
      "dreamit",
      "nofacci",
      "dailycap",
    ]);
    for (const project of SEED_PROJECTS) {
      expect(project.team.length).toBeGreaterThan(0);
      expect(project.manager.toLowerCase()).toContain(
        project.slug === "grupvi" ? "grupvi" : project.slug,
      );
    }
    const dreamit = SEED_PROJECTS.find((p) => p.slug === "dreamit");
    expect(dreamit?.team).toContain("qa");
    expect(dreamit?.mission).toMatch(/DREAMit/);
  });
});
