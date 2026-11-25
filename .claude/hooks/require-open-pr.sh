#!/bin/sh
# PreToolUse hook for Bash, set up in .claude/settings.json.
#
# Blocks `gh pr create` (or its alias `gh pr new`) until /open-pr (.claude/skills/open-pr) has
# simplified, reviewed and checked the commit the PR would propose. After its checks pass, /open-pr
# writes that commit's hash to <git dir>/open-pr-reviewed. A later commit no longer matches, so it
# needs another run. Pushes aren't gated: commits pushed to a PR that is already open don't need a
# full rerun.

block() {
  echo "Blocked: $1 Don't open the PR another way: ask the user to run /open-pr." >&2
  exit 2
}

input=$(cat)

# Without jq the command can't be read, so one that may open a PR is blocked rather than let
# through unchecked.
if ! command -v jq >/dev/null 2>&1; then
  if printf '%s' "$input" | grep -Eq 'gh[[:space:]]+pr[[:space:]]+(create|new)'; then
    echo "Blocked: this hook needs jq to check \`gh pr create\`, and jq isn't installed. Ask the user to install it." >&2
    exit 2
  fi
  exit 0
fi

command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')

# Heredoc bodies are left out, so a commit message written with one can mention the command, and
# so is `--help`, which opens nothing.
text=$(printf '%s\n' "$command" | awk '
  delim != "" {
    line = $0
    if (tabs) sub(/^\t+/, "", line)
    if (line == delim) delim = ""
    next
  }
  {
    gsub(/gh[ \t]+pr[ \t]+(create|new)[ \t]+(-h|--help)([ \t;&|)]|$)/, "")
    print
    if (match($0, /(^|[^<])<<-?[ \t]*["\047]?[A-Za-z_][A-Za-z0-9_]*/)) {
      delim = substr($0, RSTART, RLENGTH)
      sub(/^[^<]?<</, "", delim)
      tabs = substr(delim, 1, 1) == "-"
      sub(/^-?[ \t]*["\047]?/, "", delim)
    }
  }')

# Only where gh runs as a command: at a line start or after ; & | ( { or a backtick, maybe behind
# `!`, `if`, `time`, `command`, `env` and the like or VAR=value assignments, and maybe called by its
# path. Text that merely mentions it, like a commit message, passes.
gh='(^|[;&|({`])[[:space:]]*((!|if|then|else|elif|do|while|until|time|command|exec|env|nohup|[[:alpha:]_][[:alnum:]_]*=[^[:space:]]*)[[:space:]]+)*([^[:space:];&|(){}`]*/)?gh[[:space:]]+pr[[:space:]]+(create|new)([[:space:];&|)`]|$)'
lines=$(printf '%s\n' "$text" | grep -E "$gh") || exit 0

# The marker is for the checked-out branch, so a PR for another one can't be checked.
if printf '%s\n' "$lines" | grep -Eq '[[:space:]](--head|-H)([=[:space:]]|$)'; then
  block "/open-pr reviews the checked-out branch, so its PR is opened from it, without --head."
fi

# Check the repo gh runs in: the session's directory, or the one a leading `cd <dir> &&` moves to.
# Either may be a worktree with its own git dir.
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')
if [ -n "$cwd" ]; then
  cd "$cwd" || block "the hook couldn't enter $cwd to check the commit."
fi
dir=$(printf '%s\n' "$command" | sed -nE '1s/^[[:space:]]*cd[[:space:]]+([^[:space:];&|]+)[[:space:]]*&&.*/\1/p' | tr -d "\"'")
case $dir in
  "~") dir=$HOME ;;
  "~/"*) dir=$HOME/${dir#"~/"} ;;
esac
if [ -n "$dir" ]; then
  cd "$dir" 2>/dev/null || block "the hook couldn't enter $dir to check the commit."
fi

head=$(git rev-parse HEAD 2>/dev/null)
marker="$(git rev-parse --git-dir 2>/dev/null)/open-pr-reviewed"
if [ -n "$head" ] && [ "$(cat "$marker" 2>/dev/null)" = "$head" ]; then
  exit 0
fi

block "the current commit hasn't been through /open-pr (simplify, code review, bun run check)."
