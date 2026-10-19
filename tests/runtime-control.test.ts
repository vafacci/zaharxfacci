import { describe, expect, it } from "vitest";
import { classifyRuntimeIntent } from "@/domain/runtime-control";

describe("runtime-control intents", () => {
  it("detects game mode on/off in DA/EN", () => {
    expect(classifyRuntimeIntent("game mode on")?.action).toBe("game_on");
    expect(classifyRuntimeIntent("slå game mode til")?.action).toBe("game_on");
    expect(classifyRuntimeIntent("fri gpu til spil")?.action).toBe("game_on");
    expect(classifyRuntimeIntent("game mode off")?.action).toBe("game_off");
    expect(classifyRuntimeIntent("udviklingsmode")?.action).toBe("game_off");
    expect(classifyRuntimeIntent("start facci igen")?.action).toBe("game_off");
  });

  it("detects status and worker controls", () => {
    expect(classifyRuntimeIntent("facci status")?.action).toBe("status");
    expect(classifyRuntimeIntent("stop worker")?.action).toBe("stop_worker");
    expect(classifyRuntimeIntent("start worker")?.action).toBe("start_worker");
  });

  it("ignores normal work chat", () => {
    expect(classifyRuntimeIntent("Tilføj FACCI note til AGENTS.md")).toBeNull();
    expect(classifyRuntimeIntent("Kør weekly content loop")).toBeNull();
  });
});
