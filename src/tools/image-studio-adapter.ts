import { z } from "zod";
import { loadIntegrationsConfig } from "@/tools/integrations-config";
import type { ToolRequest } from "@/tools/policy";

const ImageStudioInputSchema = z.object({
  prompt: z.string().min(1).max(8000),
  negativePrompt: z.string().max(4000).optional(),
  mode: z.enum(["txt2img", "img2img", "character", "pose"]).optional(),
  workflowKey: z.string().min(1).max(80).optional(),
  characterId: z.string().min(1).max(80).optional(),
  /** When false, only readiness + prepared request — no Comfy queue. */
  execute: z.boolean().optional(),
});

export type ImageStudioHealth = {
  available: boolean;
  connected: boolean;
  baseUrl: string;
  checkpoints: string[];
  characterReady: boolean;
  details: string;
};

export type ImageStudioLocalMedia = {
  sourcePath: string;
  studioUrl?: string;
  filename: string;
};

export type ImageStudioResult = {
  toolId: "image-studio";
  executed: boolean;
  preparedOnly: boolean;
  generationId?: string;
  status?: string;
  outputUrls: string[];
  outputPaths: string[];
  /** Studio disk paths + urls ready for FACCI-local copy */
  localMediaCandidates: ImageStudioLocalMedia[];
  studioUrl: string;
  readiness: ImageStudioHealth;
  latencyMs: number;
  evidenceMarkdown: string;
  error?: string;
};

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 15_000,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

export async function checkImageStudioHealth(): Promise<ImageStudioHealth> {
  const cfg = loadIntegrationsConfig().imageStudio;
  const baseUrl = cfg.baseUrl.replace(/\/$/, "");
  try {
    const { ok, data, text } = await fetchJson<{
      connected?: boolean;
      checkpoints?: string[];
      character?: { ready?: boolean; missing?: string[] };
      error?: string;
    }>(`${baseUrl}/api/comfy/readiness`);
    if (!ok || !data) {
      return {
        available: false,
        connected: false,
        baseUrl,
        checkpoints: [],
        characterReady: false,
        details: `Image Studio readiness HTTP failure: ${text.slice(0, 200)}`,
      };
    }
    const connected = Boolean(data.connected);
    const checkpoints = data.checkpoints ?? [];
    const characterReady = Boolean(data.character?.ready);
    return {
      available: true,
      connected,
      baseUrl,
      checkpoints,
      characterReady,
      details: connected
        ? `Image Studio online at ${baseUrl}; Comfy connected; checkpoints=${checkpoints.length}; characterReady=${characterReady}`
        : `Image Studio reachable but Comfy not ready: ${data.error ?? data.character?.missing?.join(", ") ?? "unknown"}`,
    };
  } catch (err) {
    return {
      available: false,
      connected: false,
      baseUrl,
      checkpoints: [],
      characterReady: false,
      details: err instanceof Error ? err.message : "Image Studio unreachable",
    };
  }
}

export class ImageStudioAdapter {
  async execute(request: ToolRequest, signal?: AbortSignal): Promise<ImageStudioResult> {
    const started = Date.now();
    const cfg = loadIntegrationsConfig().imageStudio;
    const input = ImageStudioInputSchema.parse(request.input);
    const readiness = await checkImageStudioHealth();
    const mode = input.mode ?? cfg.defaultMode;
    const workflowKey = input.workflowKey ?? cfg.defaultWorkflowKey;
    const shouldExecute =
      (input.execute ?? cfg.executeByDefault) && readiness.available && readiness.connected;

    const preparedPayload = {
      mode,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt ?? "blurry, low quality, watermark, deformed",
      workflowKey,
      characterId: input.characterId,
      settings: {
        ...cfg.defaultSettings,
        seed:
          cfg.defaultSettings.seed < 0
            ? Math.floor(Math.random() * 1_000_000)
            : cfg.defaultSettings.seed,
        checkpoint: readiness.checkpoints[0],
      },
    };

    if (!shouldExecute) {
      const reason = !readiness.available
        ? readiness.details
        : !readiness.connected
          ? readiness.details
          : "Execution disabled (IMAGE_STUDIO_EXECUTE=0 or execute:false) — prepared request only";
      return {
        toolId: "image-studio",
        executed: false,
        preparedOnly: true,
        outputUrls: [],
        outputPaths: [],
        localMediaCandidates: [],
        studioUrl: readiness.baseUrl,
        readiness,
        latencyMs: Date.now() - started,
        error: reason,
        evidenceMarkdown: `# Image Studio — prepared request (not executed)

- Studio: ${readiness.baseUrl}
- Status: **prepared only** (no generation claimed)
- Reason: ${reason}
- Mode/workflow: ${mode} / ${workflowKey}

## Prepared payload
\`\`\`json
${JSON.stringify(preparedPayload, null, 2)}
\`\`\`

Open Image Studio UI to run manually if needed: ${readiness.baseUrl}
`,
      };
    }

    const post = await fetchJson<{
      id?: string;
      status?: string;
      error?: string;
      outputImages?: { url?: string; path?: string }[];
    }>(
      `${readiness.baseUrl}/api/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preparedPayload),
        signal,
      },
      60_000,
    );

    if (!post.ok || !post.data?.id) {
      const err =
        (post.data as { error?: string } | null)?.error ??
        post.text.slice(0, 400) ??
        `HTTP ${post.status}`;
      return {
        toolId: "image-studio",
        executed: false,
        preparedOnly: false,
        outputUrls: [],
        outputPaths: [],
        localMediaCandidates: [],
        studioUrl: readiness.baseUrl,
        readiness,
        latencyMs: Date.now() - started,
        error: `Image Studio generate rejected: ${err}`,
        evidenceMarkdown: `# Image Studio — generate failed

- Studio: ${readiness.baseUrl}
- Error: ${err}
- No successful generation claimed.

## Request
\`\`\`json
${JSON.stringify(preparedPayload, null, 2)}
\`\`\`
`,
      };
    }

    const generationId = post.data.id;
    let status = post.data.status ?? "queued";
    let outputImages = post.data.outputImages ?? [];
    let lastError: string | undefined;

    const deadline = Date.now() + cfg.pollTimeoutMs;
    while (
      !["completed", "failed", "error"].includes(status) &&
      Date.now() < deadline
    ) {
      if (signal?.aborted) throw new Error("Image Studio poll aborted");
      await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
      const poll = await fetchJson<{
        id?: string;
        status?: string;
        errorMessage?: string | null;
        outputImages?: { url?: string; path?: string }[];
      }>(`${readiness.baseUrl}/api/generate/${generationId}/status`, undefined, 30_000);
      if (!poll.ok || !poll.data) {
        lastError = `status poll failed: ${poll.text.slice(0, 200)}`;
        continue;
      }
      status = poll.data.status ?? status;
      outputImages = poll.data.outputImages ?? outputImages;
      if (poll.data.errorMessage) lastError = poll.data.errorMessage;
    }

    const outputUrls = outputImages
      .map((o) => (o.url ? `${readiness.baseUrl}${o.url}` : undefined))
      .filter((u): u is string => Boolean(u));
    const outputPaths = outputImages.map((o) => o.path).filter((p): p is string => Boolean(p));
    const localMediaCandidates: ImageStudioLocalMedia[] = outputImages
      .filter((o) => o.path)
      .map((o, idx) => ({
        sourcePath: o.path as string,
        studioUrl: o.url ? `${readiness.baseUrl}${o.url}` : undefined,
        filename:
          (o as { filename?: string }).filename ??
          `studio-${generationId}-${idx}.png`,
      }));
    const completed =
      status === "completed" && (outputUrls.length > 0 || outputPaths.length > 0);

    if (!completed) {
      return {
        toolId: "image-studio",
        executed: true,
        preparedOnly: false,
        generationId,
        status,
        outputUrls,
        outputPaths,
        localMediaCandidates: [],
        studioUrl: readiness.baseUrl,
        readiness,
        latencyMs: Date.now() - started,
        error: lastError ?? `Generation ended without outputs (status=${status})`,
        evidenceMarkdown: `# Image Studio — generation incomplete

- Generation id: \`${generationId}\`
- Final status: **${status}**
- Error: ${lastError ?? "(none)"}
- Outputs: ${outputUrls.length}
- **Not claiming success**

Studio: ${readiness.baseUrl}
`,
      };
    }

    return {
      toolId: "image-studio",
      executed: true,
      preparedOnly: false,
      generationId,
      status,
      outputUrls,
      outputPaths,
      localMediaCandidates,
      studioUrl: readiness.baseUrl,
      readiness,
      latencyMs: Date.now() - started,
      evidenceMarkdown: `# Image Studio — generation completed

- Generation id: \`${generationId}\`
- Status: **completed** (verified via Studio status API)
- Latency: ${Date.now() - started} ms
- Mode/workflow: ${mode} / ${workflowKey}
- Checkpoint: ${preparedPayload.settings.checkpoint ?? "(default)"}

## Outputs
${outputUrls.map((u) => `- ${u}`).join("\n") || "(url missing)"}
${outputPaths.map((p) => `- path: \`${p}\``).join("\n")}

## Prompt
${input.prompt}

_FACCI Image Studio adapter — real HTTP call to ${readiness.baseUrl}; not simulated._
`,
    };
  }
}
