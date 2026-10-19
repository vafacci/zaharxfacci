import fs from "fs";
import path from "path";

export type IntegrationsConfig = {
  imageStudio: {
    baseUrl: string;
    executeByDefault: boolean;
    defaultMode: "txt2img" | "img2img" | "character" | "pose";
    defaultWorkflowKey: string;
    pollIntervalMs: number;
    pollTimeoutMs: number;
    defaultSettings: {
      width: number;
      height: number;
      steps: number;
      cfg: number;
      seed: number;
      batchCount: number;
      samplerName: string;
      scheduler: string;
      denoise: number;
      identityStrength: number;
      referencePriority: "balanced" | "prompt";
      checkpoint?: string;
    };
  };
  postiz: {
    baseUrl: string;
    apiKeyEnv: string;
    integrationIdEnv: string;
    draftsOnly: boolean;
  };
  n8n: {
    baseUrl: string;
    apiKeyEnv: string;
    allowLiveExecution: boolean;
  };
};

let cached: IntegrationsConfig | null = null;

export function loadIntegrationsConfig(): IntegrationsConfig {
  if (cached) return cached;
  const file = path.join(process.cwd(), "config", "integrations.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as IntegrationsConfig;
  // Env overrides (no secrets in JSON)
  if (process.env.IMAGE_STUDIO_BASE_URL?.trim()) {
    raw.imageStudio.baseUrl = process.env.IMAGE_STUDIO_BASE_URL.trim().replace(/\/$/, "");
  }
  if (process.env.IMAGE_STUDIO_EXECUTE === "0") {
    raw.imageStudio.executeByDefault = false;
  }
  if (process.env.POSTIZ_BASE_URL?.trim()) {
    raw.postiz.baseUrl = process.env.POSTIZ_BASE_URL.trim().replace(/\/$/, "");
  }
  if (process.env.N8N_BASE_URL?.trim()) {
    raw.n8n.baseUrl = process.env.N8N_BASE_URL.trim().replace(/\/$/, "");
  }
  if (process.env.N8N_ALLOW_LIVE === "1") {
    raw.n8n.allowLiveExecution = true;
  }
  cached = raw;
  return raw;
}

export function resetIntegrationsConfigCache() {
  cached = null;
}
