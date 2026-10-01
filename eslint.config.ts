import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["**/node_modules/", ".moth/"] },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  // Invariant 6: the engine is framework-free and runs in the browser and on
  // the server. It never imports UI, framework or database code, never reads
  // the environment (its config is passed in), and never touches browser
  // globals (DOM types are there only for fetch and AbortSignal).
  {
    files: ["packages/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "The engine is framework-free (invariant 6).",
            },
            {
              name: "react-dom",
              message: "The engine is framework-free (invariant 6).",
            },
            {
              name: "drizzle-orm",
              message: "The engine never touches the database (invariant 6).",
            },
            {
              name: "bun:sqlite",
              message: "The engine never touches the database (invariant 6).",
            },
            {
              name: "@ghostkeys/db",
              message: "The engine never touches the database (invariant 6).",
            },
          ],
          patterns: [
            {
              group: ["@tanstack/*"],
              message: "The engine is framework-free (invariant 6).",
            },
            {
              group: ["@base-ui/*"],
              message: "The engine is framework-free (invariant 6).",
            },
            {
              group: ["drizzle-orm/*"],
              message: "The engine never touches the database (invariant 6).",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "The engine receives its config; it never reads the environment.",
        },
      ],
      "no-restricted-globals": [
        "error",
        ...[
          "window",
          "document",
          "navigator",
          "localStorage",
          "AudioContext",
        ].map((name) => ({
          name,
          message:
            "The engine runs on the server too; browser globals belong in the web app.",
        })),
      ],
    },
  },

  prettier,
);
