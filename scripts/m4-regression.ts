/**
 * Live M4 regression: Image Studio + social staging + n8n prepare + publish gate.
 * Requires web + worker. Marks tasks origin=validation.
 */
const BASE = process.env.FACCI_BASE_URL ?? "http://127.0.0.1:3010";

type Overview = {
  imageStudio?: { available?: boolean; connected?: boolean; details?: string };
  postiz?: { configured?: boolean; reachable?: boolean; details?: string };
  n8n?: {
    instanceReachable?: boolean;
    apiAuthorized?: boolean;
    details?: string;
  };
  tools?: { adapterType: string; state: string; liveNote: string | null }[];
  organization: { projects: { id: string; slug: string }[] };
  tasks: {
    id: string;
    title: string;
    status: string;
    origin?: string;
    latestPlan?: { specialistTemplateKey?: string } | null;
    artifacts?: { id: string; kind?: string; title: string; storageRef?: string }[];
    runs?: {
      steps?: { actionType: string; status: string; outputSummary: string | null }[];
    }[];
  }[];
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

async function waitTask(id: string, terminals: string[], seconds = 600) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const o = await overview();
    const t = o.tasks.find((x) => x.id === id);
    if (!t) continue;
    const steps = t.runs?.[0]?.steps?.map((s) => s.actionType).join(",") ?? "";
    process.stdout.write(
      `  ${id.slice(0, 8)} status=${t.status} steps=${steps || "-"}\n`,
    );
    if (terminals.includes(t.status)) return t;
  }
  throw new Error(`timeout ${id}`);
}

async function main() {
  const results: { name: string; ok: boolean; detail: string }[] = [];
  const o0 = await overview();
  results.push({
    name: "overview.imageStudio",
    ok: Boolean(o0.imageStudio?.available),
    detail: o0.imageStudio?.details ?? "missing",
  });
  results.push({
    name: "overview.postiz.honest",
    ok: o0.postiz?.configured === false || typeof o0.postiz?.reachable === "boolean",
    detail: o0.postiz?.details ?? "missing",
  });
  results.push({
    name: "overview.n8n.probe",
    ok: typeof o0.n8n?.instanceReachable === "boolean",
    detail: o0.n8n?.details ?? "missing",
  });

  const autiq = o0.organization.projects.find((p) => p.slug === "autiq");
  if (!autiq) throw new Error("AUTIQ missing");
  const stamp = Date.now();

  // Pipeline task
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Weekly content pipeline draft",
      objective:
        "Create image and caption for Instagram content calendar; stage social draft in Postiz if available; do not publish.",
      origin: "validation",
      idempotencyKey: `validation-m4-pipeline-${stamp}`,
    });
    const done = await waitTask(
      t.id,
      ["completed", "failed", "blocked", "waiting_approval"],
      600,
    );
    const steps = done.runs?.[0]?.steps ?? [];
    const hasImage = steps.some((s) => s.actionType === "run_image_studio_task");
    const hasSocial = steps.some((s) => s.actionType === "stage_social_draft");
    const arts = done.artifacts?.length ?? 0;
    const ok = done.status === "completed" && hasImage && hasSocial && arts >= 2;
    results.push({
      name: "pipeline.image+social",
      ok,
      detail: `status=${done.status} imageStep=${hasImage} socialStep=${hasSocial} arts=${arts}`,
    });
  } catch (e) {
    results.push({
      name: "pipeline.image+social",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // n8n prepare
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Prepare n8n automation workflow dry-run",
      objective: "Inspect n8n automation workflow availability; dry-run only; do not trigger live webhooks.",
      origin: "validation",
      idempotencyKey: `validation-m4-n8n-${stamp}`,
    });
    const done = await waitTask(t.id, ["completed", "failed", "blocked"], 300);
    const hasN8n = (done.runs?.[0]?.steps ?? []).some(
      (s) => s.actionType === "prepare_n8n_workflow",
    );
    results.push({
      name: "n8n.prepare",
      ok: done.status === "completed" && hasN8n,
      detail: `status=${done.status} n8nStep=${hasN8n}`,
    });
  } catch (e) {
    results.push({
      name: "n8n.prepare",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // Publish still gated
  try {
    const t = await createTask({
      projectId: autiq.id,
      title: "Publish social post now",
      objective: "Publish this caption to Instagram immediately",
      origin: "validation",
      idempotencyKey: `validation-m4-publish-${stamp}`,
    });
    const done = await waitTask(t.id, ["waiting_approval", "failed", "blocked", "completed"], 300);
    results.push({
      name: "publish.approval_gate",
      ok: done.status === "waiting_approval",
      detail: `status=${done.status}`,
    });
  } catch (e) {
    results.push({
      name: "publish.approval_gate",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log("\n=== M4 REGRESSION ===");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name} — ${r.detail}`);
  }
  if (results.some((r) => !r.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
