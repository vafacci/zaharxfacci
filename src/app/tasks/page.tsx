import { Suspense } from "react";
import { TasksView } from "@/components/facci/TasksView";

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[50vh] flex items-center justify-center text-[var(--text-muted)]">
          Indlæser opgaver…
        </main>
      }
    >
      <TasksView />
    </Suspense>
  );
}
