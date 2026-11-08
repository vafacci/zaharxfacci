import fs from "fs";
import path from "path";
import { projectRoot } from "@/lib/paths";
import {
  loadGrupviHqState,
  saveGrupviHqState,
  type GrupviHqState,
} from "@/lib/partner-db";

export type Checkpoint = {
  id: string;
  label: string;
  done: boolean;
};

export type BoardTodo = {
  id: string;
  task: string;
  owner: string;
  status: string;
};

export type BoardDone = {
  id: string;
  task: string;
  date: string;
};

export type Resource = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export type Workspace = {
  liveApp: string;
  liveLanding: string;
  exampleProject: string;
  focus: string;
  notes: string;
  checkpoints: Checkpoint[];
  todos: BoardTodo[];
  done: BoardDone[];
  resources: Resource[];
};

/** Bump when partner-facing copy should refresh for everyone. */
const COPY_VERSION = 2;

const CHECKPOINT_LABELS: Record<string, string> = {
  P0: "Appen ser færdig ud — klar til at vise andre",
  P1: "Mindst én studiegruppe bruger Grupvi til et rigtigt projekt",
  M0: "Vi er enige om budskabet: én kort sætning og tre fordele",
  C0: "Første content er klar: idéer og mindst tre optagelser",
  B0: "Vi har skrevet ned, hvordan vi senere kan tjene penge — uden at bygge det endnu",
  O0: "Vi bruger denne side til opgaver og noter",
};

const DEFAULT_CHECKPOINTS: Checkpoint[] = Object.entries(CHECKPOINT_LABELS).map(
  ([id, label]) => ({ id, label, done: false }),
);

const DEFAULT_FOCUS =
  "Gør appen klar til rigtige studiegrupper. Først polish — penge kommer senere.";

const STARTER_TODOS: BoardTodo[] = [
  {
    id: "T1",
    task: "Gennemgå appen sammen og skriv, hvad der ikke føles færdigt",
    owner: "",
    status: "todo",
  },
  {
    id: "T2",
    task: "Lav en kort liste over de vigtigste visuelle rettelser",
    owner: "",
    status: "todo",
  },
  {
    id: "T3",
    task: "Skriv 5–10 content-idéer og hvor I vil filme dem",
    owner: "",
    status: "todo",
  },
  {
    id: "T4",
    task: "Læs landingsiden og notér, hvad der mangler eller er for meget",
    owner: "",
    status: "todo",
  },
  {
    id: "T5",
    task: "Skriv idéer til senere indtjening — uden at bygge noget endnu",
    owner: "",
    status: "todo",
  },
  {
    id: "T6",
    task: "Find den første studiegruppe, I vil invitere som pilot",
    owner: "",
    status: "todo",
  },
];

const STARTER_RESOURCES: Resource[] = [
  {
    id: "R1",
    title: "Landingside",
    url: "https://studiechat.vercel.app/",
    note: "Offentlig side",
  },
  {
    id: "R2",
    title: "Live app",
    url: "https://studiechat.vercel.app/app",
    note: "Produktet",
  },
  {
    id: "R3",
    title: "Eksempel-projekt",
    url: "https://studiechat.vercel.app/app/project/liblpm",
    note: "Til demo",
  },
];

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.slice(0, 2000);
  return `https://${trimmed}`.slice(0, 2000);
}

function normalizeResources(raw: unknown): Resource[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter(
      (r): r is { id?: unknown; title?: unknown; url?: unknown; note?: unknown } =>
        Boolean(r) && typeof r === "object",
    )
    .map((r, i) => ({
      id: typeof r.id === "string" && r.id.trim() ? r.id.trim() : `R${i + 1}`,
      title: typeof r.title === "string" ? r.title.trim().slice(0, 200) : "",
      url: typeof r.url === "string" ? normalizeUrl(r.url) : "",
      note: typeof r.note === "string" ? r.note.trim().slice(0, 300) : "",
    }))
    .filter((r) => r.title && r.url);
}

function vaultRoot(): string {
  return path.join(projectRoot(), "workspaces", "grupvi");
}

function boardPath(): string {
  return path.join(vaultRoot(), "tasks", "BOARD.md");
}

function dbEnabled(): boolean {
  return Boolean(process.env.PARTNER_DATABASE_URL);
}

function withCanonicalLabels(checkpoints: Checkpoint[]): Checkpoint[] {
  return checkpoints.map((c) => ({
    ...c,
    label: CHECKPOINT_LABELS[c.id] ?? c.label,
  }));
}

function isMetaDone(task: string): boolean {
  return /FACCI|vault|HQ UI|BOARD\.md|`\/grupvi`|workspaces\/grupvi/i.test(task);
}

function isLegacyTodo(task: string): boolean {
  return /ideas\.md|monetization-later|meeting-template|Home\/Chat|UX-fixes|content\/|meetings\/|one-liner|kernehuller|rå klip/i.test(
    task,
  );
}

type Board = Omit<Workspace, "liveApp" | "liveLanding" | "exampleProject"> & {
  copyVersion: number;
};

function freshBoard(): Board {
  return {
    copyVersion: COPY_VERSION,
    focus: DEFAULT_FOCUS,
    notes: "",
    checkpoints: DEFAULT_CHECKPOINTS,
    todos: STARTER_TODOS,
    done: [],
    resources: STARTER_RESOURCES,
  };
}

function migrateBoard(stored: GrupviHqState): Board {
  const doneFlags = new Map(
    (stored.checkpoints ?? []).map((c) => [c.id, Boolean(c.done)]),
  );
  const checkpoints = DEFAULT_CHECKPOINTS.map((c) => ({
    ...c,
    done: doneFlags.get(c.id) ?? false,
  }));

  const oldTodos = (stored.todos ?? []).filter((t) => t.id && t.id !== "—");
  const mostlyLegacy =
    oldTodos.length > 0 &&
    oldTodos.filter((t) => isLegacyTodo(t.task)).length >= Math.ceil(oldTodos.length / 2);

  const todos: BoardTodo[] = mostlyLegacy
    ? STARTER_TODOS
    : oldTodos.map((t) => ({
        id: t.id,
        task: t.task,
        owner: t.owner ?? "",
        status: t.status || "todo",
      }));

  const done = (stored.done ?? [])
    .filter((d) => d.task && !isMetaDone(d.task))
    .map((d) => ({ id: d.id, task: d.task, date: d.date }));

  const focus =
    typeof stored.focus === "string" && stored.focus.trim() && !/polish først|penge senere/i.test(stored.focus)
      ? stored.focus
      : typeof stored.focus === "string" && stored.focus.trim()
        ? DEFAULT_FOCUS
        : DEFAULT_FOCUS;

  // If focus is the old terse version, upgrade wording
  const focusOut =
    /polish først|Gør appen klar til rigtige studiegrupper — polish/i.test(stored.focus ?? "")
      ? DEFAULT_FOCUS
      : (stored.focus?.trim() ? stored.focus : DEFAULT_FOCUS);

  const resources = normalizeResources(stored.resources) ?? STARTER_RESOURCES;

  return {
    copyVersion: COPY_VERSION,
    focus: focusOut || focus,
    notes: typeof stored.notes === "string" ? stored.notes : "",
    checkpoints: withCanonicalLabels(checkpoints),
    todos,
    done,
    resources,
  };
}

function toDbState(board: Board): GrupviHqState {
  return {
    copyVersion: board.copyVersion,
    focus: board.focus,
    notes: board.notes,
    checkpoints: board.checkpoints,
    todos: board.todos.map((t) => ({
      id: t.id,
      task: t.task,
      room: "",
      owner: t.owner,
      deadline: "",
      status: t.status,
    })),
    done: board.done,
    resources: board.resources,
  };
}

async function currentWorkspace(): Promise<Board> {
  if (!dbEnabled()) return freshBoard();
  const stored = await loadGrupviHqState();
  if (!stored) {
    const seed = freshBoard();
    await saveGrupviHqState(toDbState(seed));
    return seed;
  }
  if ((stored.copyVersion ?? 0) < COPY_VERSION) {
    const migrated = migrateBoard(stored);
    await saveGrupviHqState(toDbState(migrated));
    return migrated;
  }
  const resources = normalizeResources(stored.resources);
  const board: Board = {
    copyVersion: stored.copyVersion ?? COPY_VERSION,
    focus: stored.focus?.trim() ? stored.focus : DEFAULT_FOCUS,
    notes: typeof stored.notes === "string" ? stored.notes : "",
    checkpoints: withCanonicalLabels(
      (stored.checkpoints?.length ? stored.checkpoints : DEFAULT_CHECKPOINTS).map((c) => ({
        id: c.id,
        label: c.label,
        done: Boolean(c.done),
      })),
    ),
    todos: (stored.todos ?? [])
      .filter((t) => t.id && t.id !== "—")
      .map((t) => ({
        id: t.id,
        task: t.task,
        owner: t.owner ?? "",
        status: t.status || "todo",
      })),
    done: (stored.done ?? [])
      .filter((d) => d.task && !isMetaDone(d.task))
      .map((d) => ({ id: d.id, task: d.task, date: d.date })),
    resources: resources ?? STARTER_RESOURCES,
  };

  // Persist starter resources once when older HQ state has none yet.
  if (resources === null && dbEnabled()) {
    await saveGrupviHqState(toDbState(board));
  }

  return board;
}

async function persist(board: Board): Promise<void> {
  if (!dbEnabled()) {
    const lines = [
      "# Grupvi — opgaver",
      "",
      "## Milepæle",
      "",
      ...board.checkpoints.map((c) => `- [${c.done ? "x" : " "}] **${c.id}** ${c.label}`),
      "",
      "## Opgaver",
      "",
      "| ID | Opgave | Rum | Ejer | Deadline | Status |",
      "| --- | --- | --- | --- | --- | --- |",
      ...board.todos.map((t) => `| ${t.id} | ${t.task} |  | ${t.owner} |  | ${t.status} |`),
      "",
      "## Færdig",
      "",
      "| ID | Opgave | Dato |",
      "| --- | --- | --- |",
      ...board.done.map((d) => `| ${d.id} | ${d.task} | ${d.date} |`),
      "",
    ];
    fs.mkdirSync(path.dirname(boardPath()), { recursive: true });
    fs.writeFileSync(boardPath(), lines.join("\n"), "utf8");
    return;
  }
  await saveGrupviHqState(toDbState(board));
}

export async function loadHq(): Promise<Workspace> {
  const board = await currentWorkspace();
  return {
    liveApp: "https://studiechat.vercel.app/app",
    liveLanding: "https://studiechat.vercel.app/",
    exampleProject: "https://studiechat.vercel.app/app/project/liblpm",
    focus: board.focus,
    notes: board.notes,
    checkpoints: board.checkpoints,
    todos: board.todos,
    done: board.done,
    resources: board.resources,
  };
}

export async function setFocus(focus: string): Promise<string> {
  const board = await currentWorkspace();
  board.focus = focus.slice(0, 500);
  await persist(board);
  return board.focus;
}

export async function setNotes(notes: string): Promise<string> {
  const board = await currentWorkspace();
  board.notes = notes.slice(0, 50_000);
  await persist(board);
  return board.notes;
}

export async function setCheckpoint(id: string, done: boolean): Promise<Checkpoint[]> {
  const board = await currentWorkspace();
  board.checkpoints = board.checkpoints.map((c) =>
    c.id === id ? { ...c, done } : c,
  );
  await persist(board);
  return board.checkpoints;
}

export async function setTodoOwner(id: string, owner: string): Promise<BoardTodo[]> {
  const board = await currentWorkspace();
  board.todos = board.todos.map((t) => (t.id === id ? { ...t, owner } : t));
  await persist(board);
  return board.todos;
}

export async function addTodo(input: {
  task: string;
  owner?: string;
}): Promise<BoardTodo> {
  const board = await currentWorkspace();
  const nums = board.todos
    .map((t) => Number(t.id.replace(/^T/i, "")))
    .filter((n) => Number.isFinite(n));
  const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
  const todo: BoardTodo = {
    id: `T${nextNum}`,
    task: input.task.trim(),
    owner: input.owner?.trim() ?? "",
    status: "todo",
  };
  board.todos = [...board.todos, todo];
  await persist(board);
  return todo;
}

export async function completeTodo(
  id: string,
): Promise<{ todos: BoardTodo[]; done: BoardDone[] }> {
  const board = await currentWorkspace();
  const target = board.todos.find((t) => t.id === id);
  if (!target) throw new Error("Opgaven findes ikke");
  const today = new Date().toISOString().slice(0, 10);
  board.todos = board.todos.filter((t) => t.id !== id);
  board.done = [
    { id: target.id, task: target.task, date: today },
    ...board.done.filter((d) => d.id !== id),
  ];
  await persist(board);
  return { todos: board.todos, done: board.done };
}

export async function reopenTodo(id: string): Promise<{ todos: BoardTodo[]; done: BoardDone[] }> {
  const board = await currentWorkspace();
  const target = board.done.find((d) => d.id === id);
  if (!target) throw new Error("Opgaven findes ikke");
  board.done = board.done.filter((d) => d.id !== id);
  board.todos = [
    ...board.todos,
    { id: target.id, task: target.task, owner: "", status: "todo" },
  ];
  await persist(board);
  return { todos: board.todos, done: board.done };
}

export async function deleteTodo(id: string): Promise<BoardTodo[]> {
  const board = await currentWorkspace();
  board.todos = board.todos.filter((t) => t.id !== id);
  await persist(board);
  return board.todos;
}

export async function addResource(input: {
  title: string;
  url: string;
  note?: string;
}): Promise<Resource> {
  const title = input.title.trim().slice(0, 200);
  const url = normalizeUrl(input.url);
  if (!title) throw new Error("Titel mangler");
  if (!url) throw new Error("Link mangler");

  const board = await currentWorkspace();
  const nums = board.resources
    .map((r) => Number(r.id.replace(/^R/i, "")))
    .filter((n) => Number.isFinite(n));
  const nextNum = (nums.length ? Math.max(...nums) : 0) + 1;
  const resource: Resource = {
    id: `R${nextNum}`,
    title,
    url,
    note: (input.note ?? "").trim().slice(0, 300),
  };
  board.resources = [...board.resources, resource];
  await persist(board);
  return resource;
}

export async function deleteResource(id: string): Promise<Resource[]> {
  const board = await currentWorkspace();
  board.resources = board.resources.filter((r) => r.id !== id);
  await persist(board);
  return board.resources;
}
