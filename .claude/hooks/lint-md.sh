#!/usr/bin/env bash
# PostToolUse (Write): valida con markdownlint-cli2 el .md recien creado. Solo reporta, nunca corrige.
f=$(python3 -c 'import sys,json
d=json.load(sys.stdin)
print(d.get("tool_input",{}).get("file_path") or d.get("tool_response",{}).get("filePath") or "")')
case "$f" in *.md) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
command -v markdownlint-cli2 >/dev/null 2>&1 || export PATH="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1):$PATH"
command -v markdownlint-cli2 >/dev/null 2>&1 || exit 0
out=$(markdownlint-cli2 "$f" 2>&1 | grep -E "error MD")
[ -z "$out" ] && exit 0
MSG="$out" python3 -c 'import os,json
m=os.environ["MSG"]
print(json.dumps({"systemMessage":"markdownlint:\n"+m,"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"markdownlint reporta (solo reporte: no usar --fix ni cambiar la estructura del documento sin preguntar):\n"+m}}))'
