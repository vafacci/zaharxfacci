/**
 * Local FACCI runtime / game-mode control (Windows-first).
 * Chat can stop the worker (and defer dashboard stop) so GPU/CPU is free for games.
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";

export type RuntimeAction =
  | "status"
  | "game_on"
  | "game_off"
  | "stop_worker"
  | "start_worker";

export type GameModeIntent = {
  action: RuntimeAction;
  /** Danish/English phrase used for reply tone */
  matched: string;
};

const SCRIPT = () => path.join(projectRoot(), "scripts", "facci-runtime.ps1");

const INTENT_RULES: { action: RuntimeAction; re: RegExp }[] = [
  {
    action: "game_on",
    re: /\b(game\s*mode\s*(on|til)|slå\s+game\s*mode\s+til|start\s+game\s*mode|gaming\s*mode\s*on|stop\s+facci\s+for\s+(spil|gaming)|fri\s+(gpu|vram)\s+til\s+spil)\b/i,
  },
  {
    action: "game_off",
    re: /\b(game\s*mode\s*(off|fra)|slå\s+game\s*mode\s+fra|stop\s+game\s*mode|develop(?:ment)?\s*mode|udvikl(?:ings)?\s*mode|start\s+facci\s+(igen|op)|facci\s+på\s+igen)\b/i,
  },
  {
    action: "status",
    re: /\b(facci\s+(status|runtime)|runtime\s+status|kører\s+worker|worker\s+status|game\s*mode\s+status)\b/i,
  },
  {
    action: "stop_worker",
    re: /\b(stop\s+(the\s+)?worker|stop\s+facci\s+worker|sluk\s+worker)\b/i,
  },
  {
    action: "start_worker",
    re: /\b(start\s+(the\s+)?worker|start\s+facci\s+worker|tænd\s+worker)\b/i,
  },
];

export function classifyRuntimeIntent(message: string): GameModeIntent | null {
  const m = message.trim();
  if (!m || m.length > 400) return null;
  for (const rule of INTENT_RULES) {
    if (rule.re.test(m)) {
      return { action: rule.action, matched: m };
    }
  }
  return null;
}

function psAction(action: RuntimeAction): string {
  switch (action) {
    case "status":
      return "Status";
    case "game_on":
      return "GameOn";
    case "game_off":
      return "GameOff";
    case "stop_worker":
      return "StopWorker";
    case "start_worker":
      return "StartWorker";
  }
}

export type RuntimeControlResult = {
  ok: boolean;
  action: RuntimeAction;
  raw: unknown;
  stdout: string;
  stderr: string;
  error?: string;
};

export function runRuntimeAction(action: RuntimeAction): RuntimeControlResult {
  const script = SCRIPT();
  if (!fs.existsSync(script)) {
    return {
      ok: false,
      action,
      raw: null,
      stdout: "",
      stderr: "",
      error: `Missing script: ${script}`,
    };
  }

  const psActionName = psAction(action);
  // GameOn defers dashboard kill — sync call is fine for worker stop + mode file.
  const sync = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Action",
      psActionName,
      "-RepoRoot",
      projectRoot(),
    ],
    {
      encoding: "utf8",
      timeout: 25_000,
      windowsHide: true,
    },
  );

  const stdout = String(sync.stdout ?? "").trim();
  const stderr = String(sync.stderr ?? "").trim();
  let raw: unknown = null;
  try {
    raw = stdout ? JSON.parse(stdout) : null;
  } catch {
    raw = { unparsed: stdout };
  }

  if (sync.error) {
    return {
      ok: false,
      action,
      raw,
      stdout,
      stderr,
      error: sync.error.message,
    };
  }
  if (sync.status !== 0) {
    return {
      ok: false,
      action,
      raw,
      stdout,
      stderr,
      error: stderr || `powershell exit ${sync.status}`,
    };
  }
  return { ok: true, action, raw, stdout, stderr };
}

/** Fire-and-forget start when chat must return quickly (GameOff already sync-starts). */
export function launchRuntimeActionDetached(action: RuntimeAction): void {
  const script = SCRIPT();
  if (!fs.existsSync(script)) return;
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      "-Action",
      psAction(action),
      "-RepoRoot",
      projectRoot(),
    ],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
}

/**
 * Ensure the FACCI worker is up after new work arrives.
 * No-op if the runtime script is missing (non-Windows / tests).
 */
export function ensureFacciWorkerRunning(): void {
  try {
    launchRuntimeActionDetached("start_worker");
  } catch {
    // best-effort wake
  }
}

export function formatRuntimeChatReply(result: RuntimeControlResult): string {
  const st = (result.raw as { status?: Record<string, unknown>; mode?: string }) ?? {};
  const status = (st.status ?? result.raw) as Record<string, unknown> | null;
  const worker =
    status && typeof status === "object" && "workerRunning" in status
      ? Boolean(status.workerRunning)
      : null;
  const port =
    status && typeof status === "object" && "dashboardPortOpen" in status
      ? Boolean(status.dashboardPortOpen)
      : null;

  if (!result.ok) {
    return [
      `Runtime-handling **${result.action}** fejlede.`,
      result.error ? `Fejl: ${result.error}` : null,
      "Du kan køre manuelt: `npm run facci:runtime -- -Action Status`",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  switch (result.action) {
    case "game_on":
      return [
        "**Game mode ON** — FACCI worker er stoppet; dashboard lukkes om ~2 sekunder.",
        "GPU/CPU er fri til spil. Ollama-jobs kører ikke imens.",
        "Sig **game mode off** (eller `npm run facci:game-off`) når du vil udvikle igen.",
        worker === false ? "Worker: stoppet." : null,
      ]
        .filter(Boolean)
        .join("\n\n");
    case "game_off":
      return [
        "**Game mode OFF / develop** — starter worker (+ dashboard hvis port 3010 var lukket).",
        "Vent et par sekunder, genindlæs evt. http://127.0.0.1:3010",
        worker === true ? "Worker: kører." : "Worker: starter…",
        port === true ? "Dashboard-port: åben." : "Dashboard: starter hvis den var nede…",
      ].join("\n\n");
    case "stop_worker":
      return ["**Worker stoppet.**", "Dashboard er uændret. Sig **start worker** eller **game mode off** for at fortsætte jobs."].join(
        "\n\n",
      );
    case "start_worker":
      return ["**Worker startet** (eller kørte allerede).", "Køede opgaver kan nu behandles."].join("\n\n");
    case "status":
    default:
      return [
        "**FACCI runtime status**",
        `- Worker: ${worker == null ? "ukendt" : worker ? "kører" : "stoppet"}`,
        `- Dashboard :3010: ${port == null ? "ukendt" : port ? "åben" : "lukket"}`,
        `- Mode-fil: ${(status as { modeFile?: { mode?: string } } | null)?.modeFile?.mode ?? "(ingen)"}`,
      ].join("\n");
  }
}
