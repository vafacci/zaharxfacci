import { dirname } from "path";
import { fileURLToPath } from "url";
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "data/**"],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
