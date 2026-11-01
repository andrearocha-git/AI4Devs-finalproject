#!/usr/bin/env bash
# PostToolUse (Write|Edit): valida con markdownlint-cli2 el .md recien escrito o editado.
# Solo reporta errores en lineas con cambios sin commitear (diff contra HEAD); un archivo
# nuevo sin trackear se valida completo, y uno sin cambios pendientes se ignora. Nunca corrige.
f=$(python3 -c 'import sys,json
d=json.load(sys.stdin)
print(d.get("tool_input",{}).get("file_path") or d.get("tool_response",{}).get("filePath") or "")')
case "$f" in *.md) ;; *) exit 0 ;; esac
[ -f "$f" ] || exit 0
command -v markdownlint-cli2 >/dev/null 2>&1 || export PATH="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1):$PATH"
command -v markdownlint-cli2 >/dev/null 2>&1 || exit 0
raw=$(markdownlint-cli2 "$f" 2>&1 | grep -E "error MD")
[ -z "$raw" ] && exit 0

dir=$(dirname "$f")
# Lineas cambiadas: "ALL" si el archivo es nuevo/sin trackear o no esta en un repo git; vacio si no hay cambios.
changed=$(RAW_FILE="$f" RAW_DIR="$dir" python3 - <<'PY'
import os, re, subprocess
f, d = os.environ["RAW_FILE"], os.environ["RAW_DIR"]
def git(*a):
    return subprocess.run(["git", "-C", d, *a], capture_output=True, text=True)
if git("rev-parse", "--is-inside-work-tree").returncode != 0:
    print("ALL"); raise SystemExit
if git("ls-files", "--error-unmatch", f).returncode != 0:
    print("ALL"); raise SystemExit
lines = set()
for m in re.finditer(r"^@@ -\S+ \+(\d+)(?:,(\d+))? @@", git("diff", "-U0", "HEAD", "--", f).stdout, re.M):
    start, n = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
    lines.update(range(start, start + max(n, 1)))
print(" ".join(map(str, sorted(lines))))
PY
)
[ -z "$changed" ] && exit 0

if [ "$changed" = "ALL" ]; then
  out="$raw"
else
  out=$(CH="$changed" RAW="$raw" python3 -c 'import os,re
ch=set(os.environ["CH"].split())
for l in os.environ["RAW"].splitlines():
    m=re.match(r"^.*?:(\d+)(?::\d+)? ",l)
    if m and m.group(1) in ch: print(l)')
fi
[ -z "$out" ] && exit 0
MSG="$out" python3 -c 'import os,json
m=os.environ["MSG"]
print(json.dumps({"systemMessage":"markdownlint:\n"+m,"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"markdownlint reporta (solo reporte: no usar --fix ni cambiar la estructura del documento sin preguntar):\n"+m}}))'
