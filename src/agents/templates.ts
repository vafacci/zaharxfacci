export const TEMPLATE_LABELS: Record<string, string> = {
  ceo: "CEO",
  manager: "Manager",
  social: "Social",
  image: "Image",
  developer: "Developer",
  marketing: "Marketing",
  automation: "Automation",
  analytics: "Analytics",
  "security-qa": "Security/QA",
  "ux-design": "UX/UI",
  qa: "QA",
  research: "Research",
  design: "Design",
};

export const SEED_PROJECTS = [
  {
    name: "AUTIQ",
    slug: "autiq",
    mission: "Content and automation business",
    manager: "AUTIQ Manager",
    team: [
      "social",
      "image",
      "developer",
      "marketing",
      "automation",
      "analytics",
      "security-qa",
    ],
  },
  {
    name: "StudieChat / Grupvi",
    slug: "grupvi",
    mission: "Group study/chat application",
    manager: "Grupvi Manager",
    team: ["developer", "ux-design", "qa", "research"],
  },
  {
    name: "DreamIT",
    slug: "dreamit",
    mission:
      "DREAMit — help hobby makers go from hobby to webshop (brand spelling DREAMit in copy)",
    manager: "DreamIT Manager",
    team: ["developer", "design", "marketing", "research", "qa"],
  },
  {
    name: "NOFACCI",
    slug: "nofacci",
    mission:
      "NOFACCI / NOFACCI VISUALS — AI influencer agency; character-first virtual creators",
    manager: "NOFACCI Manager",
    team: ["developer", "social", "image", "marketing", "design", "research", "qa"],
  },
  {
    name: "DailyCap",
    slug: "dailycap",
    mission:
      "DailyCap — personal finance app: how much can I safely spend today?",
    manager: "DailyCap Manager",
    team: ["developer", "ux-design", "marketing", "research", "qa"],
  },
] as const;

export const SEED_TOOLS = [
  { adapterType: "ollama", name: "Ollama", state: "offline" as const },
  { adapterType: "image-studio", name: "AI Image Studio", state: "not_connected" as const },
  { adapterType: "postiz", name: "Postiz", state: "not_connected" as const },
  { adapterType: "n8n", name: "n8n", state: "not_connected" as const },
  { adapterType: "opencode", name: "OpenCode", state: "not_connected" as const },
  { adapterType: "rea", name: "REA", state: "research_only" as const },
  { adapterType: "local-artifact", name: "Local Artifact Writer", state: "online" as const },
];
