import type { NextConfig } from "next";

const watchIgnored = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.next/**",
  "**/data/**",
  "**/prisma/*.db",
  "**/prisma/*.db-*",
  "**/prisma/*.db-journal",
  "**/prisma/*.db-wal",
  "**/prisma/*.db-shm",
  "**/*.db",
  "**/*.db-*",
  "**/*.db-journal",
  "**/*.db-wal",
  "**/*.db-shm",
  "**/workspaces/**/.opencode-facci/**",
  "**/workspaces/**/node_modules/**",
];

const nextConfig: NextConfig = {
  // Avoid reload loops when SQLite / artifacts / rollbacks change on disk.
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: watchIgnored,
    };
    return config;
  },
  // Next 16 defaults to Turbopack; keep ignore list if someone runs without --webpack.
  turbopack: {},
};

export default nextConfig;
