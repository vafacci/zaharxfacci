import { describe, expect, it } from "vitest";
import {
  isPathAllowed,
  loadWorkspaces,
  matchGlob,
  resolveWorkspace,
} from "@/tools/workspace";
import { pickDeveloperWorkspaceId } from "@/tools/workspace-routing";

describe("workspace allowlist", () => {
  it("loads toy-counter and all portfolio vaults", () => {
    const list = loadWorkspaces();
    expect(list.some((w) => w.id === "toy-counter")).toBe(true);
    expect(list.some((w) => w.id === "autiq")).toBe(true);
    expect(list.some((w) => w.id === "autiq-web")).toBe(true);
    expect(list.some((w) => w.id === "grupvi")).toBe(true);
    expect(list.some((w) => w.id === "grupvi-app")).toBe(true);
    expect(list.some((w) => w.id === "dreamit")).toBe(true);
    expect(list.some((w) => w.id === "dreamit-web")).toBe(true);
    expect(list.some((w) => w.id === "nofacci")).toBe(true);
    expect(list.some((w) => w.id === "dailycap")).toBe(true);
  });

  it("resolves toy-counter inside repo", () => {
    const { absolutePath, config } = resolveWorkspace("toy-counter");
    expect(absolutePath.replace(/\\/g, "/")).toMatch(/workspaces\/toy-counter$/);
    expect(config.allowedGlobs.length).toBeGreaterThan(0);
  });

  it("resolves autiq brand vault inside repo", () => {
    const { absolutePath, config } = resolveWorkspace("autiq");
    expect(absolutePath.replace(/\\/g, "/")).toMatch(/workspaces\/autiq$/);
    expect(isPathAllowed(config, "brand/voice.md")).toBe(true);
    expect(isPathAllowed(config, "content/calendar.md")).toBe(true);
    expect(isPathAllowed(config, ".env")).toBe(false);
  });

  it("allows src files and denies .env", () => {
    const { config } = resolveWorkspace("toy-counter");
    expect(isPathAllowed(config, "src/counter.js")).toBe(true);
    expect(isPathAllowed(config, ".env")).toBe(false);
    expect(isPathAllowed(config, "secrets/key.pem")).toBe(false);
  });

  it("matches globs", () => {
    expect(matchGlob("src/counter.js", "src/**")).toBe(true);
    expect(matchGlob("test/counter.test.js", "test/**")).toBe(true);
    expect(matchGlob("other/x.js", "src/**")).toBe(false);
  });

  it("rejects unknown workspaces", () => {
    expect(() => resolveWorkspace("imagegen")).toThrow(/not allowlisted/i);
  });

  it("picks workspace by project + intent", () => {
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "autiq",
        title: "Brand",
        objective: "Opdater brand voice og calendar",
      }),
    ).toBe("autiq");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "autiq",
        title: "Web",
        objective: "Fix Next.js component on autiq-web landing page",
      }),
    ).toBe("autiq-web");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "grupvi",
        title: "UX",
        objective: "Opdater product/ux-notes.md",
      }),
    ).toBe("grupvi");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "grupvi",
        title: "App",
        objective: "Edit studiechat expo app AGENTS.md",
      }),
    ).toBe("grupvi-app");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "dreamit",
        title: "Notes",
        objective: "Opdater product notes",
      }),
    ).toBe("dreamit");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "dreamit",
        title: "Web",
        objective: "Fix Next.js component on dreamit-web",
      }),
    ).toBe("dreamit-web");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "autiq",
        title: "Demo",
        objective: "Fix toy-counter add bug",
      }),
    ).toBe("toy-counter");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "nofacci",
        title: "Notes",
        objective: "Opdater product notes",
      }),
    ).toBe("nofacci");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "nofacci",
        title: "Website",
        objective: "Byg NOFACCI hjemmeside i nofacci-web",
      }),
    ).toBe("nofacci-web");
    expect(
      pickDeveloperWorkspaceId({
        projectSlug: "dailycap",
        title: "Notes",
        objective: "Opdater product notes",
      }),
    ).toBe("dailycap");
  });

  it("resolves portfolio vaults inside repo", () => {
    expect(resolveWorkspace("grupvi").absolutePath.replace(/\\/g, "/")).toMatch(
      /workspaces\/grupvi$/,
    );
    expect(resolveWorkspace("dreamit").absolutePath.replace(/\\/g, "/")).toMatch(
      /workspaces\/dreamit$/,
    );
    expect(resolveWorkspace("nofacci").absolutePath.replace(/\\/g, "/")).toMatch(
      /workspaces\/nofacci$/,
    );
    expect(resolveWorkspace("dailycap").absolutePath.replace(/\\/g, "/")).toMatch(
      /workspaces\/dailycap$/,
    );
    expect(isPathAllowed(resolveWorkspace("grupvi").config, "product/ux-notes.md")).toBe(true);
    expect(isPathAllowed(resolveWorkspace("dreamit").config, "product/notes.md")).toBe(true);
    expect(isPathAllowed(resolveWorkspace("nofacci").config, "brand/voice.md")).toBe(true);
    expect(isPathAllowed(resolveWorkspace("dailycap").config, "product/notes.md")).toBe(true);
  });
});
