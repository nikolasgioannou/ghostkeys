import type { Config } from "prettier";

const config: Config = {
  // Keeps every package.json in a standard key order (via sort-package-json).
  plugins: ["prettier-plugin-packagejson"],
};

export default config;
