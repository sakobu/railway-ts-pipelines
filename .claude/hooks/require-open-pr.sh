#!/bin/sh
# PreToolUse hook for Bash, set up in .claude/settings.json.
#
# Blocks `gh pr create` until /open-pr (.claude/skills/open-pr) has simplified, reviewed and
# checked the commit the PR would propose. After its checks pass, /open-pr writes that commit's
# hash to <git dir>/open-pr-reviewed. A later commit no longer matches, so it needs another run.
# Pushes aren't gated: commits pushed to a PR that is already open don't need a full rerun.

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# Only where gh runs as a command (line start, or after ; & | or a parenthesis), so text that
# merely mentions it, like a commit message, passes.
if ! printf '%s' "$command" | grep -Eq '(^|[;&|(])[[:space:]]*gh[[:space:]]+pr[[:space:]]+create'; then
  exit 0
fi

# Check the repo the command runs in, which may be a worktree with its own git dir.
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
if [ -n "$cwd" ]; then
  cd "$cwd" || exit 2
fi

head=$(git rev-parse HEAD 2>/dev/null)
marker="$(git rev-parse --git-dir 2>/dev/null)/open-pr-reviewed"
if [ -n "$head" ] && [ "$(cat "$marker" 2>/dev/null)" = "$head" ]; then
  exit 0
fi

echo "Blocked: the current commit hasn't been through /open-pr (simplify, code review, bun run check). Don't open the PR another way: ask the user to run /open-pr." >&2
exit 2
