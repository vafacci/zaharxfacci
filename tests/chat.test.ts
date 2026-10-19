import { describe, expect, it } from "vitest";
import {
  buildChatTaskFields,
  inferProjectSlugFromMessage,
  isCodingChatIntent,
  resolveChatProjectSlug,
} from "@/domain/chat";
import { classifyOwnerIntent } from "@/domain/routing";

describe("chat intent", () => {
  it("detects Danish e2e coding phrasing", () => {
    expect(
      isCodingChatIntent(
        "Åbn mit projekt, undersøg fejlen, ret den og test resultatet i toy-counter",
      ),
    ).toBe(true);
  });

  it("builds operational coding objective with toy-counter", () => {
    const fields = buildChatTaskFields(
      "Åbn toy-counter, undersøg fejlen i add(), ret den og kør tests.",
    );
    expect(fields.coding).toBe(true);
    expect(fields.workspaceId).toBe("toy-counter");
    expect(fields.title.toLowerCase()).not.toBe("fix toy-counter add bug");
    expect(fields.objective).toMatch(/toy-counter/);
    expect(fields.objective).toMatch(/a \+ b/);
  });

  it("routes AUTIQ brand file work to autiq workspace", () => {
    const fields = buildChatTaskFields(
      "Opdater AUTIQ brand voice med én kort note og tilføj en caption-idé i content/calendar.md.",
      "autiq",
    );
    expect(fields.coding).toBe(true);
    expect(fields.workspaceId).toBe("autiq");
    expect(fields.objective).toMatch(/workspaces\/autiq|autiq workspace/i);
  });

  it("routes AUTIQ website work to autiq-web", () => {
    const fields = buildChatTaskFields(
      "I AUTIQ website (autiq-web), tilføj en kort note i README.",
      "autiq",
    );
    expect(fields.coding).toBe(true);
    expect(fields.workspaceId).toBe("autiq-web");
  });

  it("routes Grupvi and DreamIT vault edits", () => {
    const g = buildChatTaskFields(
      "Opdater Grupvi product/ux-notes.md med én kort UX-note.",
      "grupvi",
    );
    expect(g.coding).toBe(true);
    expect(g.workspaceId).toBe("grupvi");
    const d = buildChatTaskFields(
      "Opdater DreamIT product/notes.md med én kort produktnote.",
      "dreamit",
    );
    expect(d.coding).toBe(true);
    expect(d.workspaceId).toBe("dreamit");
  });

  it("keeps generic asks non-coding", () => {
    expect(isCodingChatIntent("Draft 3 content ideas for AUTIQ this week")).toBe(
      false,
    );
  });

  it("infers project slug from brand mentions", () => {
    expect(inferProjectSlugFromMessage("Opdater NOFACCI product notes")).toBe(
      "nofacci",
    );
    expect(inferProjectSlugFromMessage("DailyCap brand claims review")).toBe(
      "dailycap",
    );
    expect(inferProjectSlugFromMessage("Grupvi UX note")).toBe("grupvi");
  });

  it("routes NOFACCI and DailyCap vault edits", () => {
    const n = buildChatTaskFields(
      "Opdater NOFACCI product/notes.md med én kort ops-note.",
      "nofacci",
    );
    expect(n.coding).toBe(true);
    expect(n.workspaceId).toBe("nofacci");
    const d = buildChatTaskFields(
      "Opdater DailyCap product/notes.md med én kort produktnote.",
      "dailycap",
    );
    expect(d.coding).toBe(true);
    expect(d.workspaceId).toBe("dailycap");
  });

  it("message brand overrides UI project selection", () => {
    expect(
      resolveChatProjectSlug({
        message: "NOFACCI agency research first",
        uiProjectSlug: "autiq",
      }),
    ).toBe("nofacci");
  });

  it("NOFACCI research-first is not coding (even if UI is AUTIQ)", () => {
    const msg = [
      "Nofacci projektet er et agency bureau for vores AI influencers.",
      "Inspiration: https://lemanagement.dk/becoming-a-model/",
      "Der er ikke bygget nogen hjemmeside endnu.",
      "Først skal vi forstå konceptet og lave relevant research — ingen kode endnu.",
    ].join(" ");
    expect(inferProjectSlugFromMessage(msg)).toBe("nofacci");
    expect(isCodingChatIntent(msg)).toBe(false);
    const intent = classifyOwnerIntent("Chat request", msg);
    expect(intent.wantsResearch).toBe(true);
    expect(intent.wantsCoding).toBe(false);
    const fields = buildChatTaskFields(msg, "autiq");
    expect(fields.coding).toBe(false);
    expect(fields.objective).toMatch(/research/i);
    expect(fields.objective).toMatch(/nofacci/i);
  });

  it("NOFACCI website build still routes to developer/nofacci-web", () => {
    const msg =
      "Byg NOFACCI hjemmeside nu i nofacci-web ud fra brand pack og inspiration.";
    expect(isCodingChatIntent(msg)).toBe(true);
    const fields = buildChatTaskFields(msg, "autiq");
    expect(fields.coding).toBe(true);
    expect(fields.workspaceId).toBe("nofacci-web");
  });
});
