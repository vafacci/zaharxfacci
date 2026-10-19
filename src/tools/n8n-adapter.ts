import { z } from "zod";
import { loadIntegrationsConfig } from "@/tools/integrations-config";
import type { ToolRequest } from "@/tools/policy";

const N8nInputSchema = z.object({
  /** Optional workflow id for dry-run inspection */
  workflowId: z.string().min(1).max(120).optional(),
  dryRun: z.boolean().default(true),
  /** Live webhook/execution — requires policy approval path; disabled by default config */
  liveExecute: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});

export type N8nHealth = {
  instanceReachable: boolean;
  apiConfigured: boolean;
  apiAuthorized: boolean;
  baseUrl: string;
  details: string;
  workflowCount?: number;
};

export type N8nResult = {
  toolId: "n8n";
  dryRun: boolean;
  liveExecuted: boolean;
  workflows: { id: string; name: string; active?: boolean }[];
  health: N8nHealth;
  evidenceMarkdown: string;
  error?: string;
};

export async function checkN8nHealth(): Promise<N8nHealth> {
  const cfg = loadIntegrationsConfig().n8n;
  const baseUrl = cfg.baseUrl.replace(/\/$/, "");
  const apiKey = process.env[cfg.apiKeyEnv]?.trim();

  let instanceReachable = false;
  try {
    const health = await fetch(`${baseUrl}/healthz`, {
      signal: AbortSignal.timeout(4000),
    });
    instanceReachable = health.ok;
  } catch {
    instanceReachable = false;
  }

  if (!apiKey) {
    return {
      instanceReachable,
      apiConfigured: false,
      apiAuthorized: false,
      baseUrl,
      details: instanceReachable
        ? `n8n instance reachable at ${baseUrl}, but N8N_API_KEY is not set — API calls unauthorized`
        : `n8n unreachable at ${baseUrl}`,
    };
  }

  try {
    const res = await fetch(`${baseUrl}/api/v1/workflows?limit=50`, {
      headers: { "X-N8N-API-KEY": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        instanceReachable,
        apiConfigured: true,
        apiAuthorized: false,
        baseUrl,
        details: `n8n API key rejected (HTTP ${res.status})`,
      };
    }
    if (!res.ok) {
      return {
        instanceReachable,
        apiConfigured: true,
        apiAuthorized: false,
        baseUrl,
        details: `n8n workflows probe HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      data?: { id?: string; name?: string }[];
    };
    const count = data.data?.length ?? 0;
    return {
      instanceReachable,
      apiConfigured: true,
      apiAuthorized: true,
      baseUrl,
      workflowCount: count,
      details: `n8n API authorized at ${baseUrl}; workflows visible=${count}`,
    };
  } catch (err) {
    return {
      instanceReachable,
      apiConfigured: true,
      apiAuthorized: false,
      baseUrl,
      details: err instanceof Error ? err.message : "n8n API error",
    };
  }
}

export class N8nAdapter {
  async prepare(request: ToolRequest): Promise<N8nResult> {
    const input = N8nInputSchema.parse(request.input);
    const cfg = loadIntegrationsConfig().n8n;
    const health = await checkN8nHealth();
    const apiKey = process.env[cfg.apiKeyEnv]?.trim();
    const workflows: { id: string; name: string; active?: boolean }[] = [];

    if (health.apiAuthorized && apiKey) {
      const res = await fetch(`${health.baseUrl}/api/v1/workflows?limit=50`, {
        headers: { "X-N8N-API-KEY": apiKey },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          data?: { id: string; name: string; active?: boolean }[];
        };
        for (const w of data.data ?? []) {
          workflows.push({ id: w.id, name: w.name, active: w.active });
        }
      }
    }

    if (input.liveExecute) {
      if (!cfg.allowLiveExecution) {
        return {
          toolId: "n8n",
          dryRun: true,
          liveExecuted: false,
          workflows,
          health,
          error:
            "Live n8n execution disabled (set N8N_ALLOW_LIVE=1 only after approval policy review)",
          evidenceMarkdown: `# n8n — live execution refused

- Instance: ${health.baseUrl}
- Live execute requested but **N8N_ALLOW_LIVE is off**
- Workflows discovered: ${workflows.length}
- No webhook/workflow was triggered.

${input.notes ? `Notes: ${input.notes}` : ""}
`,
        };
      }
      // Even when allowLiveExecution is on, FACCI still requires approval gate upstream.
      // Adapter refuses to fire without an explicit approved tool request flag.
      return {
        toolId: "n8n",
        dryRun: true,
        liveExecuted: false,
        workflows,
        health,
        error:
          "Live n8n triggers must go through approval (request_external_action). Adapter did not execute.",
        evidenceMarkdown: `# n8n — live execution not performed

Policy: even with N8N_ALLOW_LIVE, worker must only call execute after approval.
This prepare step lists workflows only.

Workflows:
${workflows.map((w) => `- ${w.id} · ${w.name} · active=${w.active}`).join("\n") || "(none)"}
`,
      };
    }

    const target = input.workflowId
      ? workflows.find((w) => w.id === input.workflowId)
      : undefined;

    return {
      toolId: "n8n",
      dryRun: true,
      liveExecuted: false,
      workflows,
      health,
      error: health.apiAuthorized
        ? undefined
        : health.details,
      evidenceMarkdown: `# n8n — dry-run / prepare

- Instance reachable: ${health.instanceReachable}
- API authorized: ${health.apiAuthorized}
- Details: ${health.details}
- Dry-run: **true** (no live trigger)
${input.workflowId ? `- Requested workflow: ${input.workflowId} ${target ? `(found: ${target.name})` : "(not found in list)"}` : ""}

## Workflows (if authorized)
${workflows.map((w) => `- \`${w.id}\` ${w.name} active=${w.active}`).join("\n") || "(none listed — configure N8N_API_KEY)"}

${input.notes ? `## Notes\n${input.notes}` : ""}

_FACCI n8n adapter — real health/API probes only; live automations stay behind approval._
`,
    };
  }
}
