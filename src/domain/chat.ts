import fs from "fs";
import path from "path";
import { z } from "zod";
import { createTask } from "@/domain/tasks";
import { prisma } from "@/lib/db";
import { projectRoot } from "@/lib/paths";
import { classifyOwnerIntent } from "@/domain/routing";
import {
  classifyRuntimeIntent,
  formatRuntimeChatReply,
  runRuntimeAction,
} from "@/domain/runtime-control";
import { pickDeveloperWorkspaceId } from "@/tools/workspace-routing";

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  projectId: z.string().min(1).optional(),
  /** Seed the intentional add()-bug in toy-counter before creating the task. */
  prepareDemoBug: z.boolean().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

const BROKEN_COUNTER = `export function add(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}
`;

/** Prefer an explicit brand/project mention over the default AUTIQ chat project. */
export function inferProjectSlugFromMessage(message: string): string | null {
  const m = message.trim();
  if (/\bnofacci\b/i.test(m)) return "nofacci";
  if (/\bdailycap\b/i.test(m)) return "dailycap";
  if (/\b(grupvi|studiechat)\b/i.test(m)) return "grupvi";
  if (/\bdreamit\b/i.test(m)) return "dreamit";
  if (/\bautiq\b/i.test(m)) return "autiq";
  if (/toy-counter|counter\.js/i.test(m)) return "autiq"; // demo still under portfolio default
  return null;
}

/**
 * When the owner names a brand in the message, that slug wins over the UI project picker.
 * Keeps multi-project chat honest when Hjem still has AUTIQ selected.
 */
export function resolveChatProjectSlug(params: {
  message: string;
  uiProjectSlug?: string | null;
}): string {
  const hinted = inferProjectSlugFromMessage(params.message);
  if (hinted) return hinted;
  if (params.uiProjectSlug) return params.uiProjectSlug;
  return "autiq";
}

const WORKSPACE_HINTS: Record<string, string> = {
  "toy-counter": "Workspace: **toy-counter** (demo).",
  autiq: "Workspace: **autiq** (brand content i FACCI).",
  "autiq-web": "Workspace: **autiq-web** (Desktop AUTIQ-main).",
  grupvi: "Workspace: **grupvi** (produkt-vault i FACCI).",
  "grupvi-app": "Workspace: **grupvi-app** (Desktop KARRIERE/studiechat).",
  dreamit: "Workspace: **dreamit** (produkt-vault i FACCI).",
  "dreamit-web": "Workspace: **dreamit-web** (Desktop DreamIT).",
  nofacci: "Workspace: **nofacci** (agency-vault i FACCI).",
  "nofacci-web": "Workspace: **nofacci-web** (agency hjemmeside).",
  dailycap: "Workspace: **dailycap** (produkt-vault i FACCI).",
};

/** File/workspace work that should become a developer task (not chat-only). */
export function isCodingChatIntent(message: string): boolean {
  const m = message.trim();
  if (!m) return false;
  const intent = classifyOwnerIntent("Chat request", m);
  // Research-first must not become a developer vault edit.
  if (intent.wantsResearch && !intent.wantsCoding) return false;
  if (intent.wantsCoding) return true;
  if (/toy-counter|counter\.js/i.test(m)) return true;
  if (
    /\b(autiq-main|autiq-web|brand\/voice|content\/calendar|grupvi-app|dreamit-web|nofacci-web|studiechat)\b/i.test(
      m,
    )
  ) {
    return true;
  }
  if (
    /\b(ret|fix|bug|fejl|opdater|skriv|udvid|tilføj|implement|byg\s+nu|build\s+now)\b/i.test(m) &&
    /\b(projekt|workspace|kode|test|add\s*\(|counter|brand|voice|kalender|calendar|caption|website|webapp|next|ux|product\/|notes\.md|index\.html|styles\.css)\b/i.test(
      m,
    )
  ) {
    return true;
  }
  if (/åbn\s+(mit\s+)?projekt/i.test(m) && /\b(ret|fix|undersøg|test)\b/i.test(m)) {
    return true;
  }
  if (
    /\bautiq\b/i.test(m) &&
    (/\b(brand\/voice|content\/calendar|voice\.md|calendar\.md)\b/i.test(m) ||
      (/\b(brand|voice|tone|kalender|calendar)\b/i.test(m) &&
        /\b(opdater|skriv|udvid|ret|fix|tilføj|update|edit|add)\b/i.test(m)))
  ) {
    return true;
  }
  if (
    /\b(grupvi|studiechat)\b/i.test(m) &&
    /\b(ux|product|note|app|opdater|skriv|tilføj|edit)\b/i.test(m) &&
    !intent.wantsResearch
  ) {
    return true;
  }
  if (
    /\bdreamit\b/i.test(m) &&
    /\b(product|note|website|opdater|skriv|tilføj|edit)\b/i.test(m) &&
    !intent.wantsResearch
  ) {
    return true;
  }
  if (
    /\bnofacci\b/i.test(m) &&
    /\b(nofacci-web|index\.html|styles\.css|opdater|skriv|tilføj|edit|byg\s+nu|build\s+now|implement)\b/i.test(
      m,
    ) &&
    !intent.wantsResearch
  ) {
    return true;
  }
  if (
    /\bdailycap\b/i.test(m) &&
    /\b(brand|product|note|opdater|skriv|tilføj|edit)\b/i.test(m) &&
    !intent.wantsResearch
  ) {
    return true;
  }
  return false;
}

export function prepareToyCounterBug(): {
  prepared: boolean;
  path: string;
  details: string;
} {
  const filePath = path.join(projectRoot(), "workspaces", "toy-counter", "src", "counter.js");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, BROKEN_COUNTER, "utf8");
  return {
    prepared: true,
    path: "workspaces/toy-counter/src/counter.js",
    details: "Seeded intentional bug: add(a,b) returns a - b.",
  };
}

function codingObjectiveForWorkspace(
  workspaceId: string,
  message: string,
): { title: string; objective: string } {
  const owner = [
    "Owner chat request (execute, do not only plan):",
    message.trim(),
    "",
  ];

  if (workspaceId === "toy-counter") {
    return {
      title: "Ret fejl i toy-counter workspace",
      objective: [
        ...owner,
        "In the allowlisted toy-counter workspace, investigate src/counter.js.",
        "Fix add(a, b) so it returns a + b. Keep multiply unchanged.",
        "Run the workspace tests and report evidence.",
        "Do not merge, push, publish, or touch files outside the allowlist.",
      ].join("\n"),
    };
  }

  if (workspaceId === "autiq-web") {
    return {
      title: "AUTIQ website (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted autiq-web workspace (Desktop AUTIQ-main).",
        "Prefer a tiny docs edit: docs/*.md, README.md, or AGENTS.md — not a large app refactor.",
        "Do not touch .env, node_modules, secrets, or imagegen.",
        "Run the workspace check command and report evidence.",
        "Do not merge, push, publish, or deploy.",
      ].join("\n"),
    };
  }

  if (workspaceId === "autiq") {
    return {
      title: "AUTIQ brand content (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted autiq workspace (FACCI workspaces/autiq).",
        "Edit brand/voice.md and/or content/calendar.md as needed.",
        "Keep tone consistent with existing brand notes. Do not invent secrets or external posts.",
        "Run the workspace check command and report evidence.",
        "Do not publish, send messages, or touch files outside the allowlist.",
      ].join("\n"),
    };
  }

  if (workspaceId === "grupvi-app") {
    return {
      title: "Grupvi / StudieChat app (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted grupvi-app workspace (Desktop KARRIERE/studiechat).",
        "Append FACCI note to AGENTS.md (tiny allowlisted docs edit).",
        "Do not touch .env, supabase/, node_modules, or secrets.",
        "Run the workspace check command and report evidence.",
        "Do not merge, push, publish, or ship to stores.",
      ].join("\n"),
    };
  }

  if (workspaceId === "grupvi") {
    return {
      title: "Grupvi product vault (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted grupvi workspace (FACCI workspaces/grupvi).",
        "Edit product/ux-notes.md (and research/ if needed).",
        "Do not invent user interviews. Do not publish.",
        "Run the workspace check command and report evidence.",
      ].join("\n"),
    };
  }

  if (workspaceId === "dreamit-web") {
    return {
      title: "DreamIT website (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted dreamit-web workspace (Desktop DreamIT).",
        "Append FACCI note to AGENTS.md (tiny allowlisted docs edit).",
        "Do not touch .env, node_modules, .next, or secrets.",
        "Run the workspace check command and report evidence.",
        "Do not merge, push, publish, or deploy.",
      ].join("\n"),
    };
  }

  if (workspaceId === "dreamit") {
    return {
      title: "DreamIT product vault (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted dreamit workspace (FACCI workspaces/dreamit).",
        "Edit product/notes.md (and research/ if needed).",
        "Do not invent customers or metrics. Do not publish.",
        "Run the workspace check command and report evidence.",
      ].join("\n"),
    };
  }

  if (workspaceId === "nofacci-web") {
    return {
      title: "NOFACCI agency website (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted nofacci-web workspace (FACCI workspaces/nofacci-web).",
        "Build/edit the static agency site (index.html, styles.css, public/, inspiration/).",
        "Follow brand pack in workspaces/nofacci/brand (character-first). No invented metrics or fake testimonials.",
        "Use inspiration/ only as visual reference — brand pack wins on claims.",
        "Run the workspace check command and report evidence. Do not deploy or publish.",
      ].join("\n"),
    };
  }

  if (workspaceId === "nofacci") {
    return {
      title: "NOFACCI agency vault (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted nofacci workspace (FACCI workspaces/nofacci).",
        "Edit brand/* or product/notes.md (content/ drafts only).",
        "Keep profiles distinct. Do not invent metrics or live account status. Do not publish.",
        "Run the workspace check command and report evidence.",
      ].join("\n"),
    };
  }

  if (workspaceId === "dailycap") {
    return {
      title: "DailyCap product vault (allowlisted)",
      objective: [
        ...owner,
        "Work only in the allowlisted dailycap workspace (FACCI workspaces/dailycap).",
        "Edit brand/* or product/notes.md (research/ if needed).",
        "Do not invent launch status, savings metrics, or bank guarantees. Do not publish.",
        "Run the workspace check command and report evidence.",
      ].join("\n"),
    };
  }

  return {
    title: `Allowlisted workspace: ${workspaceId}`,
    objective: [
      ...owner,
      `Work only in allowlisted workspaceId "${workspaceId}".`,
      "Run the workspace check command and report evidence.",
      "Do not merge, push, publish, or touch files outside the allowlist.",
    ].join("\n"),
  };
}

export function buildChatTaskFields(
  message: string,
  projectSlug = "autiq",
): {
  title: string;
  objective: string;
  coding: boolean;
  workspaceId: string | null;
} {
  const slug = resolveChatProjectSlug({ message, uiProjectSlug: projectSlug });
  const coding = isCodingChatIntent(message);
  if (coding) {
    const workspaceId = pickDeveloperWorkspaceId({
      projectSlug: slug,
      title: "Chat developer request",
      objective: message,
    });
    const fields = codingObjectiveForWorkspace(workspaceId, message);
    return { ...fields, coding: true, workspaceId };
  }

  const intent = classifyOwnerIntent("Chat request", message);
  const title =
    message.trim().length > 72 ? `${message.trim().slice(0, 69)}…` : message.trim();

  if (intent.wantsResearch) {
    return {
      title: title.startsWith("Research") ? title : `Research: ${title}`.slice(0, 120),
      objective: [
        "Owner chat request (research — do not code yet unless explicitly asked later):",
        message.trim(),
        "",
        `Project slug: ${slug}.`,
        "Research specialist: concept brief with provenance labels (observed/inferred/proposed/blocked).",
        "Use brand pack + inspiration notes when present. Do not invent metrics, customers, or live account status.",
        "External URLs are references only unless fetched with evidence — mark blocked if not verified.",
        "Do not edit HTML/CSS or claim a website was built in this task.",
        "Do not invent external actions. Stop for approval on high-risk steps.",
      ].join("\n"),
      coding: false,
      workspaceId: null,
    };
  }

  return {
    title,
    objective: [
      "Owner chat request:",
      message.trim(),
      "",
      `Project slug: ${slug}.`,
      "Delegate via FACCI CEO → project manager → specialist.",
      "Produce a real project-scoped artifact or executed tool evidence.",
      "Do not invent external actions. Stop for approval on high-risk steps.",
    ].join("\n"),
    coding: false,
    workspaceId: null,
  };
}

export async function handleChatMessage(raw: ChatRequest) {
  const input = ChatRequestSchema.parse(raw);
  const message = input.message.trim();

  const uiProject =
    input.projectId != null
      ? await prisma.project.findUnique({ where: { id: input.projectId } })
      : null;

  const resolvedSlug = resolveChatProjectSlug({
    message,
    uiProjectSlug: uiProject?.slug ?? null,
  });

  let project = await prisma.project.findFirst({ where: { slug: resolvedSlug } });
  if (!project && uiProject) project = uiProject;
  if (!project) {
    project =
      (await prisma.project.findFirst({ where: { slug: "autiq" } })) ??
      (await prisma.project.findFirst({ orderBy: { createdAt: "asc" } }));
  }
  if (!project) throw new Error("No project available");

  // Runtime / game-mode: act immediately — do not create a fake agent task.
  const runtimeIntent = classifyRuntimeIntent(message);
  if (runtimeIntent) {
    const result = runRuntimeAction(runtimeIntent.action);
    return {
      reply: formatRuntimeChatReply(result),
      project: { id: project.id, name: project.name, slug: project.slug },
      task: null,
      coding: false,
      workspaceId: null,
      preparedBug: null,
      runtime: {
        action: runtimeIntent.action,
        ok: result.ok,
        detail: result.raw,
      },
    };
  }

  const fields = buildChatTaskFields(message, project.slug);
  const shouldPrepare =
    Boolean(input.prepareDemoBug) ||
    (fields.coding &&
      fields.workspaceId === "toy-counter" &&
      /toy-counter|counter\.js|demo|e2e/i.test(message));

  let prepared: ReturnType<typeof prepareToyCounterBug> | null = null;
  if (shouldPrepare && fields.coding) {
    prepared = prepareToyCounterBug();
  }

  const preferOpenCode = process.env.FACCI_PREFER_OPENCODE === "1";
  const objective = fields.coding
    ? [
        fields.objective,
        "",
        `Allowlisted workspaceId: ${fields.workspaceId}.`,
        `Executor preference: preferOpenCode=${preferOpenCode}.`,
      ].join("\n")
    : fields.objective;

  const task = await createTask({
    projectId: project.id,
    title: fields.title,
    objective,
    origin: "operational",
    idempotencyKey: `chat-${project.id}-${Date.now()}`,
  });

  const workspaceHint =
    fields.workspaceId != null ? (WORKSPACE_HINTS[fields.workspaceId] ?? null) : null;

  const replyLines = [
    fields.coding
      ? `Forstået — jeg sætter en lokal developer-opgave i gang hos **${project.name}**.`
      : `Forstået — jeg opretter en opgave hos **${project.name}** og delegerer via FACCI.`,
    workspaceHint,
    prepared
      ? `Jeg har forberedt en kendt fejl i \`${prepared.path}\` (add returnerer a−b), så der er noget konkret at rette.`
      : null,
    `Opgave: **${task.title}**`,
    `Status starter som **${task.status}**. Worker + lokal Ollama planlægger og udfører — det er ikke bare et chat-svar.`,
    fields.coding
      ? "Developer-path: allowlisted filændring + workspace-check. Ingen merge/publish uden din godkendelse."
      : "Specialist-path: artefact/evidence i projektet. Ingen eksterne side effects uden godkendelse.",
  ].filter(Boolean);

  return {
    reply: replyLines.join("\n\n"),
    project: { id: project.id, name: project.name, slug: project.slug },
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      origin: task.origin,
    },
    coding: fields.coding,
    workspaceId: fields.workspaceId,
    preparedBug: prepared,
    runtime: null,
  };
}
