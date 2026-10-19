import fs from "fs";
import path from "path";

export function projectRoot(): string {
  return process.cwd();
}

export function artifactsRoot(): string {
  return path.join(projectRoot(), "data", "artifacts");
}

export function ensureProjectArtifactDir(projectSlug: string): string {
  const dir = path.join(artifactsRoot(), projectSlug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeProjectArtifact(params: {
  projectSlug: string;
  filename: string;
  content: string;
}): { storageRef: string; absolutePath: string } {
  const dir = ensureProjectArtifactDir(params.projectSlug);
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const absolutePath = path.join(dir, safeName);
  fs.writeFileSync(absolutePath, params.content, "utf8");
  const storageRef = path.join("data", "artifacts", params.projectSlug, safeName);
  return { storageRef, absolutePath };
}

/** Copy a binary media file into the project artifact tree (e.g. Image Studio PNG). */
export function copyProjectMedia(params: {
  projectSlug: string;
  sourceAbsolutePath: string;
  filename: string;
}): { storageRef: string; absolutePath: string } {
  const mediaDir = path.join(ensureProjectArtifactDir(params.projectSlug), "media");
  fs.mkdirSync(mediaDir, { recursive: true });
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const absolutePath = path.join(mediaDir, safeName);
  fs.copyFileSync(params.sourceAbsolutePath, absolutePath);
  const storageRef = path.join(
    "data",
    "artifacts",
    params.projectSlug,
    "media",
    safeName,
  );
  return { storageRef, absolutePath };
}
