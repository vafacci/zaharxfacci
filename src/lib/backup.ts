import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";

export type BackupResult = {
  backupPath: string;
  relativePath: string;
  bytes: number;
  sourceDb: string;
  copiedSidecars: string[];
  createdAt: string;
};

/**
 * Prisma resolves relative `file:` URLs against the schema directory (`prisma/`),
 * not the process cwd / repo root. Match that here.
 */
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const schemaDir = path.join(projectRoot(), "prisma");
  if (url.startsWith("file:")) {
    const raw = url.slice("file:".length);
    if (path.isAbsolute(raw)) return raw;
    return path.resolve(schemaDir, raw);
  }
  return path.join(schemaDir, "dev.db");
}

/** Exported for acceptance tests — same resolution as Prisma schema-relative paths. */
export function resolveDbPathForTest(): string {
  return resolveDbPath();
}

export function backupsRoot(): string {
  return path.join(projectRoot(), "data", "backups");
}

/** Copy SQLite main file + WAL/SHM sidecars into data/backups. */
export function createSqliteBackup(label?: string): BackupResult {
  const sourceDb = resolveDbPath();
  if (!fs.existsSync(sourceDb)) {
    throw new Error(`Database file not found: ${sourceDb}`);
  }

  const dir = backupsRoot();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = `facci-${stamp}${label ? `-${label.replace(/[^a-zA-Z0-9_-]/g, "_")}` : ""}`;
  const dest = path.join(dir, `${base}.db`);
  fs.copyFileSync(sourceDb, dest);

  const copiedSidecars: string[] = [];
  for (const side of [`${sourceDb}-wal`, `${sourceDb}-shm`]) {
    if (fs.existsSync(side)) {
      const sideName = path.basename(side);
      const sideDest = path.join(dir, `${base}${sideName.endsWith("-wal") ? ".db-wal" : ".db-shm"}`);
      fs.copyFileSync(side, sideDest);
      copiedSidecars.push(path.relative(projectRoot(), sideDest));
    }
  }

  const stat = fs.statSync(dest);
  return {
    backupPath: dest,
    relativePath: path.relative(projectRoot(), dest),
    bytes: stat.size,
    sourceDb,
    copiedSidecars,
    createdAt: new Date().toISOString(),
  };
}

export function listBackups(): {
  relativePath: string;
  bytes: number;
  mtime: string;
}[] {
  const dir = backupsRoot();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db") && !f.includes("-wal") && !f.includes("-shm"))
    .map((f) => {
      const abs = path.join(dir, f);
      const st = fs.statSync(abs);
      return {
        relativePath: path.relative(projectRoot(), abs),
        bytes: st.size,
        mtime: st.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.mtime.localeCompare(a.mtime));
}

function assertBackupPath(from: string): void {
  const norm = from.replace(/\\/g, "/");
  const root = backupsRoot().replace(/\\/g, "/");
  if (!norm.startsWith(root) && !norm.includes("/data/backups/")) {
    throw new Error("Restore only allowed from data/backups/");
  }
}

/** Copy a backup (and matching -wal/-shm if present) to an absolute destination path. */
export function copyBackupTo(fromRelativeOrAbsolute: string, destAbsolute: string): {
  from: string;
  restoredTo: string;
  copiedSidecars: string[];
} {
  const from = path.isAbsolute(fromRelativeOrAbsolute)
    ? fromRelativeOrAbsolute
    : path.resolve(projectRoot(), fromRelativeOrAbsolute);
  if (!fs.existsSync(from)) throw new Error(`Backup not found: ${from}`);
  assertBackupPath(from);

  fs.mkdirSync(path.dirname(destAbsolute), { recursive: true });
  fs.copyFileSync(from, destAbsolute);

  const copiedSidecars: string[] = [];
  for (const suffix of ["-wal", "-shm"] as const) {
    const side = `${from}${suffix}`;
    if (fs.existsSync(side)) {
      const sideDest = `${destAbsolute}${suffix}`;
      fs.copyFileSync(side, sideDest);
      copiedSidecars.push(sideDest);
    }
  }
  // Prefer a clean main-file open when sidecar copies are absent
  if (copiedSidecars.length === 0) {
    for (const side of [`${destAbsolute}-wal`, `${destAbsolute}-shm`]) {
      if (fs.existsSync(side)) fs.unlinkSync(side);
    }
  }
  return { from, restoredTo: destAbsolute, copiedSidecars };
}

/**
 * Restore a backup into an isolated test database under data/backups/restore-test/.
 * Never overwrites the active production DATABASE_URL file.
 */
export function restoreSqliteBackupIsolated(
  fromRelativeOrAbsolute: string,
  fileName = `facci-restore-test-${Date.now()}.db`,
): {
  from: string;
  restoredTo: string;
  relativePath: string;
} {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = path.join(backupsRoot(), "restore-test", safe);
  const result = copyBackupTo(fromRelativeOrAbsolute, dest);
  return {
    from: result.from,
    restoredTo: result.restoredTo,
    relativePath: path.relative(projectRoot(), result.restoredTo),
  };
}

export type IntegrityResult = {
  ok: boolean;
  integrityCheck: string;
  organizationCount: number | null;
  projectCount: number | null;
  details: string;
};

/** Open a SQLite file (isolated) and run PRAGMA integrity_check + basic counts. */
export async function verifySqliteFile(absoluteDbPath: string): Promise<IntegrityResult> {
  if (!fs.existsSync(absoluteDbPath)) {
    return {
      ok: false,
      integrityCheck: "missing",
      organizationCount: null,
      projectCount: null,
      details: `File not found: ${absoluteDbPath}`,
    };
  }
  const { PrismaClient } = await import("@prisma/client");
  const url = `file:${absoluteDbPath.replace(/\\/g, "/")}`;
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "PRAGMA integrity_check;",
    );
    const integrityCheck =
      rows
        .map((r) => {
          const v = r.integrity_check ?? r.Integrity_check ?? Object.values(r)[0];
          return v == null ? "" : String(v);
        })
        .filter(Boolean)
        .join("; ") || "unknown";
    let organizationCount: number | null = null;
    let projectCount: number | null = null;
    try {
      organizationCount = await client.organization.count();
      projectCount = await client.project.count();
    } catch (err) {
      return {
        ok: integrityCheck === "ok",
        integrityCheck,
        organizationCount,
        projectCount,
        details: `Integrity ${integrityCheck}; schema probe failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return {
      ok: integrityCheck === "ok",
      integrityCheck,
      organizationCount,
      projectCount,
      details: `integrity_check=${integrityCheck}; orgs=${organizationCount}; projects=${projectCount}`,
    };
  } finally {
    await client.$disconnect();
  }
}

/**
 * Restore a backup file over the active SQLite DB.
 * Caller must stop Next.js + worker first. Prefer restoreSqliteBackupIsolated for tests.
 */
export function restoreSqliteBackup(relativeOrAbsolute: string): {
  restoredTo: string;
  from: string;
} {
  const from = path.isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : path.resolve(projectRoot(), relativeOrAbsolute);
  if (!fs.existsSync(from)) throw new Error(`Backup not found: ${from}`);
  assertBackupPath(from);

  const dest = resolveDbPath();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // Safety copy of current DB before overwrite
  if (fs.existsSync(dest)) {
    createSqliteBackup("pre-restore");
  }
  copyBackupTo(from, dest);
  return { restoredTo: dest, from };
}
