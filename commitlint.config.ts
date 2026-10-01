import { RuleConfigSeverity, type UserConfig } from "@commitlint/types";

// Conventional Commits on a single line: the subject is the ticket title in
// lowercase, with no body and no footer.
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-empty": [RuleConfigSeverity.Error, "always"],
    "footer-empty": [RuleConfigSeverity.Error, "always"],
  },
};

export default config;
