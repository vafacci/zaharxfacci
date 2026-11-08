import { NextResponse, type NextRequest } from "next/server";
import { failure, guard, noStore } from "@/lib/partner-api";
import {
  addResource,
  addTodo,
  completeTodo,
  deleteResource,
  deleteTodo,
  loadHq,
  reopenTodo,
  setCheckpoint,
  setFocus,
  setNotes,
  setTodoOwner,
} from "@/lib/grupvi-hq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  try {
    return NextResponse.json(await loadHq(), { headers: noStore });
  } catch (err) {
    return failure(err);
  }
}

export async function PATCH(request: NextRequest) {
  const blocked = await guard(request, { write: true });
  if (blocked) return blocked;
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          op?: string;
          id?: string;
          done?: boolean;
          task?: string;
          owner?: string;
          focus?: string;
          notes?: string;
          title?: string;
          url?: string;
          note?: string;
        }
      | null;

    const op = body?.op;

    if (op === "focus" && typeof body?.focus === "string") {
      const focus = await setFocus(body.focus);
      return NextResponse.json({ ok: true, focus }, { headers: noStore });
    }
    if (op === "notes" && typeof body?.notes === "string") {
      const notes = await setNotes(body.notes);
      return NextResponse.json({ ok: true, notes }, { headers: noStore });
    }
    if (op === "checkpoint" && typeof body?.id === "string") {
      const checkpoints = await setCheckpoint(body.id, Boolean(body.done));
      return NextResponse.json({ ok: true, checkpoints }, { headers: noStore });
    }
    if (op === "todo_owner" && typeof body?.id === "string" && typeof body.owner === "string") {
      const todos = await setTodoOwner(body.id, body.owner);
      return NextResponse.json({ ok: true, todos }, { headers: noStore });
    }
    if (op === "todo_add" && typeof body?.task === "string" && body.task.trim()) {
      const todo = await addTodo({
        task: body.task,
        owner: typeof body.owner === "string" ? body.owner : "",
      });
      return NextResponse.json({ ok: true, todo, hq: await loadHq() }, { headers: noStore });
    }
    if (op === "todo_complete" && typeof body?.id === "string") {
      const result = await completeTodo(body.id);
      return NextResponse.json({ ok: true, ...result }, { headers: noStore });
    }
    if (op === "todo_reopen" && typeof body?.id === "string") {
      const result = await reopenTodo(body.id);
      return NextResponse.json({ ok: true, ...result }, { headers: noStore });
    }
    if (op === "todo_delete" && typeof body?.id === "string") {
      const todos = await deleteTodo(body.id);
      return NextResponse.json({ ok: true, todos }, { headers: noStore });
    }
    if (
      op === "resource_add" &&
      typeof body?.title === "string" &&
      typeof body?.url === "string" &&
      body.title.trim() &&
      body.url.trim()
    ) {
      const resource = await addResource({
        title: body.title,
        url: body.url,
        note: typeof body.note === "string" ? body.note : "",
      });
      return NextResponse.json(
        { ok: true, resource, hq: await loadHq() },
        { headers: noStore },
      );
    }
    if (op === "resource_delete" && typeof body?.id === "string") {
      const resources = await deleteResource(body.id);
      return NextResponse.json({ ok: true, resources }, { headers: noStore });
    }

    return NextResponse.json({ error: "Ukendt op" }, { status: 400, headers: noStore });
  } catch (err) {
    return failure(err);
  }
}
