import { defineConfig } from "vitest/config";

// One test run for the whole monorepo: every workspace is a project.
export default defineConfig({
  test: {
    projects: ["packages/*"],
  },
});
