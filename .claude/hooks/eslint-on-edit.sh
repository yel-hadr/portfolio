#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit): lint the edited .js/.jsx file.
# Exit 2 feeds ESLint errors back to Claude so the edit gets fixed; warnings are ignored.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$f" in
  *.js|*.jsx) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
out=$(npx --no-install eslint --quiet --no-warn-ignored "$f" 2>&1)
status=$?
if [ "$status" -eq 1 ]; then
  printf 'ESLint errors in %s — fix before continuing:\n%s\n' "$f" "$out" >&2
  exit 2
fi
# Exit 2+ from ESLint means a config/crash problem: report it without blocking.
[ "$status" -ne 0 ] && printf 'ESLint could not run on %s:\n%s\n' "$f" "$out" >&2
exit 0
