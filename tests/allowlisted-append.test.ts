import fs from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendAllowlistedNote,
  parseAppendNoteFromDeveloperPrompt,
} from "@/tools/allowlisted-append";
import { sanitizeOllamaPlanForTest } from "@/providers/ollama-provider";
import type { PlanContext } from "@/providers/types";
import { projectRoot } from "@/lib/paths";

const toyReadme = path.join(projectRoot(), "workspaces", "toy-counter", "README.md");
let toyReadmeBackup: string | null = null;

describe("allowlisted-append", () => {
  it("parses AGENTS.md append prompts", () => {
    const parsed = parseAppendNoteFromDeveloperPrompt(
      "Append FACCI note to AGENTS.md in allowlisted grupvi-app",
    );
    expect(parsed?.relativePath).toBe("AGENTS.md");
    expect(parsed?.note).toMatch(/allowlisted/);
  });

  it("rejects unrelated coding prompts", () => {
    expect(
      parseAppendNoteFromDeveloperPrompt("Fix the login bug in src/auth.ts"),
    ).toBeNull();
  });

  it("sanitizer converts developer AGENTS note to append_allowlisted_note", () => {
    const input: PlanContext = {
      projectSlug: "grupvi",
      projectName: "Grupvi",
      title: "Grupvi / StudieChat app (allowlisted)",
      objective: [
        "Owner chat request (execute, do not only plan):",
        "Tilføj FACCI note til AGENTS.md i grupvi-app",
        "",
        "Append FACCI note to AGENTS.md (tiny allowlisted docs edit).",
      ].join("\n"),
      availableSpecialists: ["developer", "qa", "marketing"],
      projectMemories: [],
    };
    const plan = sanitizeOllamaPlanForTest(
      {
        specialistTemplateKey: "developer",
        reasoningSummary: "note",
        planningOnly: false,
        steps: [
          {
            sequence: 1,
            agentRole: "ceo",
            agentTemplateKey: "ceo",
            actionType: "receive_owner_request",
            summary: "received",
            requiresApproval: false,
          },
          {
            sequence: 2,
            agentRole: "manager",
            agentTemplateKey: "manager",
            actionType: "delegate_to_specialist",
            summary: "delegate",
            requiresApproval: false,
          },
        ],
      },
      input,
    );
    const append = plan.steps.find((s) => s.actionType === "append_allowlisted_note");
    expect(append).toBeTruthy();
    expect(append?.appendAllowlistedNote?.workspaceId).toBe("grupvi-app");
    expect(append?.appendAllowlistedNote?.relativePath).toBe("AGENTS.md");
    expect(plan.steps.some((s) => s.actionType === "run_developer_task")).toBe(false);
  });

  it("idempotent append on toy-counter README when allowlisted", () => {
    toyReadmeBackup = fs.readFileSync(toyReadme, "utf8");
    const note = "FACCI test note — temporary; idempotent.";
    const first = appendAllowlistedNote({
      workspaceId: "toy-counter",
      relativePath: "README.md",
      note,
    });
    expect(first.evidenceMarkdown).toMatch(/deterministic-allowlisted-append/);
    const second = appendAllowlistedNote({
      workspaceId: "toy-counter",
      relativePath: "README.md",
      note,
    });
    expect(second.evidenceMarkdown).toMatch(/already present/);
  });
});

afterEach(() => {
  if (toyReadmeBackup !== null) {
    fs.writeFileSync(toyReadme, toyReadmeBackup, "utf8");
    toyReadmeBackup = null;
  }
});
