import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  importBrandKnowledgeFromText,
  redactSecrets,
  renderBrandImportDrafts,
} from "@/domain/brand-import";
import { loadAutiqBrandPack } from "@/tools/autiq-brand";
import { projectRoot } from "@/lib/paths";

describe("brand-import", () => {
  it("redacts common secret patterns", () => {
    const { text, redactions } = redactSecrets(
      "key sk-abcdefghijklmnopqrstuv and Bearer FAKESECRET_e2f3g4h5i6j7k8l9m0n1",
    );
    expect(redactions).toBeGreaterThanOrEqual(2);
    expect(text).toMatch(/\[REDACTED\]/);
    expect(text).not.toMatch(/sk-abcdef/);
  });

  it("parses OpenAI conversations.json sample into section drafts", () => {
    const fixture = path.join(
      projectRoot(),
      "tests",
      "fixtures",
      "chatgpt-brand-sample.json",
    );
    const raw = fs.readFileSync(fixture, "utf8");
    const result = importBrandKnowledgeFromText({
      projectSlug: "autiq",
      sourcePath: fixture,
      rawText: raw,
    });
    expect(result.sourceKind).toBe("openai_conversations_json");
    expect(result.messageCount).toBeGreaterThanOrEqual(4);
    expect(result.redactions).toBeGreaterThanOrEqual(1);
    const sections = new Set(result.candidates.map((c) => c.section));
    expect(sections.has("positioning")).toBe(true);
    expect(sections.has("audience")).toBe(true);
    expect(sections.has("claims")).toBe(true);
    expect(sections.has("examples")).toBe(true);

    const drafts = renderBrandImportDrafts(result);
    expect(drafts["IMPORT_SUMMARY.md"]).toMatch(/PROPOSED|Candidates/i);
    expect(drafts["positioning.draft.md"]).toMatch(/Content Autopilot/i);
    expect(drafts["claims.draft.md"]).toMatch(/\[REDACTED\]|Do not invent|Never invent/i);
  });

  it("does not let _import affect live brand pack readiness", () => {
    const pack = loadAutiqBrandPack();
    expect(pack.ready).toBe(true);
    expect(pack.sections.every((s) => !s.relativePath.includes("_import"))).toBe(true);
  });
});
