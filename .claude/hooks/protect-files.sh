#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit|NotebookEdit): block direct edits to secrets and the lockfile.
# .env.example / .env.sample stay editable so variable names (VITE_CONTACT_ENDPOINT…) can be documented.
f=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')
name=$(basename -- "$f")
case "$name" in
  .env.example|.env.sample) exit 0 ;;
  .env|.env.*)
    echo "Blocked: $name holds local settings and secrets. Edit it yourself, not through Claude." >&2
    exit 2 ;;
  package-lock.json)
    echo "Blocked: package-lock.json must only change via npm install/uninstall, never by hand." >&2
    exit 2 ;;
esac
exit 0
