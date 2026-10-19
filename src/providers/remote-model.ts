import fs from "fs";
import path from "path";
import { checkBudget, consumeBudget } from "@/domain/budgets";
import { projectRoot } from "@/lib/paths";

export type RemoteModelConfig = {
  enabled: boolean;
  provider: string;
  baseUrl: string | null;
  modelId: string | null;
  /** Never log the key; presence only. */
  apiKeyConfigured: boolean;
  notes: string;
};

/**
 * Optional remote model opt-in (M6). Default: disabled / not configured.
 * Does not call paid APIs unless consent + key + budget allow.
 */
export function loadRemoteModelConfig(): RemoteModelConfig {
  const configPath = path.join(projectRoot(), "config", "remote-models.json");
  let fileEnabled = false;
  let provider = "none";
  let baseUrl: string | null = null;
  let modelId: string | null = null;
  let notes = "No remote model config file.";
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
      fileEnabled = raw.enabled === true;
      provider = typeof raw.provider === "string" ? raw.provider : "custom";
      baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl : null;
      modelId = typeof raw.modelId === "string" ? raw.modelId : null;
      notes = typeof raw.notes === "string" ? raw.notes : notes;
    } catch {
      notes = "remote-models.json present but invalid JSON.";
    }
  }
  const envKey = process.env.FACCI_REMOTE_MODEL_API_KEY?.trim();
  const envUrl = process.env.FACCI_REMOTE_MODEL_BASE_URL?.trim();
  const envModel = process.env.FACCI_REMOTE_MODEL_ID?.trim();
  const envConsent = process.env.FACCI_REMOTE_MODEL_CONSENT === "1";

  return {
    enabled: fileEnabled || envConsent,
    provider,
    baseUrl: envUrl || baseUrl,
    modelId: envModel || modelId,
    apiKeyConfigured: Boolean(envKey),
    notes,
  };
}

export type RemoteModelStatus = RemoteModelConfig & {
  ready: boolean;
  blockedReason: string | null;
  billingNote: string;
};

export function getRemoteModelStatus(): RemoteModelStatus {
  const cfg = loadRemoteModelConfig();
  const billingNote =
    "Remote inference may incur third-party charges. FACCI only tracks local call counters — not vendor invoices.";
  if (!cfg.enabled) {
    return {
      ...cfg,
      ready: false,
      blockedReason: "Remote models disabled (opt-in required).",
      billingNote,
    };
  }
  if (!cfg.baseUrl || !cfg.apiKeyConfigured) {
    return {
      ...cfg,
      ready: false,
      blockedReason: "Remote model base URL or API key not configured.",
      billingNote,
    };
  }
  return { ...cfg, ready: true, blockedReason: null, billingNote };
}

/**
 * Attempt a remote completion. Fail closed without consent/budget/config.
 * Returns honest blocked result rather than inventing model text.
 */
export async function tryRemoteCompletion(params: {
  organizationId: string;
  projectId: string;
  prompt: string;
}): Promise<{
  ok: boolean;
  text?: string;
  modelId?: string;
  blockedReason?: string;
  latencyMs?: number;
}> {
  const status = getRemoteModelStatus();
  if (!status.ready) {
    return { ok: false, blockedReason: status.blockedReason ?? "Remote model not ready" };
  }

  const gate = await checkBudget({
    organizationId: params.organizationId,
    projectId: params.projectId,
    dimension: "remoteCalls",
  });
  if (!gate.allowed) {
    return { ok: false, blockedReason: gate.reason };
  }

  const key = process.env.FACCI_REMOTE_MODEL_API_KEY!.trim();
  const started = Date.now();
  try {
    // OpenAI-compatible chat completions shape (common local/cloud gateways).
    const res = await fetch(`${status.baseUrl!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: status.modelId ?? "default",
        messages: [
          {
            role: "system",
            content:
              "You are an optional FACCI remote assistant. Be concise. Do not invent tool results.",
          },
          { role: "user", content: params.prompt.slice(0, 8000) },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        blockedReason: `Remote provider HTTP ${res.status}: ${body.slice(0, 200)}`,
        latencyMs,
      };
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, blockedReason: "Remote provider returned empty content", latencyMs };
    }
    await consumeBudget({
      organizationId: params.organizationId,
      projectId: params.projectId,
      dimension: "remoteCalls",
    });
    return {
      ok: true,
      text,
      modelId: json.model ?? status.modelId ?? undefined,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      blockedReason: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - started,
    };
  }
}
