import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { OpenCodeAdapter, checkOpenCodeAvailable } from "@/tools/opencode-adapter";

const runLive = process.env.FACCI_LIVE_DEV_TEST === "1";

describe("opencode availability", () => {
  it(
    "reports OpenCode install status",
    async () => {
      const status = await checkOpenCodeAvailable();
      expect(typeof status.available).toBe("boolean");
      expect(status.details.length).toBeGreaterThan(0);
    },
    30_000,
  );
});

describe.runIf(runLive)("developer adapter live toy fix", () => {
  it(
    "fixes toy-counter add() with tests and rollback evidence",
    async () => {
      const counterPath = path.join(
        process.cwd(),
        "workspaces",
        "toy-counter",
        "src",
        "counter.js",
      );
      // Ensure broken starting state
      fs.writeFileSync(
        counterPath,
        `export function add(a, b) {\n  return a - b;\n}\n\nexport function multiply(a, b) {\n  return a * b;\n}\n`,
        "utf8",
      );

      const adapter = new OpenCodeAdapter();
      const result = await adapter.execute(
        {
          toolId: "opencode",
          action: "developer_edit",
          projectId: "test-project",
          agentId: "test-agent",
          taskId: `test-dev-${Date.now()}`,
          idempotencyKey: `dev-${Date.now()}`,
          input: {
            workspaceId: "toy-counter",
            prompt:
              "Fix the bug in src/counter.js so add(a, b) returns a + b. Keep multiply unchanged. Make tests pass.",
            runTests: true,
            preferOpenCode: true,
          },
        },
        AbortSignal.timeout(360_000),
      );

      expect(result.changedFiles.length).toBeGreaterThan(0);
      expect(result.test.passed).toBe(true);
      expect(result.rollbackSnapshotRef.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(process.cwd(), result.rollbackSnapshotRef))).toBe(
        true,
      );
      const fixed = fs.readFileSync(counterPath, "utf8");
      expect(fixed).toMatch(/a\s*\+\s*b/);
      expect(["opencode", "bounded-patch-executor"]).toContain(result.executor);
    },
    360_000,
  );
});
