#!/usr/bin/env bash
# Sets up a Ghostkeys checkout. Safe to re-run: every step checks first and
# only acts when something is missing, so a second run is a health check.
#
#   1. mise is installed (never installed for you)
#   2. mise.toml is trusted
#   3. Tools are installed (Bun, Node, Moth)
#   4. Dependencies are installed
#   5. Git hooks are installed (lefthook)
set -euo pipefail

cd "$(dirname "$0")/.."
export MISE_DISABLE_UPDATE_WARNING=1

if [ -t 1 ]; then
  green=$'\033[32m' cyan=$'\033[36m' red=$'\033[31m' reset=$'\033[0m'
else
  green='' cyan='' red='' reset=''
fi

done_() { printf '  %s✓%s %s\n' "$green" "$reset" "$1"; }
doing() { printf '  %s→%s %s\n' "$cyan" "$reset" "$1"; }
fail() {
  printf '  %s✗%s %s\n' "$red" "$reset" "$1" >&2
  exit 1
}

# 1. mise
if command -v mise >/dev/null 2>&1; then
  done_ "mise is installed"
else
  fail "mise is not installed. Install it from https://mise.jdx.dev/getting-started.html, then re-run this script."
fi

# 2. Trust mise.toml
if mise trust --show 2>/dev/null | grep -q ': trusted'; then
  done_ "mise.toml is trusted"
else
  doing "trusting mise.toml"
  mise trust --quiet
fi

# 3. Tools
if mise ls --current --missing 2>/dev/null | grep -q .; then
  doing "installing tools (mise install)"
  mise install --quiet
else
  done_ "tools are installed (Bun, Node, Moth)"
fi

# 4. Dependencies. A frozen install changes nothing when everything is in
# place, so run it and report whether it had to install anything.
if ! install_log=$(mise exec -- bun install --frozen-lockfile 2>&1); then
  printf '%s\n' "$install_log" >&2
  fail "bun install failed (is bun.lock out of date? run 'bun install' and commit it)"
fi
if printf '%s' "$install_log" | grep -q 'installed'; then
  doing "installed dependencies"
else
  done_ "dependencies are installed"
fi

# 5. Git hooks
hooks_ok=true
for hook in pre-commit; do
  grep -qs lefthook ".git/hooks/$hook" || hooks_ok=false
done
if $hooks_ok; then
  done_ "git hooks are installed"
else
  doing "installing git hooks (lefthook)"
  mise exec -- bunx lefthook install >/dev/null
fi
