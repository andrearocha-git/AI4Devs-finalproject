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

## `documents/`

Plantillas Handlebars (`bug.md.hbs`, `historia.md.hbs`) del documento Markdown de cada ticket. Las consume `src/services/filesystem/filesystem-manager.ts` (`writeDocument`). Parten de la `plantilla-user-story.md` de la desarrolladora.

- **Encabezado:** tabla con el ticket, tipo, fecha, proyecto, repositorio, rama y PR; el dato que no llega queda en blanco.
- **Fase 1 (`<!-- DEVFLOW:FASE1:INICIO -->` … `<!-- DEVFLOW:FASE1:FIN -->`):** la genera Ollama (o el fallback con el aviso `⚠️ Generado sin Ollama`). Es lo único que se regenera al reprocesar. `bug` lleva «Qué falla» y «Cómo reproducir»; `historia` lleva «User Story».
- **Fase 2:** la completa a mano la desarrolladora (datos del desarrollo, evidencias, observaciones). Es idéntica en las dos plantillas y la IA no la toca.
- Los marcadores de Fase 1 no se pueden quitar ni renombrar: la regeneración los busca para reemplazar solo ese bloque.
- Se renderiza sin escapar HTML (es Markdown). El helper `inc` numera desde 1.
