import { prisma } from "@/lib/db";

export async function recordAudit(params: {
  projectId?: string | null;
  actor: string;
  verb: string;
  target: string;
  payload?: unknown;
}) {
  return prisma.auditEvent.create({
    data: {
      projectId: params.projectId ?? null,
      actor: params.actor,
      verb: params.verb,
      target: params.target,
      payloadRedacted: params.payload
        ? JSON.stringify(params.payload).slice(0, 4000)
        : null,
    },
  });
}
