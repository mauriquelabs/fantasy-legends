#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push-force

# Install git hooks from scripts/hooks/ into .git/hooks/
HOOKS_SRC="$(cd "$(dirname "$0")/hooks" && pwd)"
HOOKS_DST="$(git rev-parse --git-dir)/hooks"
for hook in "$HOOKS_SRC"/*; do
  name="$(basename "$hook")"
  cp "$hook" "$HOOKS_DST/$name"
  chmod +x "$HOOKS_DST/$name"
done
echo "post-merge: git hooks installed from scripts/hooks/"
