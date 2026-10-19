/**
 * AUTIQ brand vault helpers — thin wrappers over shared brand-pack loader.
 */
import {
  brandPackReadinessSummary,
  loadBrandPack,
  type BrandPack,
} from "@/tools/brand-pack";
import { isPathAllowed, resolveWorkspace } from "@/tools/workspace";
import fs from "fs";
import path from "path";

export {
  brandPackReadinessSummary,
  BRAND_PACK_FILES as AUTIQ_BRAND_PACK_FILES,
  type BrandPack as AutiqBrandPack,
  type BrandPackFile as AutiqBrandPackFile,
  type BrandPackSection as AutiqBrandPackSection,
} from "@/tools/brand-pack";

const VOICE_REL = "brand/voice.md";

export function loadAutiqBrandVoice(maxChars = 2500): string | null {
  try {
    const { config, absolutePath: root } = resolveWorkspace("autiq");
    if (!isPathAllowed(config, VOICE_REL)) return null;
    const abs = path.join(root, VOICE_REL);
    if (!fs.existsSync(abs)) return null;
    const raw = fs.readFileSync(abs, "utf8").trim();
    if (!raw) return null;
    return raw.slice(0, maxChars);
  } catch {
    return null;
  }
}

export function loadAutiqBrandPack(opts?: {
  maxTotalChars?: number;
  maxPerFile?: number;
}): BrandPack {
  return loadBrandPack("autiq", opts);
}
