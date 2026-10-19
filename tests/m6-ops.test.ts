import { describe, expect, it } from "vitest";
import { computeNextRunAt, scheduleFireIdempotencyKey } from "@/domain/schedules";
import { selectNextQueuedRunId } from "@/domain/prioritization";
import { getRemoteModelStatus, loadRemoteModelConfig } from "@/providers/remote-model";
import { currentMonthKey } from "@/domain/budgets";
import { buildSpecialistReport } from "@/domain/specialist-reports";

describe("M6 prioritization helper", () => {
  it("exports selectNextQueuedRunId", () => {
    expect(typeof selectNextQueuedRunId).toBe("function");
  });
});

describe("M6 remote model defaults", () => {
  it("is disabled / not ready by default", () => {
    const cfg = loadRemoteModelConfig();
    const status = getRemoteModelStatus();
    expect(cfg.enabled).toBe(false);
    expect(status.ready).toBe(false);
    expect(status.blockedReason).toMatch(/opt-in|disabled|not configured/i);
    expect(status.billingNote).toMatch(/charges|invoices/i);
  });
});

describe("M6 budget month key", () => {
  it("formats UTC YYYY-MM", () => {
    expect(currentMonthKey(new Date("2026-10-13T01:00:00Z"))).toBe("2026-10");
  });
});

describe("M6 schedule helpers still hold", () => {
  it("keeps due-slot idempotency", () => {
    const due = new Date("2026-10-13T08:00:00.000Z");
    expect(scheduleFireIdempotencyKey("abc", due)).toBe(
      "schedule-abc-2026-10-13T08:00:00.000Z",
    );
    expect(computeNextRunAt("every_15m", due)?.toISOString()).toBe(
      "2026-10-13T08:15:00.000Z",
    );
  });
});

describe("M6 reports remain evidence-honest", () => {
  it("analytics report does not invent customer KPIs", () => {
    const r = buildSpecialistReport({
      projectName: "AUTIQ",
      projectSlug: "autiq",
      title: "Metrics",
      objective: "analytics snapshot",
      templateKey: "analytics",
      projectMission: "Content business",
    });
    expect(r.kind).toBe("analytics-snapshot");
    expect(r.content).toMatch(/blocked/i);
    expect(r.content).not.toMatch(/MRR \$|10k DAU/i);
  });
});
