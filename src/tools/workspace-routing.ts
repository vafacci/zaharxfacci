/**
 * Pick an allowlisted workspace id for developer/file tasks.
 * Never invent paths — only return configured workspace ids.
 */
export function pickDeveloperWorkspaceId(params: {
  projectSlug: string;
  title: string;
  objective: string;
}): string {
  const text = `${params.title}\n${params.objective}`;
  // Only route to toy-counter when explicitly requested — never as a global first match
  // (otherwise words in other projects can steal the workspace).
  if (
    (params.projectSlug === "autiq" || /toy-counter|counter\.js/i.test(text)) &&
    /toy-counter|counter\.js/i.test(text) &&
    !/\bnofacci-web\b/i.test(text) &&
    !/\bdailycap\b/i.test(text) &&
    !/\bgrupvi-app\b/i.test(text) &&
    !/\bdreamit-web\b/i.test(text)
  ) {
    return "toy-counter";
  }

  if (params.projectSlug === "autiq") {
    if (
      /\b(website|web\s*app|next\.?js|component|tsx|autiq-main|autiq-web|landing\s*page|frontend)\b/i.test(
        text,
      )
    ) {
      return "autiq-web";
    }
    return "autiq";
  }

  if (params.projectSlug === "grupvi") {
    if (
      /\b(app|expo|react\s*native|website|studiechat|grupvi-app|component|tsx|src\/)\b/i.test(
        text,
      )
    ) {
      return "grupvi-app";
    }
    return "grupvi";
  }

  if (params.projectSlug === "dreamit") {
    if (
      /\b(website|web\s*app|next\.?js|component|tsx|dreamit-web|landing|frontend|src\/)\b/i.test(
        text,
      )
    ) {
      return "dreamit-web";
    }
    return "dreamit";
  }

  if (params.projectSlug === "nofacci") {
    if (
      /\b(website|web\s*site|hjemmeside|landing|nofacci-web|index\.html|styles\.css|inspiration)\b/i.test(
        text,
      )
    ) {
      return "nofacci-web";
    }
    return "nofacci";
  }
  if (params.projectSlug === "dailycap") return "dailycap";

  return "toy-counter";
}

export function shouldRunWorkspaceTests(workspaceId: string): boolean {
  return (
    workspaceId === "toy-counter" ||
    workspaceId === "autiq" ||
    workspaceId === "autiq-web" ||
    workspaceId === "grupvi" ||
    workspaceId === "grupvi-app" ||
    workspaceId === "dreamit" ||
    workspaceId === "dreamit-web" ||
    workspaceId === "nofacci" ||
    workspaceId === "nofacci-web" ||
    workspaceId === "dailycap"
  );
}
