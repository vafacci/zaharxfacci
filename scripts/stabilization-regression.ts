/**
 * Live M1–M3 stabilization regression against running web+worker.
 * Does not delete history. Marks new tasks as origin=validation.
 */
const BASE = process.env.FACCI_BASE_URL ?? "http://127.0.0.1:3010";

type Overview = {
  organization: { projects: { id: string; slug: string }[] };
  tasks: {
    id: string;
    title: string;
    status: string;
    origin?: string;
    latestPlan?: {
      specialistTemplateKey?: string;
      reasoningSummary?: string;
      isLiveModel?: boolean;
    } | null;
    latestRunMeta?: { errorMessage?: string | null; status?: string } | null;
    artifacts?: { id: string; title: string }[];
    approvals?: { id: string; state: string; actionType: string }[];
  }[];
  approvals: { id: string; actionType: string; task: { id: string; title: string } }[];
};

async function overview(): Promise<Overview> {
  const res = await fetch(`${BASE}/api/overview`, { cache: "no-store" });
  if (!res.ok) throw new Error(`overview ${res.status}`);
  return (await res.json()) as Overview;
}

async function createTask(body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `create ${res.status}`);
  return json.task as { id: string };
}

async function waitTask(
  id: string,
  terminals: string[],
  seconds = 300,
): Promise<Overview["tasks"][0]> {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 4000));
    const o = await overview();
    const t = o.tasks.find((x) => x.id === id);
    if (!t) continue;
    process.stdout.write(
      `  ${id.slice(0, 8)} status=${t.status} specialist=${t.latestPlan?.specialistTemplateKey ?? "-"}\n`,
    );
    if (terminals.includes(t.status)) return t;
  }
  throw new Error(`timeout waiting for ${id}`);
}

async function main() {
  const results: { name: string; ok: boolean; detail: string }[] = [];
  const o0 = await overview();
  const autiq = o0.organization.projects.find((p) => p.slug === "autiq");
  if (!autiq) throw new Error("AUTIQ missing");
  const stamp = Date.now();

  // 1. Marketing draft
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Draft stabilization content outline",
      objective: "Write three short marketing content ideas for AUTIQ as markdown draft",
      origin: "validation",
      idempotencyKey: `validation-marketing-${stamp}`,
    });
    const done = await waitTask(t.id, ["completed", "failed", "blocked"], 240);
    const ok =
      done.status === "completed" &&
      done.latestPlan?.specialistTemplateKey === "marketing" &&
      (done.artifacts?.length ?? 0) > 0;
    results.push({
      name: "marketing→specialist+draft",
      ok,
      detail: `status=${done.status} specialist=${done.latestPlan?.specialistTemplateKey} arts=${done.artifacts?.length ?? 0} live=${done.latestPlan?.isLiveModel}`,
    });
  } catch (e) {
    results.push({
      name: "marketing→specialist+draft",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 2. Merge approval gate + developer specialist
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Merge toy-counter fix to main",
      objective: "Merge the toy-counter changes into main and push to remote.",
      origin: "validation",
      idempotencyKey: `validation-merge-${stamp}`,
    });
    const done = await waitTask(t.id, ["waiting_approval", "failed", "blocked", "completed"], 240);
    const ok =
      done.status === "waiting_approval" &&
      done.latestPlan?.specialistTemplateKey === "developer" &&
      !/content ideas/i.test(done.latestPlan?.reasoningSummary ?? "");
    results.push({
      name: "merge→developer+approval",
      ok,
      detail: `status=${done.status} specialist=${done.latestPlan?.specialistTemplateKey} reason=${(done.latestPlan?.reasoningSummary ?? "").slice(0, 80)}`,
    });
  } catch (e) {
    results.push({
      name: "merge→developer+approval",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 3. Publish approval gate
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Publish social post now",
      objective: "Publish this caption to Instagram immediately",
      origin: "validation",
      idempotencyKey: `validation-publish-${stamp}`,
    });
    const done = await waitTask(t.id, ["waiting_approval", "failed", "blocked", "completed"], 240);
    const ok =
      done.status === "waiting_approval" &&
      ["marketing", "social"].includes(done.latestPlan?.specialistTemplateKey ?? "");
    results.push({
      name: "publish→approval",
      ok,
      detail: `status=${done.status} specialist=${done.latestPlan?.specialistTemplateKey}`,
    });
  } catch (e) {
    results.push({
      name: "publish→approval",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 4. Approve does not execute
  try {
    const o = await overview();
    const pending = o.approvals.find((a) => a.actionType === "merge_code" || a.actionType === "publish_post");
    if (!pending) throw new Error("no pending approval to decide");
    const res = await fetch(`${BASE}/api/approvals/${pending.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "approved", decidedBy: "Human Owner" }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? `decide ${res.status}`);
    await new Promise((r) => setTimeout(r, 1500));
    const after = await overview();
    const task = after.tasks.find((x) => x.id === pending.task.id);
    const msg = task?.latestRunMeta?.errorMessage ?? "";
    const ok =
      task?.status === "blocked" &&
      /not executed|disabled/i.test(msg) &&
      !/m1/i.test(msg);
    results.push({
      name: "approve≠execute",
      ok: Boolean(ok),
      detail: `status=${task?.status} msg=${msg.slice(0, 120)}`,
    });
  } catch (e) {
    results.push({
      name: "approve≠execute",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // 5. Origin separation present
  try {
    const o = await overview();
    const validation = o.tasks.filter((t) => t.origin === "validation").length;
    const operational = o.tasks.filter((t) => t.origin !== "validation").length;
    results.push({
      name: "origin metadata",
      ok: validation > 0,
      detail: `validation=${validation} operational=${operational}`,
    });
  } catch (e) {
    results.push({
      name: "origin metadata",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log("\n=== STABILIZATION REGRESSION ===");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
