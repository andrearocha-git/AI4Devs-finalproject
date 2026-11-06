# Change: TK-02h — Orquestador: reutilizar y reprocesar la Fase 1

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02h)
- **Depende de:** TK-02f (el flujo `startTicket`, que ya genera la Fase 1 y guarda `fase1.json`); usa `FileSystemManager.readFase1` y `writeDocument({ regenerateFase1Only })` de TK-02d y `OllamaAITransformer` de TK-02e.
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre I: el contrato se escribió con la PR de TK-02f aún en revisión; si Cursor pide cambios en `start-ticket.ts`, este contrato puede necesitar un ajuste menor.

## Propósito

Hace que la Fase 1 que redacta Ollama se genere **una vez por ticket**: si el mismo ticket se inicia con otro repositorio, se reutiliza sin volver a llamar al modelo; y se puede **reprocesar** (`reprocessFase1`) sin tocar lo que la desarrolladora ya completó a mano. Además, si una ejecución anterior quedó sin redactar, la siguiente reintenta sola y reemplaza solo el bloque de Fase 1 del documento. Ahorra los 15 a 60 s de Ollama en cada repositorio adicional y evita perder trabajo manual.

## Criterios de aceptación de origen

Del criterio técnico único del ticket (CA5 original, parte de la Fase 1, y H-02), numerados:

- CA1: `reprocessFase1: true` con una Fase 1 válida previa → invoca a Ollama, sobrescribe `fase1.json` y regenera solo el bloque de Fase 1 del documento del repositorio elegido (sin tocar la Fase 2 ni los documentos de otros repositorios).
- CA2: si el reproceso cae en fallback, conserva la Fase 1 válida anterior.
- CA3: sin el flag y con una Fase 1 previa en fallback (`generatedByOllama: false`) reintenta con Ollama automáticamente.
- CA4: segunda ejecución del ticket con otro repositorio → `ollamaStatus: 'reused'` sin invocar a Ollama, con su carpeta y su documento propios y el documento del primero sin cambios.
- DoD-a: la `prompt_version` registrada es la de la Fase 1 que se usó (la nueva o la reutilizada).
- DoD-b: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

Criterios de la historia relacionada que este ticket cierra en el servicio: **US-03 CA6** (segundo repositorio con Fase 1 reutilizada) y **US-03 CA9** (reprocesar solo la parte redactada, conservando lo completado a mano, y conservar el análisis válido anterior si el nuevo intento falla). La opción `--reprocesar` de la línea de comandos es de TK-03b.

## Escenarios BDD

### E1 — Reutilizar la Fase 1 al iniciar el ticket con otro repositorio (cubre: CA4, DoD-a)

- **Given** un ticket ya iniciado con el repositorio A (con su `fase1.json` válido, generado por Ollama, y su documento con la Fase 2 ya completada a mano), un segundo repositorio B de la misma clave, y un Ollama simulado que registra cada llamada
- **When** se ejecuta `startTicket` con el repositorio B, y también otra vez con el repositorio A sin `reprocessFase1`
- **Then** con el repositorio B **no invoca a Ollama**, crea su carpeta y su documento propios con la misma Fase 1 que guardó `fase1.json`, devuelve `ollamaStatus: 'reused'` con la `promptVersion` de esa Fase 1, deja el documento de A **byte a byte igual** y `fase1.json` sin cambios, emite `ollama` como `started` y `ok` con el detalle «Fase 1 reutilizada», y registra una fila propia para B con `ollama_status = 'reused'` y la `prompt_version` de la Fase 1 reutilizada; con el repositorio A de nuevo reutiliza igual y deja su documento intacto (con la Fase 2 completada a mano); la rama, la confirmación y el resto del flujo no cambian

### E2 — Reprocesar la Fase 1 conservando lo completado a mano (cubre: CA1, CA2, DoD-a)

- **Given** un ticket con `fase1.json` válido y un documento cuya Fase 2 la desarrolladora ya completó, otro repositorio del mismo ticket con su propio documento, y un Ollama simulado que responde bien, cae a fallback o no se necesita
- **When** se ejecuta `startTicket` con `reprocessFase1: true` sobre ese repositorio (con Ollama bien, con Ollama en fallback, y con un ticket que aún no tiene Fase 1 guardada)
- **Then** con Ollama bien invoca al modelo aunque exista una Fase 1, **sobrescribe `fase1.json`** con la nueva y regenera **solo el bloque de Fase 1** del documento del repositorio elegido, dejando byte a byte igual la Fase 2, el encabezado y los documentos de los otros repositorios, con `ollamaStatus: 'ok'` y la `prompt_version` de la nueva Fase 1; con Ollama en fallback **conserva la Fase 1 válida anterior** (`fase1.json` y el documento intactos), devuelve `ollamaStatus: 'fallback_deterministic'` con la `promptVersion` de la Fase 1 conservada y emite `ollama:fallback` con el detalle de que se conserva la anterior; sin ninguna Fase 1 previa el reproceso se comporta como la primera generación; si el documento existente ha perdido los marcadores de Fase 1 y no se puede regenerar, devuelve `blocked` y **deja `fase1.json` como estaba** (el documento se escribe antes de guardar la Fase 1 nueva)

### E3 — Reintento automático si la Fase 1 anterior quedó sin redactar (cubre: CA3)

- **Given** un ticket cuya ejecución anterior cayó a fallback (documento con `⚠️ Generado sin Ollama` y sin `fase1.json`), o con un `fase1.json` guardado con `generatedByOllama: false`, o con un `fase1.json` ilegible, y su Fase 2 completada a mano
- **When** se ejecuta `startTicket` de nuevo, **sin** `reprocessFase1`, con Ollama bien y con Ollama otra vez en fallback
- **Then** no reutiliza esa Fase 1 y **reintenta con Ollama automáticamente**; si ahora responde bien guarda `fase1.json` (sobrescribiendo el inválido), reemplaza **solo el bloque de Fase 1** del documento existente (el aviso `⚠️ Generado sin Ollama` desaparece) y deja la Fase 2 intacta, con `ollamaStatus: 'ok'`; si vuelve a caer a fallback deja el documento y `fase1.json` como estaban, con `ollamaStatus: 'fallback_deterministic'`; un `fase1.json` ilegible se trata como ausente y no corta el flujo

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA4, DoD-a | `tests/unit/services/orchestrator/ticket-orchestrator.fase1.test.ts` › «E1 — reutilizar la Fase 1» (5 casos: segundo repositorio sin invocar a Ollama con el documento de A y `fase1.json` intactos, fila propia con `reused` y la `prompt_version` reutilizada, eventos `started` y `ok` con «Fase 1 reutilizada», el mismo repositorio sin pisar lo completado a mano, y rama y confirmación sin cambios) | Hecho |
| E2 | CA1, CA2, DoD-a | `tests/unit/services/orchestrator/ticket-orchestrator.fase1.test.ts` › «E2 — reprocesar la Fase 1» (6 casos: Ollama bien con solo el bloque de Fase 1 regenerado y lo demás byte a byte igual, Ollama en fallback que conserva la anterior, repositorio sin documento, sin Fase 1 previa con Ollama bien y en fallback, y documento sin marcadores con `fase1.json` intacto) | Hecho |
| E3 | CA3 | `tests/unit/services/orchestrator/ticket-orchestrator.fase1.test.ts` › «E3 — reintento automático si la Fase 1 anterior quedó sin redactar» (7 casos: reintento tras un fallback que reemplaza solo el bloque de Fase 1 y quita el aviso, nuevo fallback que deja todo como estaba, `fase1.json` con `generatedByOllama: false` que se sobrescribe o se deja, `fase1.json` ilegible o con otra forma tratado como ausente, y una Fase 1 válida que no se reintenta) | Hecho |

DoD-b (revisión mergeada) no es un escenario: se tilda tras la merge. La tarea 4 amplía `tests/integration/ticket-flow.e2e.test.ts` con el segundo repositorio y el reproceso sobre Git real.

## Prerrequisitos

- Ninguna dependencia nueva ni cambios en `package.json` ni en `templates/`.
- Verificado en `src/`: `FileSystemManager.readFase1` (devuelve `Ok(null)` sin archivo y `ErrorBloqueante('ErrorInesperado')` si el JSON está corrupto o no tiene la forma), `saveFase1` y `writeDocument` con `regenerateFase1Only`; `StartTicketInput.reprocessFase1` ya existe (sin efecto en TK-02f). El flujo actual (`start-ticket.ts`) genera siempre con Ollama y llama a `writeDocument` con `regenerateFase1Only: false`.
- La rama sale de `feature/TK-02f` porque depende de su código; su PR sigue en revisión.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/orchestrator/start-ticket.ts` | Modificar (existente): lee `fase1.json`, decide reutilizar, reintentar o reprocesar, y escribe el documento antes de guardar la Fase 1 nueva; el contexto incluye `readFase1` |
| `tests/unit/services/orchestrator/ticket-orchestrator.fase1.test.ts` | Crear (propuesta): E1, E2 y E3 con SQLite en memoria y carpetas temporales reales (un setup propio, parecido al de `ticket-orchestrator.start.test.ts`) |
| `tests/unit/services/orchestrator/ticket-orchestrator.start.test.ts` | Modificar (existente, **requiere tu autorización**): añadir `readFase1: async () => ok(null)` a los tres dobles del gestor de archivos (decisión 8) |
| `tests/integration/ticket-flow.e2e.test.ts` | Modificar (existente): añadir el segundo repositorio y el reproceso con Git real (casos nuevos, sin cambiar los actuales) |

## Tareas

- [x] 1. RED/GREEN E1: leer `fase1.json` y reutilizarla con otro repositorio (o el mismo), con `ollama_status = 'reused'`
- [x] 2. RED/GREEN E2: `reprocessFase1` (regenerar solo el bloque de Fase 1, conservar la anterior si cae en fallback, y documento antes que `fase1.json`)
- [x] 3. RED/GREEN E3: reintento automático ante una Fase 1 en fallback, ausente o ilegible, reemplazando solo el bloque de Fase 1
- [x] 4. Ampliar la prueba de integración con Git real (segundo repositorio y reproceso), refactor, TSDoc, `npm run typecheck`, `npm run lint` y `npm test`; probar a mano con Ollama real un segundo repositorio y un reproceso

## Decisiones y desvíos

*Registro de la implementación (2026-11-06) y puntos aprobados con el contrato:*

- **E1, autorizado por la desarrolladora (decisión 8):** el contexto del flujo incluye ahora `readFase1`, y los tres dobles del gestor de archivos de `ticket-orchestrator.start.test.ts` (TK-02f) ganaron `readFase1: async () => ok(null)`, una línea en cada uno.
- **E1:** el flujo lee `fase1.json` con `readFase1` y solo reutiliza una Fase 1 `generatedByOllama: true`; sin `reprocessFase1` la reutiliza y no invoca a Ollama. El caso «rama y confirmación sin cambios» ya pasaba antes de implementar (cobertura de que no se rompe nada). El orden de escritura (documento antes que `fase1.json`) y el reproceso llegan en E2.

- **E2:** una Fase 1 recién generada ahora se escribe con `regenerateFase1Only: true` (reemplaza solo el bloque de Fase 1 si el documento existe y lo crea completo si no), y `fase1.json` se guarda **después** del documento. Si el reproceso cae en fallback con una Fase 1 anterior válida, el flujo la conserva: `ollamaStatus: 'fallback_deterministic'`, la `promptVersion` de la conservada y el evento `ollama:fallback` con «se conserva la Fase 1 anterior» (decisión 1). Tres de los seis casos (repositorio sin documento y sin Fase 1 previa, con Ollama bien y en fallback) ya pasaban antes de implementar y quedan como cobertura; los otros tres fallaron en rojo.
- **E2, mutaciones temporales (revertidas):** que el bloque nunca se regenere rompe 2 tests, y guardar `fase1.json` antes del documento rompe 1.

- **E3, sin código nuevo:** los 7 casos pasaron en cuanto se escribieron, porque la implementación de E2 ya cubre el reintento: una Fase 1 recién generada reemplaza el bloque de Fase 1 del documento si existe (y lo crea si no), y solo se reutiliza una Fase 1 con `generatedByOllama: true`; un `fase1.json` que `readFase1` no puede leer cuenta como ausente. Un primer intento de los casos del `fase1.json` corrupto falló por un error del propio test (escribía en `.devflow` antes de que la carpeta existiera), corregido en el test.
- **E3, mutaciones temporales (revertidas):** reutilizar también una Fase 1 con `generatedByOllama: false` rompe 2 tests, y que un `fase1.json` ilegible corte el flujo rompe otros 2.

- **Tarea 4, prueba de integración (`tests/integration/ticket-flow.e2e.test.ts`, 4 casos nuevos, 11 en total):** con Git, carpetas y SQLite reales y Jira y Ollama simulados con msw (que ahora cuenta las llamadas al modelo): segundo repositorio con la Fase 1 reutilizada (Ollama se llama una sola vez, rama real en el segundo repositorio, documento del primero intacto), reproceso que regenera solo el bloque de Fase 1 conservando la Fase 2 a mano, reproceso con Ollama caído que conserva la anterior, y reintento automático tras una ejecución sin Ollama. Pasaron a la primera; dos mutaciones temporales (no regenerar nunca y reutilizar aunque se pida reprocesar) rompen 2 tests cada una.
- **Tarea 4, prueba real (2026-11-06, WSL):** con el Jira de pruebas (solo lectura), Ollama `qwen2.5:3b` real y **dos repositorios temporales con su propio `origin` local** (ninguno de la desarrolladora; carpeta borrada al terminar); «Ollama caído» se simuló apuntando `ollamaHost` a un puerto cerrado.
  - `SCRUM-2` con el repositorio `api`: 61 s con Ollama real, `ollama = ok`.
  - `SCRUM-2` con `web`: **1,3 s, `ollama = reused`**, sin llamar al modelo; el documento de `web` tiene la misma Fase 1, el de `api` y `fase1.json` quedan intactos y la rama real se crea en `web`.
  - Reprocesar `SCRUM-2` en `api` (Ollama real, 30 s): Fase 2 escrita a mano **conservada** y todo lo que está fuera del bloque de Fase 1 idéntico.
  - Reprocesar con Ollama caído (1 s): `fallback_deterministic`, evento «se conserva la Fase 1 anterior», documento y `fase1.json` **intactos**.
  - `SCRUM-3` con Ollama caído: documento con el aviso, sin `fase1.json`; después, con Ollama y **sin el flag**, reintenta sola (29 s), el aviso desaparece, la Fase 2 a mano se conserva y se guarda `fase1.json`.
- **Cierre de la tarea 4:** el paso 7 de `runStartTicket` quedó en una función propia (`resolveFase1`) con un resultado explícito (`Fase1Outcome`), para que el flujo principal se lea de corrido. `typecheck` y `lint` limpios; 580 tests en verde (22 de este ticket: 18 unitarios y 4 de integración).

Puntos **(ambiguos o asumidos)** aprobados con el contrato:

1. *(ambiguo)* **Qué se registra cuando el reproceso falla.** El criterio dice que se conserva la Fase 1 anterior, pero no cómo queda la fila de `ticket_logs`. Se propone `ollama_status = 'fallback_deterministic'` (lo que pasó en esta ejecución) con la `prompt_version` de la Fase 1 conservada (la que sigue en el documento). Alternativa: `'reused'`, que describiría el documento pero ocultaría que el intento falló.
2. *(asumido)* **Un reintento exitoso reemplaza el bloque de Fase 1 del documento existente.** El criterio dice «reintenta con Ollama automáticamente» pero no qué pasa con el documento, que tras un fallback quedó con el texto sin redactar. Sin tocarlo, la nueva Fase 1 se guardaría en `fase1.json` pero el documento seguiría con el aviso. Se propone usar `writeDocument({ regenerateFase1Only: true })`, que conserva el encabezado y la Fase 2. Con un documento que no existe, esa llamada lo crea completo, así que también sirve para el primer repositorio y para el segundo sin Fase 1 previa.
3. *(asumido)* **Reutilizar no toca un documento ya existente.** Al repetir el ticket con el mismo repositorio sin el flag, la Fase 1 se reutiliza y `writeDocument` (sin regenerar) es idempotente: no pisa lo completado a mano.
4. *(asumido)* **Orden de escritura.** Para que un fallo al escribir el documento no destruya la Fase 1 anterior, el documento se escribe **antes** de guardar la `fase1.json` nueva. Si guardar `fase1.json` falla después, el flujo sigue (como en TK-02f). Esto cambia el orden actual de `start-ticket.ts` (hoy guarda primero), sin que lo vea ningún test aprobado.
5. *(asumido)* **`fase1.json` ilegible o con otra forma** (`readFase1` devuelve `ErrorBloqueante`) se trata como ausente: se regenera y se sobrescribe al tener éxito. No bloquea el flujo ni se muestra al usuario.
6. *(asumido)* **Reproceso sin Fase 1 previa:** se comporta como la primera generación (con Ollama bien guarda y escribe; con fallback escribe el texto sin redactar).
7. *(asumido)* **`onStep` al reutilizar:** `ollama:started` y luego `ollama:ok` con el detalle «Fase 1 reutilizada»; sin llamar a Ollama no hay `onToken` ni espera.
8. *(ambiguo)* **Los tres dobles del gestor de archivos de TK-02f.** El contexto del flujo pasa a incluir `readFase1`, así que los tres dobles de `ticket-orchestrator.start.test.ts` (el del fallo de carpeta, el del fallo de documento y el de la revisión de Cursor) necesitan `readFase1: async () => ok(null)` para seguir tipando. Es una línea por doble en un test ya aprobado: necesita tu autorización. Alternativa: marcar `readFase1` como opcional en el contexto, a costa de un `?.` que oculta un fallo de cableado.
9. *(asumido)* **Un documento sin los marcadores de Fase 1** (por ejemplo, editado a mano) no se puede regenerar: `writeDocument` devuelve `ErrorInesperado`, el flujo termina como `blocked` igual que otros fallos de documento y la `fase1.json` anterior queda como estaba (decisión 4). Hereda la limitación de TK-02d anotada como decisión diferida.
