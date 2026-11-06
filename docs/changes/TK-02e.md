# Change: TK-02e — Ollama AI Transformer (prompts, schemas y posprocesado)

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02e)
- **Depende de:** TK-02a (hecho). Entrega a `DocumentoFase1` (TK-02d) su campo `presenteEnTicket`.
- **INVEST:** Observaciones: S. Un solo criterio técnico (CA2) pero con tres módulos (cliente HTTP con streaming, posprocesado y plantillas de prompts y schemas) y varias decisiones abiertas; cabe en 3 escenarios y 4 tareas. Si crece al implementar, separar `postprocess.ts` del transformer.

## Propósito

Convierte el texto de un ticket (`ContextoTicket`) en la Fase 1 estructurada del documento llamando a Ollama local (`qwen2.5:3b`) con el JSON Schema del tipo de issue, validando la respuesta con Ajv y corrigiendo de forma determinista lo que el modelo pudo inventar. Cualquier fallo (Ollama caído, timeout, JSON inválido o código embebido) devuelve `FallbackDeterminista` con el texto crudo, y nunca bloquea el flujo ni deja código fuente en el documento (ADR-003.1).

## Criterios de aceptación de origen

- CA1 (CA2 original, caso feliz): JSON válido contra el schema del tipo → `Ok(DocumentoFase1)`.
- CA2 (CA2 original, sin código): JSON con un bloque de código Markdown embebido → `FallbackDeterminista` (Non-Goal «cero código generado» del PRD).
- CA3 (CA2 original, tiempo): sin respuesta dentro de `ollama_timeout_seconds` → `FallbackDeterminista`.
- CA4 (CA2 original, posprocesado): `siFalta` sobrescribe con «No especificado en el ticket.» los campos que `presenteEnTicket` marca como ausentes y añade la pregunta abierta; en bugs, `verificarLiterales` descarta los literales ausentes del ticket (verificable con los fixtures escuetos de TK-02a).
- Contrato de la descripción: streaming y `onToken`; JSON Schema en `format`; modelo, timeout (120 s) y `keep_alive` por constructor; todo respuesta inválida, no disponible o con código cae a `FallbackDeterminista`.
- DoD-a: al cambiar un prompt o un schema se sube `promptVersion` del tipo en `templates/issue-types.json` *(es una regla de proceso, no un escenario; ver decisión 3)*.
- DoD-b: al menos un test para `Ok` y para `FallbackDeterminista` *(lo cubren E1 y E2)*.
- DoD-c: revisión de código aprobada y mergeada (se tilda tras la merge; no es un escenario).

Criterios de la historia relacionada (US-03) que este ticket cubre: CA1 (la parte de redacción de la Fase 1) y CA4 (Ollama caído → documento con el texto original sin redactar). La orquestación y el registro quedan en TK-02f.

## Escenarios BDD

### E1 — Respuesta válida de Ollama: petición, streaming y `DocumentoFase1` (cubre: CA1, contrato de la descripción, DoD-b)

- **Given** un Ollama simulado con msw que responde en streaming (JSON por líneas) con un JSON válido contra el schema de cada tipo, un `ContextoTicket` de bug y otro de historia, y los archivos de `templates/prompts/`
- **When** se ejecuta `processContext(ctx, tipo, onToken)` con `tipo` `bug` e `historia`
- **Then** hace una sola petición `POST {host}/api/generate` con el `model` y el `keep_alive` del constructor, `stream: true`, el JSON Schema del tipo en `format` (cuyo primer campo es `presenteEnTicket`), un `system` armado con el prompt común y el del tipo, y un `prompt` con el ID, el título y la descripción del ticket; invoca `onToken` con el total de caracteres recibidos hasta el momento (creciente) mientras llega la respuesta; devuelve `Ok` con el `DocumentoFase1` validado (incluido `presenteEnTicket`) más `generatedByOllama: true` y el `promptVersion` del tipo (`bug-v1` / `historia-v1`); la forma devuelta es la que renderizan las plantillas de TK-02d

### E2 — Cualquier fallo cae a `FallbackDeterminista` sin lanzar excepción (cubre: CA2, CA3, contrato de la descripción, DoD-b)

- **Given** un Ollama simulado que responde: un JSON bien formado que no cumple el schema (falta un campo, tipo equivocado o campo extra), un JSON válido con un bloque de código con triple acento grave en un campo de texto, en un elemento de una lista y en un escenario, un JSON mal formado, una respuesta vacía, un error en mitad del streaming, un HTTP 404 (modelo no instalado) y un 500, una conexión rechazada, y una respuesta que tarda más que el timeout del constructor
- **When** se ejecuta `processContext(ctx, tipo)` en cada caso
- **Then** devuelve siempre `FallbackDeterminista` con `rawText` igual al título y la descripción originales del ticket (sin redactar), nunca lanza, y respeta el timeout total configurado (la petición se aborta al vencer); una respuesta válida con inline code de un solo acento grave **no** cae a fallback *(ver decisión 8)*

### E3 — Posprocesado determinista: `siFalta` y `verificarLiterales` (cubre: CA4)

- **Given** respuestas válidas del modelo para los fixtures escuetos de TK-02a (`bug-escueto`, `historia-escueta`) y para los completos (`bug-completo`, `historia-completa`), con campos marcados como ausentes en `presenteEnTicket` y con números o textos entre comillas que no están en el ticket
- **When** se ejecuta el posprocesado (directamente con `postprocess.ts` y a través de `processContext`)
- **Then** cada campo marcado como ausente queda con «No especificado en el ticket.» y se añade a `preguntasAbiertas` la pregunta de ese campo, una sola vez aunque se repita; en un bug, los literales (números y textos entre comillas) que no aparecen en el título ni en la descripción hacen descartar el elemento o el campo que los contiene, según la decisión 2, y los que sí aparecen se conservan; un ticket completo con todo presente no cambia nada; el resultado vuelve a cumplir el schema y no se modifica el objeto de entrada

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1, contrato, DoD-b | `tests/unit/services/ollama/ollama-ai-transformer.test.ts` › «E1 — respuesta válida de Ollama» (11 casos: `Ok` de bug e historia con su `promptVersion`, petición única con modelo, `keep_alive`, `stream` y el schema en `format`, schema propio de cada tipo con `presenteEnTicket` primero, `system` y `prompt`, marcadores del ticket sin re-expandir, descripción vacía, `temperature` 0, `onToken` creciente, línea de streaming partida, sin `onToken`) y «streaming: bordes del NDJSON» (3 casos: última línea sin salto de línea, una única línea sin salto de línea y un carácter multibyte partido entre dos trozos) | Hecho |
| E2 | CA2, CA3, contrato, DoD-b | `tests/unit/services/ollama/ollama-ai-transformer.test.ts` › «E2 — cualquier fallo cae a FallbackDeterminista» (29 casos: 9 de schema inválido, 6 de código embebido en distintos campos más el inline sin fallback, 3 de respuesta ilegible, error de streaming, 3 HTTP, conexión rechazada, URL inválida, cuerpo ausente, 2 de timeout y 2 de `rawText`) | Hecho |
| E3 | CA4 | `tests/unit/services/ollama/postprocess.test.ts` (30 casos: coherencia de las reglas de `issue-types.json` con los schemas, `siFalta` por forma de campo, sin duplicar preguntas, sin mutar la entrada, fixtures escuetos y completo, `verificarLiterales` con números, comillas de cuatro tipos, decimales, apóstrofos, listas y escenarios); `tests/unit/services/ollama/ollama-ai-transformer.test.ts` › «E3 — el posprocesado se aplica al resultado de processContext» (4 casos de integración) | Hecho |

DoD-a es una regla de proceso (se aplica al cambiar un prompt o un schema); DoD-c (revisión mergeada) no es un escenario: se tilda tras la merge.

## Prerrequisitos

- **No está en `package.json`** y necesita tu autorización: dependencia de producción `ajv` (hoy solo existe como dependencia transitiva de ESLint en `node_modules`). `msw` ya está instalado para simular Ollama.
- **Archivos fuera de `src/` y `tests/`** que `/04-tdd-pair` solo puede escribir con tu autorización: `templates/prompts/` (los 6 archivos), `templates/issue-types.json` (reglas del posprocesado, decisión 1) y la sección de `templates/README.md` que describe los prompts.
- Verificado: `ContextoTicket` y `DocumentoFase1` existen en `src/shared/types/`; `StepResult` y `FallbackDeterminista` en `src/shared/errors/`; `issue-types.json` ya trae `promptVersion` (`bug-v1`, `historia-v1`); los fixtures `bug-escueto`, `bug-completo`, `historia-escueta`, `historia-completa` y `epica` están en `tests/fixtures/tickets/`. **No existen** `src/services/ollama/` ni `templates/prompts/` *(los prompts del spike del 2026-10-02 no están en el repositorio; se redactan de nuevo)*.
- La calidad real de los prompts solo se comprueba con el modelo (spike: 30-105 s por ticket en CPU). Los tests no la miden; se hace una prueba manual contra Ollama real al cerrar (tarea 4).

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/ollama/ollama-ai-transformer.ts` | Crear (propuesta) |
| `src/services/ollama/postprocess.ts` | Crear (propuesta, nombre *asumido* en el ticket) |
| `src/shared/types/documento-fase1.types.ts` | Modificar (existente): añade `presenteEnTicket` *(decisión 4)* |
| `src/services/orchestrator/issue-type-resolver.ts` | Modificar (existente, *asumido*): exporta el `promptVersion` de un tipo *(decisión 3)* |
| `templates/prompts/comun.system.md`, `bug.system.md`, `historia.system.md`, `ticket.user.md` | Crear (propuesta, con autorización) |
| `templates/prompts/bug.schema.json`, `historia.schema.json` | Crear (propuesta, con autorización) |
| `templates/issue-types.json` | Modificar (existente, con autorización): reglas `siFalta` y `verificarLiterales` por tipo |
| `templates/README.md` | Modificar (existente, con autorización): sección de prompts y schemas |
| `tests/unit/services/ollama/ollama-ai-transformer.test.ts` | Crear (propuesta): E1 y E2 con msw |
| `tests/unit/services/ollama/postprocess.test.ts` | Crear (propuesta): E3 |
| `package.json` y `package-lock.json` | Modificar con autorización (`ajv`) |

## Tareas

- [x] 1. RED/GREEN E1: schemas y prompts, `processContext` con la petición, el streaming, la validación con Ajv y `DocumentoFase1`
- [x] 2. RED/GREEN E2: todos los caminos a `FallbackDeterminista` (schema inválido, código embebido, JSON roto, vacío, error de red o de streaming, HTTP, timeout)
- [x] 3. RED/GREEN E3: `postprocess.ts` (`siFalta` y `verificarLiterales`) y su integración en `processContext`
- [x] 4. Refactor, TSDoc en español de cada export, `npm run typecheck`, `npm run lint` y `npm test`; probar a mano contra Ollama real (`qwen2.5:3b`) con tickets del Jira de pruebas y ajustar los prompts

## Decisiones y desvíos

*Registro de la implementación (2026-11-05) y puntos aprobados con el contrato:*

- **E1, autorizado por la desarrolladora:** se instaló `ajv` ^8 (dependencia de producción) y se escribieron `templates/prompts/` (los 4 prompts y los 2 schemas). Los prompts y schemas son una **primera versión** (`bug-v1` / `historia-v1`, sin cambiar `issue-types.json` todavía) que se afina con el modelo real en la tarea 4.
- *(asumido)* **Schemas estrictos:** `additionalProperties: false` y todos los campos obligatorios en cada nivel; `presenteEnTicket` es el primer campo y lleva un booleano por campo del tipo (bug: `pasosParaReproducir`, `comportamientoEsperado`, `comportamientoActual`, `entorno`, `escenarios`; historia: `historiaUsuario`, `casosDeUso`, `escenarios`). Un campo extra o faltante del modelo invalida la respuesta (cae a fallback en E2). Ajv compila con `strict: true`.
- *(asumido)* **Pequeños detalles de E1 no previstos:** una descripción vacía se manda como «(sin descripción)» para que el modelo no la invente; `onToken` solo se invoca cuando llegan caracteres nuevos (la última línea `done: true` viene vacía); el import es `import { Ajv } from "ajv"` (el import por defecto no tipa bien con ESM/NodeNext). `promptVersionFor(tipo)` se exporta desde `issue-type-resolver.ts` (decisión 3). `DocumentoFase1.presenteEnTicket` quedó opcional (decisión 4).
- **E2:** la respuesta se valida con Ajv y todo fallo (schema, código embebido con triple acento grave en cualquier texto, JSON ilegible, error HTTP o de streaming, conexión rechazada, URL inválida, cuerpo ausente y timeout) devuelve `FallbackDeterminista` con el título y la descripción, sin lanzar. El timeout (`AbortSignal.timeout`) es total e incluye la lectura del streaming. Se añadió un `finally` que cancela el lector del streaming para liberar la conexión.
- *(desvío de prueba)* **Timeout a mitad de streaming con `fetch` inyectado.** Ese caso no se simula con msw: al cortar una respuesta ya iniciada, msw sigue entregándola y `undici` lanza una aserción interna (`assert(!this.aborted)`) que Vitest cuenta como error no capturado y hace fallar el proceso aunque los tests pasen. El caso usa el `fetch` inyectable del transformer, con una respuesta que se corta cuando se dispara el `AbortSignal`, como el `fetch` real. El timeout de «respuesta que tarda» sí usa msw.

- **E3, autorizado por la desarrolladora:** `templates/issue-types.json` ganó, por tipo, `siFalta` (campo → pregunta abierta) y, solo en `bug`, `verificarLiterales` (decisión 1); `promptVersion` no cambia (las reglas viven en el código, no en el prompt). `postprocessRulesFor(tipo)` se exporta desde `issue-type-resolver.ts`. Un test comprueba que las claves de `siFalta` coinciden con las de `presenteEnTicket` de cada schema.
- *(asumido)* **Qué queda en un campo ausente (decisión 2, detalle):** texto → «No especificado en el ticket.»; lista de textos → esa frase como único elemento; lista de escenarios → vacía (la pregunta abierta lo explica y la plantilla no pinta nada); historia de usuario → la frase en `como`, `quiero` y `para`. Si `verificarLiterales` descarta todos los elementos de una lista, o el literal inventado está en un campo de texto, el campo pasa a ausente y `presenteEnTicket` queda en `false` para ese campo.
- *(asumido)* **Cómo se comparan los literales:** los números enteros por token (`3` no está en `30`, `2,5` es `2.5`); los textos entre comillas (`"…"`, `«…»`, `“…”` y `'…'`) sin distinguir mayúsculas y por contención; una comilla simple dentro de una palabra (`d'Or`) no cuenta como comilla. Solo se verifican los campos de la regla (no `resumen` ni `preguntasAbiertas`). Un número que el modelo escribe como numeración de un paso (`1.`) se considera literal; el prompt le pide no numerar.

- **Tarea 4, prueba contra Ollama real (2026-11-05, WSL, solo CPU, `qwen2.5:3b`, tickets del Jira de pruebas leídos con `fetchTicket`; el token no se imprimió):**
  - `SCRUM-1` (historia, «Crear la conexión con Jira»): `Ok` en 30 s. Reconoce que no trae historia de usuario, casos de uso ni criterios: todo «No especificado en el ticket.» con sus 3 preguntas abiertas. Correcto.
  - `SCRUM-3` (historia): `Ok` en 28 s, mismo criterio; el resumen es fiel. El modelo añadió una pregunta abierta propia, razonable.
  - `DEMO-1` (bug sintético sin descripción): `Ok` en 14 s, todo ausente salvo el resumen. Sin datos inventados.
  - `SCRUM-2` (bug con una línea de pasos y el síntoma): con el prompt inicial el modelo marcó **todo** como ausente (demasiado conservador, documento sin valor). Se afinó `bug.system.md` en dos iteraciones, indicando qué cuenta como presente en cada campo y que un recorrido con flechas es una lista de pasos. Resultado final: `pasosParaReproducir` y `comportamientoActual` en `true` con las palabras del ticket, el resto ausente con su pregunta abierta (30 s). El posprocesado dejó pasar el texto entre comillas que el modelo re-escribió con comillas simples, porque compara el contenido.
  - Fallos reales: un timeout de 4 s corta la generación a mitad (97 caracteres recibidos) y cae a `FallbackDeterminista`; un puerto sin Ollama y un modelo no instalado caen al instante.
  - Tiempos medidos: 14 a 56 s por ticket (el spike del 2026-10-02 midió 30 a 105 s). La variabilidad es alta incluso en la misma máquina; el timeout de 120 s sigue siendo razonable.
- *(asumido)* **`promptVersion` sigue en `bug-v1` / `historia-v1`** aunque `bug.system.md` cambió durante la prueba: son las primeras versiones de estos prompts y todavía no hay ejecuciones registradas en `ticket_logs` con ellas. A partir del primer commit, cualquier cambio sube la versión (DoD-a); la regla quedó escrita en `templates/README.md`.
- *(limitación conocida)* **Un modelo de 3B es conservador:** prefiere marcar «ausente» a arriesgar. Es el sesgo correcto para no inventar, pero la historia de usuario (`como/quiero/para`) solo se rellena cuando el ticket la trae completa. El campo se marca entero como ausente aunque el ticket diga el `quiero` (caso `SCRUM-3`). Si la desarrolladora prefiere campos parciales, requeriría cambiar el schema y subir la versión.
- **Cierre de la tarea 4:** el tipo `TipoTicket` (`"bug" | "historia"`), escrito en cuatro sitios, quedó en `src/shared/types/ticket-context.types.ts`; `TipoDocumento` de `filesystem-manager.ts` es ahora un alias (sin cambio para quien lo importa). Se añadió la sección `prompts/` a `templates/README.md` (autorizada). Todo export nuevo lleva TSDoc en español. `typecheck` y `lint` limpios; 505 tests en verde (74 de este ticket); cobertura de `src/services/ollama/` en 98 % de sentencias y 92,5 % de ramas (umbral 80 %).

- **Revisión de Cursor (2026-11-05), un hallazgo bajo corregido:** `generate` solo interpretaba el buffer al encontrar un salto de línea, así que si el último trozo del streaming llegaba sin `\n` ese fragmento se perdía y la respuesta caía a fallback aunque el resto estuviera bien; además no se vaciaba el `TextDecoder` al cerrar. Los tests armaban siempre el NDJSON con `\n` final y no lo veían. Ahora se procesa el resto del buffer (más lo pendiente del decodificador) al terminar la lectura. 3 tests nuevos (el del carácter multibyte ya pasaba y queda como cobertura). Verificación: `typecheck` y `lint` limpios; 508 tests en verde (77 de este ticket).

Puntos **(ambiguos o asumidos)** aprobados con el contrato:

1. *(asumido, `002` §2.2)* **Dónde viven las reglas del posprocesado.** La descripción de `002` dice que `siFalta` y `verificarLiterales` son reglas de `issue-types.json`, que hoy no las tiene. Se propone añadir por tipo: `siFalta` (campo → pregunta abierta que se agrega, p. ej. `comportamientoEsperado` → «¿Cuál es el comportamiento esperado?») y `verificarLiterales` (lista de campos a verificar; solo en `bug`). Alternativa: constantes dentro de `postprocess.ts`, sin tocar `issue-types.json`.
2. *(ambiguo)* **Qué significa «descartar» un literal ausente.** Se propone descartar el **elemento** (un paso, un escenario, una frase de una lista) que contiene un número o un texto entre comillas que no aparece en el título ni la descripción, y, si el literal está en un **campo de texto simple**, tratarlo como ausente (se sustituye todo el campo por «No especificado en el ticket.» y se añade su pregunta abierta). No se edita el literal dentro de la frase: quitar un «3» de «falla 3 veces» deja un texto sin sentido. Los literales se comparan sin distinguir mayúsculas, y «3» no coincide con «30».
3. *(ambiguo)* **De dónde sale `promptVersion`.** Se propone leerlo de `issue-types.json` (por tipo) mediante una función exportada desde `issue-type-resolver.ts`, que ya lee ese archivo, para no leerlo dos veces. Los prompts nuevos arrancan en `bug-v1` / `historia-v1` (los valores que ya trae el archivo desde TK-02a); a partir de ahí cada cambio de prompt o schema sube la versión (DoD-a).
4. *(asumido)* **`presenteEnTicket`.** Es un objeto con un booleano por campo del tipo (`{ pasosParaReproducir: true, entorno: false, … }`) y primer campo del schema. En `DocumentoFase1` queda **opcional** (`presenteEnTicket?`) para no romper los tests y fixtures ya aprobados de TK-02d, que no lo traen; el transformer siempre lo devuelve.
5. *(asumido)* **Protocolo.** `POST /api/generate` con `stream: true` (JSON por líneas con `response` y `done`), `system` y `prompt` separados, y `format` con el schema. `onToken` recibe el **total acumulado** de caracteres, no el incremento. El timeout (`ollama_timeout_seconds`, por defecto 120) es **total**, incluido el streaming, y aborta la petición al vencer.
6. *(asumido)* **`rawText` del fallback:** el título, una línea en blanco y la descripción (solo el título si no hay descripción). Es lo que ya espera `writeDocument` de TK-02d.
7. *(asumido)* **Opciones por constructor:** `host`, `model`, `timeoutSeconds`, `keepAlive` (por defecto `30s`, «corto») y un `fetch` inyectable. `options.temperature` se fija en `0` para respuestas repetibles *(a confirmar al probar con el modelo real)*. Nada se lee de `AppConfig` dentro del transformer: el Orquestador (TK-02f) le pasa `ollamaHost`, `ollamaModel` y `ollamaTimeoutSeconds`.
8. *(asumido)* **«Bloque de código».** Solo se descarta un bloque delimitado con triple acento grave (` ``` `), en cualquier campo de texto, elemento de lista o escenario, que es lo que pide el criterio. Un fragmento de código en línea con un solo acento grave no se descarta (el documento renderiza texto, no se ejecuta).
9. *(asumido)* **Prompts y calidad.** Los prompts siguen el diseño del spike (`presenteEnTicket` primero, sin invención, sin bloques de código) y se afinan con el modelo real en la tarea 4; no forman parte de ningún escenario porque dependen del modelo.
10. *(asumido)* **Mensajes del fallo.** El transformer no devuelve el motivo exacto (la firma `FallbackDeterminista` solo lleva `rawText`); el Orquestador registra `ollama_status = 'fallback_deterministic'`. Si quieres registrar la causa en `ticket_logs.ollama_error`, hay que ampliar el contrato de `StepResult` (cambio de TK-02a): queda fuera de este ticket salvo que lo pidas.
