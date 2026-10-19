import fs from "fs";
import path from "path";

export type WorkspaceConfig = {
  id: string;
  label: string;
  /** Path relative to FACCI-AGENT root (default). */
  relativePath?: string;
  /**
   * Optional absolute path outside the FACCI repo (explicit brand apps).
   * Must be listed in config; never deduced from chat text alone.
   */
  absolutePath?: string;
  /** Optional project slug this workspace primarily serves (routing hint). */
  projectSlug?: string;
  allowedGlobs: string[];
  deniedGlobs: string[];
  testCommand: string[];
  enabled: boolean;
};

type WorkspaceFile = { workspaces: WorkspaceConfig[] };

function projectRoot(): string {
  return process.cwd();
}

export function loadWorkspaces(): WorkspaceConfig[] {
  const configPath = path.join(projectRoot(), "config", "workspaces.json");
  if (!fs.existsSync(configPath)) return [];
  const raw = JSON.parse(fs.readFileSync(configPath, "utf8")) as WorkspaceFile;
  return (raw.workspaces ?? []).filter((w) => w.enabled);
}

export function workspaceForProjectSlug(projectSlug: string): WorkspaceConfig | null {
  const all = loadWorkspaces();
  return (
    all.find((w) => w.projectSlug === projectSlug && w.id !== "toy-counter") ??
    all.find((w) => w.id === projectSlug) ??
    null
  );
}

export function resolveWorkspace(workspaceId: string): {
  config: WorkspaceConfig;
  absolutePath: string;
} {
  const config = loadWorkspaces().find((w) => w.id === workspaceId);
  if (!config) {
    throw new Error(`Workspace not allowlisted: ${workspaceId}`);
  }

  let absolutePath: string;
  if (config.absolutePath?.trim()) {
    absolutePath = path.resolve(config.absolutePath.trim());
  } else if (config.relativePath?.trim()) {
    absolutePath = path.resolve(projectRoot(), config.relativePath.trim());
    const root = path.resolve(projectRoot());
    if (!absolutePath.startsWith(root + path.sep) && absolutePath !== root) {
      throw new Error(`Workspace path escapes project root: ${absolutePath}`);
    }
  } else {
    throw new Error(`Workspace ${workspaceId} missing relativePath or absolutePath`);
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Workspace path missing: ${absolutePath}`);
  }

  const normalized = absolutePath.toLowerCase();
  // Hard deny: Image Studio repo is a separate product — never treat as FACCI edit target.
  if (normalized.includes(`${path.sep}imagegen`) || normalized.endsWith(`${path.sep}imagegen`)) {
    throw new Error("Refusing workspace that looks like imagegen");
  }

  return { config, absolutePath };
}

export function assertPathInsideWorkspace(workspaceRoot: string, targetPath: string) {
  const abs = path.resolve(targetPath);
  const root = path.resolve(workspaceRoot);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error(`Path outside workspace deny: ${abs}`);
  }
}

/** Simple glob-ish match for allow/deny lists (supports ** and *). */
export function matchGlob(relPath: string, glob: string): boolean {
  const norm = relPath.replace(/\\/g, "/");
  const g = glob.replace(/\\/g, "/");
  if (g === "**" || g === "**/*") return true;
  const escaped = g
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{DS}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{DS}}/g, ".*");
  return new RegExp(`^${escaped}$`, "i").test(norm);
}

export function isPathAllowed(config: WorkspaceConfig, relativePath: string): boolean {
  const rel = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
  if (config.deniedGlobs.some((g) => matchGlob(rel, g))) return false;
  if (config.allowedGlobs.length === 0) return false;
  return config.allowedGlobs.some((g) => matchGlob(rel, g));
}

export function snapshotTextFiles(
  workspaceRoot: string,
  config: WorkspaceConfig,
): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
        continue;
      }
      const abs = path.join(dir, entry.name);
      const rel = path.relative(workspaceRoot, abs);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!isPathAllowed(config, rel)) continue;
      if (!/\.(js|ts|tsx|jsx|json|md|txt|css|mjs)$/i.test(entry.name)) continue;
      // Cap snapshot size for large brand apps
      const content = fs.readFileSync(abs, "utf8");
      if (content.length > 80_000) continue;
      out[rel.replace(/\\/g, "/")] = content;
    }
  };
  walk(workspaceRoot);
  return out;
}

export function diffSnapshots(
  before: Record<string, string>,
  after: Record<string, string>,
): { changed: string[]; added: string[]; removed: string[]; unified: string } {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  const lines: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    if (!(key in before)) {
      added.push(key);
      lines.push(`+++ added ${key}`);
      continue;
    }
    if (!(key in after)) {
      removed.push(key);
      lines.push(`--- removed ${key}`);
      continue;
    }
    if (before[key] !== after[key]) {
      changed.push(key);
      lines.push(`@@ ${key}`);
      lines.push(`- ${before[key].slice(0, 500).replace(/\n/g, "\\n")}`);
      lines.push(`+ ${after[key].slice(0, 500).replace(/\n/g, "\\n")}`);
    }
  }
  return { changed, added, removed, unified: lines.join("\n") };
}
