/**
 * Deterministic AUTIQ brand-vault calendar writer.
 * Used by the weekly content loop so caption rows do not depend on a small LLM patch.
 */
import fs from "fs";
import path from "path";
import {
  WEEKLY_LOOP_CHANNELS,
  type WeeklyBrief,
  captionsForWeeklyChannels,
} from "@/domain/content-loop";
import { isPathAllowed, resolveWorkspace } from "@/tools/workspace";

const CALENDAR_REL = "content/calendar.md";

export function applyWeeklyCalendarCaptions(
  markdown: string,
  captions: string[],
  weekLabel = new Date().toISOString().slice(0, 10),
): { markdown: string; updatedChannels: string[] } {
  if (captions.length !== WEEKLY_LOOP_CHANNELS.length) {
    throw new Error(
      `Expected ${WEEKLY_LOOP_CHANNELS.length} captions, got ${captions.length}`,
    );
  }
  const updatedChannels: string[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const next = lines.map((line) => {
    const m = line.match(
      /^\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*$/,
    );
    if (!m) return line;
    const channel = m[2].trim();
    const idx = WEEKLY_LOOP_CHANNELS.findIndex((c) => c === channel);
    if (idx < 0) return line;
    const idea = captions[idx].replace(/\|/g, "/").replace(/\s+/g, " ").trim();
    updatedChannels.push(channel);
    return `| ${weekLabel} | ${channel} | ${idea} | draft |`;
  });

  for (const channel of WEEKLY_LOOP_CHANNELS) {
    if (!updatedChannels.includes(channel)) {
      throw new Error(`Calendar missing required channel row: ${channel}`);
    }
  }

  return { markdown: next.join("\n"), updatedChannels };
}

export function writeAutiqWeeklyCalendar(brief: WeeklyBrief): {
  workspaceId: "autiq";
  relativePath: string;
  absolutePath: string;
  updatedChannels: string[];
  captions: string[];
  weekLabel: string;
  evidenceMarkdown: string;
} {
  const { config, absolutePath: root } = resolveWorkspace("autiq");
  if (!isPathAllowed(config, CALENDAR_REL)) {
    throw new Error(`Calendar path not allowlisted: ${CALENDAR_REL}`);
  }
  const abs = path.join(root, CALENDAR_REL);
  if (!fs.existsSync(abs)) {
    throw new Error(`Calendar file missing: ${abs}`);
  }

  const captions = captionsForWeeklyChannels(brief);
  const weekLabel = new Date().toISOString().slice(0, 10);
  const before = fs.readFileSync(abs, "utf8");
  const { markdown, updatedChannels } = applyWeeklyCalendarCaptions(
    before,
    captions,
    weekLabel,
  );
  fs.writeFileSync(abs, markdown.endsWith("\n") ? markdown : `${markdown}\n`, "utf8");

  const evidenceMarkdown = `# AUTIQ calendar update (deterministic)

- Workspace: \`autiq\`
- File: \`${CALENDAR_REL}\`
- Executor: **deterministic-calendar-writer** (not OpenCode / not bounded-patch)
- Week: ${weekLabel}
- Channels updated: ${updatedChannels.map((c) => `\`${c}\``).join(", ")}

## Captions written
${updatedChannels.map((c, i) => `- **${c}:** ${captions[i]}`).join("\n")}

Status column left as \`draft\`. No publish.
`;

  return {
    workspaceId: "autiq",
    relativePath: CALENDAR_REL,
    absolutePath: abs,
    updatedChannels,
    captions,
    weekLabel,
    evidenceMarkdown,
  };
}
