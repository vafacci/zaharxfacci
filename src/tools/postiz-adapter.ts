import fs from "fs";
import path from "path";
import { z } from "zod";
import { loadIntegrationsConfig } from "@/tools/integrations-config";
import { ensureProjectArtifactDir } from "@/lib/paths";
import type { ToolRequest } from "@/tools/policy";

const SocialDraftInputSchema = z.object({
  caption: z.string().min(1).max(8000),
  channel: z.string().min(1).max(64).default("instagram"),
  calendarSlot: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
  imageUrls: z.array(z.string()).max(8).optional(),
  /** Attempt Postiz public API draft when configured. Never schedule/publish. */
  attemptPostizDraft: z.boolean().default(true),
});

export type PostizHealth = {
  configured: boolean;
  reachable: boolean;
  baseUrl: string;
  details: string;
};

export type SocialDraftResult = {
  toolId: "postiz";
  stagedLocally: boolean;
  postizDraftCreated: boolean;
  postizPostId?: string;
  localStagingRef: string;
  calendarRef: string;
  health: PostizHealth;
  evidenceMarkdown: string;
  error?: string;
};

export async function checkPostizHealth(): Promise<PostizHealth> {
  const cfg = loadIntegrationsConfig().postiz;
  const baseUrl = (cfg.baseUrl || "").replace(/\/$/, "");
  const apiKey = process.env[cfg.apiKeyEnv]?.trim();
  if (!baseUrl || !apiKey) {
    return {
      configured: false,
      reachable: false,
      baseUrl: baseUrl || "(not set)",
      details:
        "Postiz not configured — set POSTIZ_BASE_URL and POSTIZ_API_KEY for draft API. Local social staging still available.",
    };
  }
  try {
    const res = await fetch(`${baseUrl}/public/v1/integrations`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return {
        configured: true,
        reachable: true,
        baseUrl,
        details: `Postiz reachable at ${baseUrl} (integrations API OK)`,
      };
    }
    // Some installs nest under /api
    const res2 = await fetch(`${baseUrl}/api/public/v1/integrations`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(5000),
    });
    if (res2.ok) {
      return {
        configured: true,
        reachable: true,
        baseUrl,
        details: `Postiz reachable at ${baseUrl}/api (integrations API OK)`,
      };
    }
    return {
      configured: true,
      reachable: false,
      baseUrl,
      details: `Postiz configured but integrations probe failed HTTP ${res.status}/${res2.status}`,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      baseUrl,
      details: err instanceof Error ? err.message : "Postiz unreachable",
    };
  }
}

function resolvePostsUrl(baseUrl: string): string[] {
  const b = baseUrl.replace(/\/$/, "");
  return [`${b}/public/v1/posts`, `${b}/api/public/v1/posts`];
}

export class PostizAdapter {
  async stageDraft(
    request: ToolRequest,
    projectSlug: string,
  ): Promise<SocialDraftResult> {
    const input = SocialDraftInputSchema.parse(request.input);
    const health = await checkPostizHealth();
    const cfg = loadIntegrationsConfig().postiz;
    const dir = ensureProjectArtifactDir(projectSlug);
    const stagingDir = path.join(dir, "social-staging");
    fs.mkdirSync(stagingDir, { recursive: true });
    const stamp = Date.now();
    const draftName = `${stamp}-social-draft.md`;
    const calendarName = `${stamp}-content-calendar.json`;
    const draftPath = path.join(stagingDir, draftName);
    const calendarPath = path.join(stagingDir, calendarName);

    const slot = input.calendarSlot ?? new Date(Date.now() + 86400000).toISOString();
    const draftMd = `# Social draft (FACCI staging)

- Project: ${projectSlug}
- Channel: ${input.channel}
- Proposed slot (UTC): ${slot}
- Title: ${input.title ?? "(none)"}
- Postiz: ${health.configured ? (health.reachable ? "reachable" : "configured but unreachable") : "not configured"}

## Caption
${input.caption}

## Images
${(input.imageUrls ?? []).map((u) => `- ${u}`).join("\n") || "(none linked)"}

---
_Local staging only until Postiz draft succeeds. Publishing requires separate human approval._
`;
    fs.writeFileSync(draftPath, draftMd, "utf8");
    const calendar = {
      projectSlug,
      channel: input.channel,
      proposedSlotUtc: slot,
      captionPreview: input.caption.slice(0, 280),
      imageUrls: input.imageUrls ?? [],
      status: "staged_local",
      postizDraftId: null as string | null,
      createdAt: new Date().toISOString(),
    };

    let postizDraftCreated = false;
    let postizPostId: string | undefined;
    let error: string | undefined;

    if (input.attemptPostizDraft && health.configured && health.reachable) {
      const apiKey = process.env[cfg.apiKeyEnv]!.trim();
      const integrationId = process.env[cfg.integrationIdEnv]?.trim();
      if (!integrationId) {
        error =
          "POSTIZ_INTEGRATION_ID missing — cannot create Postiz draft (local staging kept)";
      } else {
        const body = {
          type: "draft" as const,
          date: slot,
          shortLink: false,
          tags: [] as { value: string; label: string }[],
          posts: [
            {
              integration: { id: integrationId },
              value: [
                {
                  content: input.caption,
                  image: [] as { id: string }[],
                },
              ],
              settings: { __type: input.channel },
            },
          ],
        };
        let created = false;
        for (const url of resolvePostsUrl(health.baseUrl)) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: {
                Authorization: apiKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
              signal: AbortSignal.timeout(20_000),
            });
            const text = await res.text();
            if (!res.ok) {
              error = `Postiz draft HTTP ${res.status} at ${url}: ${text.slice(0, 300)}`;
              continue;
            }
            let parsed: unknown = null;
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = text;
            }
            postizDraftCreated = true;
            created = true;
            postizPostId =
              typeof parsed === "object" &&
              parsed &&
              "id" in parsed &&
              typeof (parsed as { id: unknown }).id === "string"
                ? (parsed as { id: string }).id
                : typeof text === "string"
                  ? text.slice(0, 80)
                  : "created";
            calendar.status = "postiz_draft";
            calendar.postizDraftId = postizPostId;
            error = undefined;
            break;
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
          }
        }
        if (!created && !error) {
          error = "Postiz draft endpoints rejected the request";
        }
      }
    } else if (input.attemptPostizDraft && !health.configured) {
      error = health.details;
    } else if (input.attemptPostizDraft && !health.reachable) {
      error = health.details;
    }

    fs.writeFileSync(calendarPath, JSON.stringify(calendar, null, 2), "utf8");
    const localStagingRef = path.join(
      "data",
      "artifacts",
      projectSlug,
      "social-staging",
      draftName,
    );
    const calendarRef = path.join(
      "data",
      "artifacts",
      projectSlug,
      "social-staging",
      calendarName,
    );

    return {
      toolId: "postiz",
      stagedLocally: true,
      postizDraftCreated,
      postizPostId,
      localStagingRef,
      calendarRef,
      health,
      error,
      evidenceMarkdown: `# Social draft staging

- Local draft: \`${localStagingRef}\`
- Calendar JSON: \`${calendarRef}\`
- Postiz draft created: **${postizDraftCreated ? "yes" : "no"}**
${postizPostId ? `- Postiz id: \`${postizPostId}\`` : ""}
${error ? `- Note: ${error}` : ""}
- Channel: ${input.channel}
- Slot: ${slot}

**Honesty:** ${
        postizDraftCreated
          ? "Postiz draft API succeeded (type=draft only — not scheduled/published)."
          : "No Postiz draft claimed. Content is staged locally for review."
      }

Publishing / schedule / now remain blocked without separate human approval.
`,
    };
  }
}
