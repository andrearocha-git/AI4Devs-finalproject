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

## `prompts/`

Prompts y JSON Schemas que consume `src/services/ollama/ollama-ai-transformer.ts` para redactar la Fase 1 con Ollama (`qwen2.5:3b`).

- `comun.system.md` + `bug.system.md` / `historia.system.md`: el prompt de sistema es el común más el del tipo. `ticket.user.md` es el prompt de usuario, con `{{ticketId}}`, `{{title}}` y `{{description}}` (una descripción vacía se manda como «(sin descripción)»).
- `bug.schema.json` / `historia.schema.json`: el JSON Schema del tipo. Es la **fuente de verdad**: se manda a Ollama en `format` y se usa para validar la respuesta con Ajv. Son estrictos (`additionalProperties: false`, todos los campos obligatorios) y el primer campo es siempre `presenteEnTicket`: el modelo clasifica qué datos trae el ticket antes de redactar. Lo que no cumple el schema, o trae un bloque de código, cae al fallback determinista.
- Las reglas del posprocesado determinista viven en `issue-types.json` (`siFalta` y `verificarLiterales`), no aquí; ver más arriba. Las claves de `siFalta` deben coincidir con las de `presenteEnTicket` de cada schema (un test lo comprueba).
- **Al cambiar un prompt o un schema, sube `promptVersion` del tipo en `issue-types.json`** (`bug-v1` → `bug-v2`): se registra en `ticket_logs.prompt_version` para medir la tasa de éxito por versión. Las versiones `v1` actuales todavía no se han usado en ejecuciones registradas.
- Los prompts se afinan con el modelo real; los tests no miden su calidad (usan un Ollama simulado). Tras cambiarlos, prueba contra Ollama con tickets de Jira de verdad: el modelo marca como ausente lo que no entiende, y eso es preferible a que invente.

## `documents/`

Plantillas Handlebars (`bug.md.hbs`, `historia.md.hbs`) del documento Markdown de cada ticket. Las consume `src/services/filesystem/filesystem-manager.ts` (`writeDocument`). Parten de la `plantilla-user-story.md` de la desarrolladora.

- **Encabezado:** tabla con el ticket, tipo, fecha, proyecto, repositorio, rama y PR; el dato que no llega queda en blanco.
- **Fase 1 (`<!-- DEVFLOW:FASE1:INICIO -->` … `<!-- DEVFLOW:FASE1:FIN -->`):** la genera Ollama (o el fallback con el aviso `⚠️ Generado sin Ollama`). Es lo único que se regenera al reprocesar. `bug` lleva «Qué falla» y «Cómo reproducir»; `historia` lleva «User Story».
- **Fase 2:** la completa a mano la desarrolladora (datos del desarrollo, evidencias, observaciones). Es idéntica en las dos plantillas y la IA no la toca.
- Los marcadores de Fase 1 no se pueden quitar ni renombrar: la regeneración los busca para reemplazar solo ese bloque.
- Se renderiza sin escapar HTML (es Markdown). El helper `inc` numera desde 1.
