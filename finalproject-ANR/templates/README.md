# Plantillas y prompts de DevFlow CLI

Contenido que usa el Ollama AI Transformer y el FileSystem Manager para generar el documento de un ticket. Es contenido de la aplicación, no configuración del usuario: se versiona con el código y es igual para todo el equipo.

## Flujo

1. El tipo de issue de Jira (`fields.issuetype.name`) se mapea a una plantilla con `issue-types.json` → `tiposJira`. Si no está mapeado, se usa `porDefecto`. Si está en `tiposBloqueados` (épicas), el flujo termina mostrando su `mensaje`: no se crean rama ni documento.
2. El prompt de sistema se arma concatenando los archivos de `systemPrompt` (reglas comunes + reglas del tipo). El prompt de usuario es `ticket.user.md`, renderizado con Handlebars.
3. Se llama a Ollama pasando el `schema` del tipo en el parámetro `format`. La respuesta se valida contra el mismo schema; si no valida o contiene un bloque de código → `FallbackDeterminista`.
4. **Posprocesado determinista** (en código, con reglas de `issue-types.json`):
   - `siFalta`: si el modelo marcó un dato como ausente en `presenteEnTicket`, se sobrescribe el `campo` con `valor` y se añade la `pregunta` a `preguntasAbiertas`.
   - `verificarLiterales`: si en esos campos aparece un número o un texto entre comillas que no está en el título/descripción del ticket, se descarta el campo (se trata como ausente).
5. El documento se renderiza con la plantilla `documento` (Handlebars con `noEscape: true`), en modo normal (`fase1` = respuesta posprocesada) o fallback (`fallback: true` + `descripcionOriginal`).

## Variables de las plantillas de documento

`ticketId`, `titulo`, `tipoJira`, `repo` y `rama` (un documento por ticket y repositorio; vacíos si la clave no tiene repositorios), `urlJira`, `fecha`, `modelo`, `promptVersion`, `fallback`, `motivoFallback`, `descripcionOriginal`, `adjuntosDir`, `fase1`.

## Reglas al editar

- La Fase 1 va entre `<!-- DEVFLOW:FASE1:INICIO -->` y `<!-- DEVFLOW:FASE1:FIN -->`: al reprocesar un ticket solo se regenera ese bloque y la Fase 2 del desarrollador se preserva. No cambiar los marcadores.
- Al cambiar un prompt o un schema, subir `promptVersion` del tipo en `issue-types.json` (se registra en `ticket_logs`).
- El orden de los campos en el schema importa: `presenteEnTicket` va primero para que el modelo clasifique antes de redactar.
- Probar contra los tickets de `tests/fixtures/tickets/` (completos y escuetos de cada tipo) antes de dar por bueno un cambio.
