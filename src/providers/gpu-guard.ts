import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type GpuGuardStatus = {
  comfyUiLikelyRunning: boolean;
  freeVramMiB: number | null;
  totalVramMiB: number | null;
  usedVramMiB: number | null;
  recommendCpuOffload: boolean;
  details: string;
};

function portOpen(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(400, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function readNvidiaMemory(): Promise<{
  free: number | null;
  total: number | null;
  used: number | null;
}> {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=memory.free,memory.total,memory.used",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 2000, windowsHide: true },
    );
    const [free, total, used] = stdout
      .trim()
      .split(",")
      .map((p) => Number(p.trim()));
    return {
      free: Number.isFinite(free) ? free : null,
      total: Number.isFinite(total) ? total : null,
      used: Number.isFinite(used) ? used : null,
    };
  } catch {
    return { free: null, total: null, used: null };
  }
}

/**
 * Protect Image Studio / ComfyUI: if port 8188 is open or free VRAM is tight,
 * FACCI should offload Ollama to CPU instead of contending for the GPU.
 */
export async function inspectGpuGuard(minFreeVramMiB = 2800): Promise<GpuGuardStatus> {
  const comfyUiLikelyRunning = await portOpen(8188);
  const mem = await readNvidiaMemory();
  const freeLow = mem.free != null && mem.free < minFreeVramMiB;
  const recommendCpuOffload = comfyUiLikelyRunning || freeLow;

  const parts = [
    comfyUiLikelyRunning ? "ComfyUI port 8188 open" : "ComfyUI port 8188 closed",
    mem.free != null
      ? `VRAM free ${mem.free} / ${mem.total} MiB`
      : "nvidia-smi unavailable",
    recommendCpuOffload ? "Ollama will use CPU offload (num_gpu=0)" : "GPU inference allowed",
  ];

  return {
    comfyUiLikelyRunning,
    freeVramMiB: mem.free,
    totalVramMiB: mem.total,
    usedVramMiB: mem.used,
    recommendCpuOffload,
    details: parts.join("; "),
  };
}
