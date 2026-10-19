import { NextResponse } from "next/server";
import { ChatRequestSchema, handleChatMessage } from "@/domain/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Honest chat entrypoint: owner message → createTask → worker/Ollama execute.
 * Not a free-form conversational LLM thread; replies describe real FACCI work.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = ChatRequestSchema.parse(body);
    const result = await handleChatMessage(input);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 400 },
    );
  }
}
