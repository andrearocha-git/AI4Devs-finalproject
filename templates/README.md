# Plantillas versionadas

Archivos versionados con el código (no son configuración del usuario). Los consumen los módulos de `src/services/`.

## `issue-types.json`

Mapeo del tipo de issue de Jira al tratamiento que recibe. Lo lee `src/services/orchestrator/issue-type-resolver.ts`.

- `blockedTypes`: tipos sin plantilla (épicas). Cortan el flujo con `ErrorBloqueante('TipoIssueBloqueado')`, sin rama, carpeta ni documento.
- `types.bug.names`: nombres de Jira que se tratan como bug (`Bug`, `Error`, `Defecto`).
- `types.historia`: tipo por defecto (`default: true`); recibe cualquier nombre que no sea bloqueado ni bug.
- `branchType`: `feature` o `bugfix`. El texto del prefijo (`features/`, `bugs/`) no está aquí: lo arma el Orquestador con `branchPrefixFeature` / `branchPrefixBugfix` de `app_config`.
- `promptVersion`: versión del prompt y schema del tipo; se registra en `ticket_logs.prompt_version`. Súbela al cambiar un prompt o un schema.

La comparación de nombres ignora mayúsculas, acentos y espacios sobrantes.
