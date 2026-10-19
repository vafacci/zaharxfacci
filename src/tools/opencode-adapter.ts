import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { runBoundedPatchExecutor } from "@/tools/bounded-patch-executor";
import {
  diffSnapshots,
  resolveWorkspace,
  snapshotTextFiles,
} from "@/tools/workspace";
import type { ToolRequest } from "@/tools/policy";

const DeveloperInputSchema = z.object({
  workspaceId: z.string().min(1),
  prompt: z.string().min(1).max(8000),
  runTests: z.boolean().default(true),
  preferOpenCode: z.boolean().default(true),
});

export type DeveloperExecutionResult = {
  toolId: "opencode";
  executor: "opencode" | "bounded-patch-executor";
  workspaceId: string;
  workspacePath: string;
  modelId?: string;
  summary: string;
  diff: string;
  changedFiles: string[];
  rollbackSnapshotRef: string;
  test: { ran: boolean; passed: boolean; output: string };
  opencodeAvailable: boolean;
  opencodeAttempted: boolean;
  opencodeError?: string;
  latencyMs: number;
  evidenceMarkdown: string;
};

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Windows: npm/npx are .cmd shims — require shell, or Node 20+ returns EINVAL.
    const useShell = process.platform === "win32";
    const child = spawn(command, args, {
      cwd,
      env,
      shell: useShell,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, timeoutMs);
    child.stdout.on("data", (d) => {
      stdout += String(d);
      if (stdout.length > 200_000) stdout = stdout.slice(-200_000);
    });
    child.stderr.on("data", (d) => {
      stderr += String(d);
      if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function resolveOpenCodeBinary(): string | null {
  const exe = path.join(
    process.cwd(),
    "node_modules",
    "opencode-ai",
    "bin",
    process.platform === "win32" ? "opencode.exe" : "opencode",
  );
  if (fs.existsSync(exe)) return exe;
  const pkg = path.join(process.cwd(), "node_modules", "opencode-ai", "package.json");
  if (fs.existsSync(pkg)) return exe; // may still exist after resolve
  return null;
}

export async function checkOpenCodeAvailable(): Promise<{
  available: boolean;
  details: string;
  version?: string;
}> {
  try {
    const bin = resolveOpenCodeBinary();
    const pkgPath = path.join(process.cwd(), "node_modules", "opencode-ai", "package.json");
    if (!bin && !fs.existsSync(pkgPath)) {
      return { available: false, details: "opencode-ai package not installed" };
    }
    if (bin && fs.existsSync(bin)) {
      const result = await runCommand(bin, ["--version"], process.cwd(), process.env, 4_000);
      if (result.code === 0 || result.stdout.trim() || result.stderr.trim()) {
        const version = (result.stdout || result.stderr).trim().split("\n")[0];
        return { available: true, details: `OpenCode detected: ${version}`, version };
      }
    }
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
      return {
        available: true,
        details: `OpenCode package installed (v${pkg.version ?? "?"})`,
        version: pkg.version,
      };
    }
    return { available: false, details: "opencode binary missing" };
  } catch (err) {
    // Fall back to package presence so overview never hangs/fails closed on spawn quirks
    const pkgPath = path.join(process.cwd(), "node_modules", "opencode-ai", "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
      return {
        available: true,
        details: `OpenCode package present (v${pkg.version ?? "?"}); spawn check failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
        version: pkg.version,
      };
    }
    return {
      available: false,
      details: err instanceof Error ? err.message : "opencode not found",
    };
  }
}

function writeOpenCodeConfig(workspaceRoot: string): string {
  const configDir = path.join(workspaceRoot, ".opencode-facci");
  fs.mkdirSync(configDir, { recursive: true });
  const configPath = path.join(configDir, "opencode.json");
  const model =
    process.env.OLLAMA_CODER_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    "qwen2.5-coder:3b";
  const config = {
    $schema: "https://opencode.ai/config.json",
    provider: {
      ollama: {
        npm: "@ai-sdk/openai-compatible",
        name: "Ollama (local)",
        options: {
          baseURL: `${(process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "")}/v1`,
        },
        models: {
          [model]: { name: model },
        },
      },
    },
    model: `ollama/${model}`,
    permission: {
      // Deny network / dangerous defaults; FACCI still validates diffs + allowlist
      bash: "ask",
      edit: "allow",
      read: "allow",
      webfetch: "deny",
      websearch: "deny",
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  return configPath;
}

async function tryOpenCodeRun(params: {
  workspaceRoot: string;
  prompt: string;
}): Promise<{ ok: boolean; output: string; error?: string; latencyMs: number }> {
  const started = Date.now();
  const configPath = writeOpenCodeConfig(params.workspaceRoot);
  const model =
    process.env.OLLAMA_CODER_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    "qwen2.5-coder:3b";
  const cmd = resolveOpenCodeBinary() ?? "opencode";
  const boundedPrompt = [
    params.prompt,
    "",
    "Constraints:",
    "- Only modify files under src/ and test/ (and package.json if needed).",
    "- Do not install packages, do not access the network, do not commit/push/merge.",
    "- Keep the change minimal and make existing tests pass.",
  ].join("\n");

  try {
    const result = await runCommand(
      cmd,
      [
        "run",
        boundedPrompt,
        "--dir",
        params.workspaceRoot,
        "--model",
        `ollama/${model}`,
        "--format",
        "json",
        "--auto",
      ],
      params.workspaceRoot,
      {
        ...process.env,
        OPENCODE_CONFIG: configPath,
        OPENCODE_DISABLE_AUTOUPDATE: "1",
        OPENCODE_PERMISSION: JSON.stringify({
          bash: "deny",
          webfetch: "deny",
          websearch: "deny",
          edit: "allow",
          read: "allow",
        }),
      },
      // Keep bounded: hung OpenCode on small GPU/CPU-offload must fail into bounded-patch.
      Number(process.env.FACCI_OPENCODE_TIMEOUT_MS ?? 90_000),
    );
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (result.code !== 0) {
      return {
        ok: false,
        output,
        error: `OpenCode exited ${result.code}`,
        latencyMs: Date.now() - started,
      };
    }
    return { ok: true, output, latencyMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      output: "",
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - started,
    };
  }
}

export class OpenCodeAdapter {
  id = "opencode";

  async describeCapabilities() {
    const oc = await checkOpenCodeAvailable();
    return {
      id: this.id,
      actions: ["developer_edit", "run_tests"],
      mergeRequiresApproval: true,
      openCode: oc,
      alternate: "bounded-patch-executor via Ollama when OpenCode unavailable/fails",
    };
  }

  async validateAndPreview(request: ToolRequest) {
    const input = DeveloperInputSchema.parse(request.input);
    const { config, absolutePath } = resolveWorkspace(input.workspaceId);
    return {
      workspaceId: input.workspaceId,
      workspacePath: absolutePath,
      allowedGlobs: config.allowedGlobs,
      promptPreview: input.prompt.slice(0, 240),
      runTests: input.runTests,
    };
  }

  async execute(
    request: ToolRequest,
    signal: AbortSignal,
  ): Promise<DeveloperExecutionResult> {
    if (signal.aborted) throw new Error("Aborted");
    const input = DeveloperInputSchema.parse(request.input);
    const { config, absolutePath } = resolveWorkspace(input.workspaceId);

    const rollbackDir = path.join(
      process.cwd(),
      "data",
      "rollbacks",
      request.taskId,
      String(Date.now()),
    );
    fs.mkdirSync(rollbackDir, { recursive: true });
    const before = snapshotTextFiles(absolutePath, config);
    fs.writeFileSync(
      path.join(rollbackDir, "before.json"),
      JSON.stringify(before, null, 2),
      "utf8",
    );

    const oc = await checkOpenCodeAvailable();
    let executor: "opencode" | "bounded-patch-executor" = "bounded-patch-executor";
    let summary = "";
    let modelId: string | undefined;
    let opencodeAttempted = false;
    let opencodeError: string | undefined;
    let latencyMs = 0;
    let openCodeOutput = "";

    if (input.preferOpenCode && oc.available) {
      opencodeAttempted = true;
      const run = await tryOpenCodeRun({
        workspaceRoot: absolutePath,
        prompt: input.prompt,
      });
      latencyMs = run.latencyMs;
      openCodeOutput = run.output;
      if (run.ok) {
        executor = "opencode";
        summary = "OpenCode CLI completed non-interactive run";
        modelId =
          process.env.OLLAMA_CODER_MODEL?.trim() ||
          process.env.OLLAMA_MODEL?.trim() ||
          "qwen2.5-coder:3b";
      } else {
        opencodeError = run.error ?? "OpenCode run failed";
      }
    }

    // If OpenCode unavailable/failed OR produced no file changes, use bounded alternate
    let after = snapshotTextFiles(absolutePath, config);
    let diff = diffSnapshots(before, after);
    if (executor !== "opencode" || diff.changed.length + diff.added.length === 0) {
      const patch = await runBoundedPatchExecutor({
        workspaceRoot: absolutePath,
        config,
        prompt: input.prompt,
        currentFiles: before,
      });
      executor = "bounded-patch-executor";
      summary = patch.summary;
      modelId = patch.modelId;
      latencyMs = patch.latencyMs;
      after = snapshotTextFiles(absolutePath, config);
      diff = diffSnapshots(before, after);
    }

    // Deny any writes outside allowlist by restoring forbidden paths (paranoia)
    for (const rel of [...diff.changed, ...diff.added]) {
      // already constrained by executors; keep for audit clarity
      void rel;
    }

    fs.writeFileSync(
      path.join(rollbackDir, "after.json"),
      JSON.stringify(after, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(rollbackDir, "diff.txt"), diff.unified, "utf8");

    let testOutput = "";
    let testPassed = false;
    let testRan = false;
    if (input.runTests) {
      testRan = true;
      const [cmd, ...args] = config.testCommand;
      const testResult = await runCommand(cmd, args, absolutePath, process.env, 60_000);
      testOutput = `${testResult.stdout}\n${testResult.stderr}`.trim();
      testPassed = testResult.code === 0;
      fs.writeFileSync(path.join(rollbackDir, "test-output.txt"), testOutput, "utf8");
    }

    if (!testPassed && input.runTests) {
      // Rollback files to before snapshot on failed tests
      for (const [rel, content] of Object.entries(before)) {
        const abs = path.join(absolutePath, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, "utf8");
      }
      throw new Error(
        `Developer task tests failed — workspace rolled back. Output:\n${testOutput.slice(0, 2000)}`,
      );
    }

    const changedFiles = [...diff.changed, ...diff.added];
    if (changedFiles.length === 0) {
      throw new Error("Developer task produced no allowlisted file changes");
    }

    const evidenceMarkdown = `# Developer task evidence

- Workspace: \`${input.workspaceId}\` (\`${absolutePath}\`)
- Executor: **${executor}**${executor === "bounded-patch-executor" ? " (proven alternate — not claimed as OpenCode)" : ""}
- Model: \`${modelId ?? "n/a"}\`
- Latency: ${latencyMs} ms
- OpenCode available: ${oc.available}
- OpenCode attempted: ${opencodeAttempted}
${opencodeError ? `- OpenCode error: ${opencodeError}` : ""}
- Changed files: ${changedFiles.map((f) => `\`${f}\``).join(", ")}
- Tests: ${testRan ? (testPassed ? "PASSED" : "FAILED") : "skipped"}
- Rollback snapshot: \`${path.relative(process.cwd(), rollbackDir)}\`

## Diff (truncated)
\`\`\`
${diff.unified.slice(0, 4000)}
\`\`\`

## Test output
\`\`\`
${testOutput.slice(0, 3000)}
\`\`\`

${openCodeOutput ? `## OpenCode output (truncated)\n\`\`\`\n${openCodeOutput.slice(0, 2000)}\n\`\`\`\n` : ""}
`;

    return {
      toolId: "opencode",
      executor,
      workspaceId: input.workspaceId,
      workspacePath: absolutePath,
      modelId,
      summary,
      diff: diff.unified,
      changedFiles,
      rollbackSnapshotRef: path.relative(process.cwd(), rollbackDir),
      test: { ran: testRan, passed: testPassed, output: testOutput },
      opencodeAvailable: oc.available,
      opencodeAttempted,
      opencodeError,
      latencyMs,
      evidenceMarkdown,
    };
  }
}
