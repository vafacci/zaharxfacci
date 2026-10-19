import { createHash } from "crypto";
import { z } from "zod";

export const HIGH_RISK_ACTIONS = new Set([
  "publish_post",
  "request_publish_post",
  "send_message",
  "merge_code",
  "request_merge_code",
  "push_remote",
  "deploy",
  "purchase",
  "enable_paid_service",
  "delete_data",
  "alter_account",
  "schedule_post",
  "postiz_schedule",
  "postiz_now",
  "n8n_live_trigger",
  "request_external_action",
]);

export const ToolRequestSchema = z.object({
  toolId: z.string().min(1),
  action: z.string().min(1),
  projectId: z.string().min(1),
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  input: z.unknown(),
  idempotencyKey: z.string().min(1),
});

export type ToolRequest = z.infer<typeof ToolRequestSchema>;

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function classifyRisk(action: string): "low" | "medium" | "high" {
  if (HIGH_RISK_ACTIONS.has(action)) return "high";
  if (/write|modify|run_test/.test(action)) return "medium";
  return "low";
}

export function assertProjectScope(expectedProjectId: string, requestProjectId: string) {
  if (expectedProjectId !== requestProjectId) {
    throw new Error(
      `Project isolation violation: expected ${expectedProjectId}, got ${requestProjectId}`,
    );
  }
}

/**
 * High-risk actions must stop at approval. Merge/push/deploy never auto-execute.
 */
export function gateExternalAction(action: string): {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string;
} {
  if (HIGH_RISK_ACTIONS.has(action)) {
    return {
      allowed: false,
      requiresApproval: true,
      reason: `Action "${action}" is high-risk and requires human approval. External side effects (merge/push/publish/deploy) are not auto-executed.`,
    };
  }
  return {
    allowed: true,
    requiresApproval: false,
    reason: "Local draft/read/developer-edit action permitted within project scope.",
  };
}
