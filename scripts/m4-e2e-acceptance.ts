/**
 * Genuine M4 E2E acceptance via FACCI task API (same path as dashboard).
 * Creates AUTIQ Instagram draft with Image Studio image + caption. No publish.
 */
const BASE = process.env.FACCI_BASE_URL ?? "http://127.0.0.1:3010";

async function main() {
  const ov0 = await (await fetch(`${BASE}/api/overview`)).json();
  const autiq = ov0.organization.projects.find(
    (p: { slug: string }) => p.slug === "autiq",
  );
  if (!autiq) throw new Error("AUTIQ project missing");

  console.log("Image Studio:", ov0.imageStudio?.details);
  console.log("Postiz:", ov0.postiz?.details);
  console.log("n8n:", ov0.n8n?.details);

  const stamp = Date.now();
  const body = {
    projectId: autiq.id,
    title: "Instagram content draft with AI image",
    objective:
      "Create an Instagram content draft with an AI-generated image and caption for AUTIQ. Use the content pipeline: generate a new image via Image Studio, stage caption and calendar locally. Do not publish or schedule anything.",
    origin: "validation",
    idempotencyKey: `validation-m4-e2e-accept-${stamp}`,
  };
  const created = await (
    await fetch(`${BASE}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
  if (!created.task?.id) throw new Error(JSON.stringify(created));
  const taskId = created.task.id as string;
  console.log("Created task", taskId);

  const deadline = Date.now() + 600_000;
  let done: Record<string, unknown> | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const ov = await (await fetch(`${BASE}/api/overview`)).json();
    const t = ov.tasks.find((x: { id: string }) => x.id === taskId);
    if (!t) continue;
    const steps = (t.runs?.[0]?.steps ?? [])
      .map((s: { actionType: string; status: string }) => `${s.actionType}:${s.status}`)
      .join(" | ");
    console.log(`  status=${t.status} arts=${t.artifacts?.length ?? 0} ${steps}`);
    if (
      ["completed", "failed", "blocked", "cancelled", "waiting_approval"].includes(
        t.status,
      )
    ) {
      done = t;
      break;
    }
  }
  if (!done) throw new Error("timeout waiting for task");

  const checks: { name: string; ok: boolean; detail: string }[] = [];
  checks.push({
    name: "status.completed",
    ok: done.status === "completed",
    detail: String(done.status),
  });
  checks.push({
    name: "not.waiting_approval_publish",
    ok: done.status !== "waiting_approval",
    detail: String(done.status),
  });

  const steps = (done.runs as { steps?: { actionType: string; agent?: { name: string }; outputSummary?: string }[] }[])?.[0]
    ?.steps ?? [];
  checks.push({
    name: "step.image_studio",
    ok: steps.some((s) => s.actionType === "run_image_studio_task"),
    detail: steps.map((s) => s.actionType).join(","),
  });
  checks.push({
    name: "step.social_draft",
    ok: steps.some((s) => s.actionType === "stage_social_draft"),
    detail: steps.map((s) => `${s.actionType}@${s.agent?.name ?? "?"}`).join(","),
  });

  const arts = (done.artifacts as {
    id: string;
    kind?: string;
    title: string;
    storageRef?: string;
  }[]) ?? [];
  const review = arts.find((a) => a.kind === "instagram-review-draft");
  const imageArt = arts.find((a) => a.kind === "generated-image");
  checks.push({
    name: "artifact.review_package",
    ok: Boolean(review),
    detail: review ? `${review.id} ${review.title}` : "missing",
  });
  checks.push({
    name: "artifact.generated_image",
    ok: Boolean(imageArt),
    detail: imageArt ? `${imageArt.id} ${imageArt.storageRef}` : "missing",
  });

  if (imageArt) {
    const fileRes = await fetch(`${BASE}/api/artifacts/${imageArt.id}/file`);
    const buf = Buffer.from(await fileRes.arrayBuffer());
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50;
    checks.push({
      name: "image.viewable_from_facci",
      ok: fileRes.ok && isPng && buf.length > 1000,
      detail: `http=${fileRes.status} bytes=${buf.length} png=${isPng}`,
    });
  } else {
    checks.push({
      name: "image.viewable_from_facci",
      ok: false,
      detail: "no generated-image artifact",
    });
  }

  if (review) {
    const contentRes = await fetch(`${BASE}/api/artifacts/${review.id}/content`);
    const contentJson = await contentRes.json();
    const text = String(contentJson.content ?? "");
    checks.push({
      name: "review.has_caption_and_image_ref",
      ok:
        contentRes.ok &&
        /Caption/i.test(text) &&
        /\/api\/artifacts\/.+\/file/.test(text) &&
        /not published/i.test(text),
      detail: `len=${text.length} hasFileRef=${/\/api\/artifacts\/.+\/file/.test(text)}`,
    });
  }

  const plan = done.latestPlan as {
    specialistTemplateKey?: string;
    reasoningSummary?: string;
  } | null;
  checks.push({
    name: "plan.pipeline_specialist",
    ok: ["social", "marketing", "image"].includes(plan?.specialistTemplateKey ?? ""),
    detail: plan?.specialistTemplateKey ?? "none",
  });

  // Confirm studio generation id exists in evidence
  const imageEvidence = arts.find((a) => a.kind === "image-studio-evidence");
  if (imageEvidence) {
    const c = await (await fetch(`${BASE}/api/artifacts/${imageEvidence.id}/content`)).json();
    const text = String(c.content ?? "");
    checks.push({
      name: "evidence.real_generation_id",
      ok: /Generation id:\s*`?[a-z0-9]+/i.test(text) && /completed/i.test(text),
      detail: text.slice(0, 180).replace(/\n/g, " "),
    });
  }

  console.log("\n=== M4 E2E ACCEPTANCE ===");
  console.log("taskId:", taskId);
  for (const c of checks) {
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name} — ${c.detail}`);
  }
  if (checks.some((c) => !c.ok)) process.exit(1);
  console.log("\nOPEN IN DASHBOARD: http://127.0.0.1:3010/");
  console.log("Select task + open artifact: Instagram review draft (image + caption)");
  if (imageArt) {
    console.log(`Image URL: ${BASE}/api/artifacts/${imageArt.id}/file`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
