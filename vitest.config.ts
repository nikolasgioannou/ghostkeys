import { defineConfig } from "vitest/config";

// One test run for the whole monorepo: every workspace is a project.
// (scripts/ also holds plain files such as setup.sh, which aren't projects.)
export default defineConfig({
  test: {
    projects: ["packages/*", "scripts/*", "!scripts/*.*"],
  },
});
