# Change: TK-02b — Jira REST Client

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02b)
- **Depende de:** TK-02a
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre S: es un solo criterio técnico, pero agrupa 4 métodos y ~7 clasificaciones de fallo; se reparte en 3 escenarios y 5 tareas. Si crece al implementar, separar la lectura del ticket de la gestión de claves.

## Propósito

Cliente de la API REST v2 de Jira Cloud (HTTP directo, Basic email + token, sin MCP) que consulta un ticket, valida claves de proyecto, lista los tickets asignados y obtiene el nombre de la cuenta, devolviendo siempre un `StepResult`.
Ninguna falla de red o de credenciales llega al Orquestador como excepción: se clasifica como `FallbackManual` con motivo.

## Criterios de aceptación de origen

- CA1 (original): `JiraRestClient` con HTTP simulado. 200 → `Ok(ContextoTicket)` con mapeo correcto (`description` en texto plano). Timeout persistente (tras 1 reintento) → `FallbackManual('network_timeout')`. 401/403 → `FallbackManual('invalid_token')`. 404 en `/issue` seguido de `/myself` 401 → `FallbackManual('invalid_token')`, y seguido de `/myself` 200 → `FallbackManual('not_found')`. 429 con `Retry-After` → respetado antes de fallar. `validateProjectKey` aplica la misma regla del 404.
- DoD-a: todas las credenciales, el host y los timeouts llegan por constructor.
- DoD-b: hay al menos un test para `Ok` y para cada motivo de `FallbackManual`.
- Métodos sin criterio numerado en el ticket (se toman de su descripción y contratos): `listAssignedTickets` con la JQL indicada y `getMyDisplayName` sobre `/myself`. _(asumido: se cubren en E3 con el mismo criterio de clasificación de fallos)_

## Escenarios BDD

### E1 — Consulta de un ticket: mapeo y credenciales por constructor (cubre: CA1 caso 200, DoD-a)

- **Given** un cliente construido con host, email, token y timeout, y Jira simulado con msw respondiendo 200 con los fixtures de TK-02a (bug completo, historia escueta con `description` vacía y bug escueto con `description: null`)
- **When** se llama a `fetchTicket` con cada clave
- **Then** devuelve `Ok(ContextoTicket)` con `ticketId`, `title`, `description` en texto plano (`""` si Jira devuelve vacío o `null`), `issueType` y `source: 'jira'`; la petición va al host del constructor con `Authorization: Basic base64(email:token)` y pide solo `summary`, `description` e `issuetype`

### E2 — Clasificación de fallos con reintento y regla del 404 (cubre: CA1 casos de fallo, DoD-b)

- **Given** Jira simulado con msw que responde con timeout, 401, 403, 404, 429 con `Retry-After` y una secuencia 404 más `/myself` 401 o 200
- **When** se llama a `fetchTicket` en cada caso
- **Then** un timeout persistente se reintenta una vez y termina en `FallbackManual('network_timeout')` (y uno que se resuelve en el reintento devuelve `Ok`); 401 o 403 dan `FallbackManual('invalid_token')` sin reintentar; 404 seguido de `/myself` 401 da `invalid_token` y seguido de `/myself` 200 da `not_found`; un 429 espera lo indicado en `Retry-After` antes de reintentar y solo falla si el reintento también falla

### E3 — Claves, tickets asignados y nombre de la cuenta (cubre: CA1 regla del 404 en `validateProjectKey`, métodos sin CA numerado)

- **Given** Jira simulado con msw que responde para `/project/{key}`, para la búsqueda de tickets asignados y para `/myself`
- **When** se llama a `validateProjectKey` (clave existente, inexistente con `/myself` 200, y token inválido con `/myself` 401), a `listAssignedTickets` (con dos claves, con una lista vacía de claves y con respuesta sin resultados) y a `getMyDisplayName`
- **Then** `validateProjectKey` devuelve `Ok({ key, name })`, `FallbackManual('not_found')` o `FallbackManual('invalid_token')` según la regla del 404; `listAssignedTickets` envía la JQL `project in (…) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC` y devuelve `Ok([{ ticketId, title, issueType }])` (sin llamar a Jira si no hay claves); `getMyDisplayName` devuelve `Ok(displayName)`; y los tres clasifican 401/403 y timeout igual que `fetchTicket`

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1 (200), DoD-a | `tests/unit/services/jira/jira-rest-client.test.ts` › «E1 — fetchTicket» (5 casos: bug completo, descripción vacía y `null`, host/Basic/campos desde el constructor, codificación del ID) | Hecho |
| E2 | CA1 (fallos), DoD-b | `tests/unit/services/jira/jira-rest-client.test.ts` › «E2 — fetchTicket: clasificación de fallos» (15 casos: timeout persistente y resuelto en el reintento, 503, error de red, 401/403, 404 con `/myself` 401/403/200/sin respuesta, 429 con y sin `Retry-After` y con tope, otros códigos) | Hecho |
| E3 | CA1 (`validateProjectKey`), métodos sin CA numerado | `tests/unit/services/jira/jira-rest-client.test.ts` › «E3 — claves, tickets asignados y nombre de la cuenta» (16 casos: `validateProjectKey` Ok/codificación/404 con `/myself` 200 y 401; `listAssignedTickets` JQL y mapeo, sin claves, sin resultados, 401, timeout; `getMyDisplayName` Ok/401/403/503; cuerpos 2xx inválidos en los 4 métodos) | Hecho |

## Prerrequisitos

- `msw` ^3.0.3 (`msw/node`): **ya instalado** y declarado en `package.json`, verificado.
- `fetch` global de Node ≥ 22.13: disponible, sin dependencias nuevas.
- Credenciales reales de Jira: **no se necesitan** para los tests automatizados (todo se simula con msw).

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/jira/jira-rest-client.ts` | Crear (propuesta) |
| `tests/unit/services/jira/jira-rest-client.test.ts` | Crear (propuesta) |

Sin cambios en `eslint.config.js`: la regla de TK-02a ya impide que este módulo importe el storage manager. Los fixtures de tickets de TK-02a se reutilizan sin modificarlos.

## Tareas

- [x] 1. E1 — RED: tests de `fetchTicket` con msw y los fixtures; GREEN: `JiraRestClient` con constructor, cabecera Basic y mapeo a `ContextoTicket`
- [x] 2. E2 — RED: tests de timeout con reintento, 401/403, regla del 404 con `/myself` y 429; GREEN: clasificación de fallos en `fetchTicket`
- [x] 3. E3 — RED: tests de `validateProjectKey`, `listAssignedTickets` y `getMyDisplayName`; GREEN: los tres métodos reutilizando la misma clasificación
- [x] 4. Verificar la cobertura (umbral del 80 % de `src/services/**`, ahora con el cliente incluido) con `npm run test:coverage`
- [x] 5. Refactor, TSDoc en español de los exports públicos, `npm run typecheck`, `npm run lint` y `npm test` en verde

## Decisiones y desvíos

Pendientes de confirmar con el desarrollador (marcadas _(ambiguo)_ o _(asumido)_; se mueven aquí con su respuesta al aprobar):

- _(asumido)_ **Constructor:** recibe `{ baseUrl, email, apiToken, timeoutSeconds, retryDelayMs?, sleep? }`, o sea, los campos correspondientes de `ResolvedAppConfig` más dos parámetros opcionales para poder probar sin esperas: `retryDelayMs` (por defecto ~2000 ms, el «backoff corto» de `docs/009` §2.3) y `sleep`. Usa `fetch` global y `AbortSignal.timeout`. En los tests el timeout puede ser fraccionario (p. ej. 0,05 s).
- _(ambiguo)_ **Qué se reintenta:** el ticket habla de «un reintento con backoff corto» ante timeout. Propuesta: se reintenta una vez ante timeout, error de red y 5xx; **no** ante 401/403/404. Un 5xx persistente se clasifica como `FallbackManual('network_timeout')` (el ticket no lo menciona).
- _(ambiguo)_ **429:** se espera `Retry-After` segundos y se reintenta una vez; si el reintento también da 429 se devuelve `FallbackManual('network_timeout')` (el motivo no admite otro valor). Propuesta: limitar la espera a un máximo (p. ej. 30 s) para no bloquear la TUI indefinidamente; sin cabecera, usar el mismo backoff de ~2 s.
- _(ambiguo)_ **Otros códigos inesperados** (400, 410, etc.): propuesta `ErrorBloqueante('ErrorInesperado')` con el código en el mensaje, en vez de forzarlos a un `FallbackManual`.
- _(ambiguo)_ **Endpoint de búsqueda:** `docs/009` no lo fija. Atlassian está reemplazando `GET /rest/api/2/search` por `GET /rest/api/2/search/jql` en Jira Cloud. Propuesta: implementar el que acepte la instancia de pruebas (`andreardev`), verificándolo una vez a mano con las credenciales de `~/.config/devflow/jira.env` y registrando aquí el resultado; los tests con msw usan el elegido. Sin paginación: `maxResults=50` y campos `summary,issuetype`.
- _(asumido)_ **Lista de claves vacía:** `listAssignedTickets([])` devuelve `Ok([])` sin llamar a Jira (una JQL con `project in ()` es inválida).
- _(asumido)_ **`description` ausente:** `null` o ausente se mapea a `""`, no a `undefined`, para cumplir `ContextoTicket.description: string`.
- _(asumido)_ **Identificadores en la URL:** el ID del ticket y la clave de proyecto se codifican con `encodeURIComponent`; el host se normaliza quitando una barra final.
- _(asumido)_ **`FallbackManual` en métodos sin entrada manual:** `validateProjectKey`, `listAssignedTickets` y `getMyDisplayName` devuelven el mismo `StepResult` por coherencia con el contrato; es el Orquestador (TK-02f/TK-02g) quien decide cómo mostrarlo, ya que no existe «carga manual» para ellos.
- _(asumido)_ **Si `/myself` también falla** (timeout) tras un 404 inicial, el resultado es `FallbackManual('network_timeout')`.

Registro de la implementación (2026-11-03):

- **msw 3:** la opción para rechazar peticiones sin handler se llama `onUnhandledFrame` (no `onUnhandledRequest` como en msw 2); los tests usan `server.listen({ onUnhandledFrame: "error" })`.
- **Clasificación implementada (E2):** reintento único con `retryDelayMs` ante timeout, error de red y 5xx; 429 espera `Retry-After` (tope 30 s) o `retryDelayMs`; 401/403 → `invalid_token` sin reintento; 404 → `/myself` (401/403 → `invalid_token`, 200 → `not_found`, sin respuesta → `network_timeout`); cualquier otro código → `ErrorBloqueante('ErrorInesperado')`. Todas las propuestas del contrato se aplicaron sin cambios.
- **Cuerpo 2xx inválido (decidido por el desarrollador, 2026-11-03):** una respuesta 2xx cuyo cuerpo no es JSON o no tiene la forma esperada se clasifica como `ErrorBloqueante('ErrorInesperado')` en los cuatro métodos, para que ninguna excepción cruda llegue al Orquestador. Se añadieron tests en E3.
- **Endpoint de búsqueda (verificado a mano el 2026-11-03 contra la instancia de pruebas, solo lectura):** `GET /rest/api/2/search` responde **410** («La API solicitada se ha eliminado») y `GET /rest/api/2/search/jql` responde **200**. El cliente usa `/rest/api/2/search/jql` con `fields=summary,issuetype` y `maxResults=50`, sin paginación (`nextPageToken` queda fuera del MVP).
- **JQL:** las claves de proyecto se separan con coma y espacio dentro de `project in (…)` sin comillas; se asume que ya fueron validadas al darlas de alta.
- **Cobertura (tarea 4):** con el cliente incluido, `src/services/**` marca 98,8 % en sentencias, 96 % en ramas, 100 % en funciones y 100 % en líneas (umbral del 80 %).
- **Refactor (tarea 5):** `fetchTicket` deja de ser `async` (devuelve la promesa de `call`), la lectura de `Retry-After` se simplifica sin cambiar su comportamiento y se completa el TSDoc de `email`. Typecheck, lint y 134 tests en verde.

Ajustes tras la revisión de la PR #2 (2026-11-03, aprobados por el desarrollador, aplicados con TDD):

- **Mapeo estricto de `fetchTicket`:** `summary` e `issuetype.name` deben ser texto y `description` solo texto, `null` o ausente (`""`); cualquier otro tipo (p. ej. una descripción en formato de documento, o `summary: null`) da `ErrorBloqueante('ErrorInesperado')`. Corrige un incumplimiento de la decisión sobre cuerpos 2xx inválidos, que solo se había aplicado a los otros tres métodos; evita además que un `issueType` ausente llegue a `resolveIssueType` y lance un `TypeError`.
- **Claves en la JQL:** `listAssignedTickets` rechaza antes de llamar a Jira toda clave que no cumpla `^[A-Z][A-Z0-9_]+$` con `ErrorInesperado` que nombra la clave. Sustituye la suposición «claves ya validadas al darlas de alta»: el método es público y la interpolación permitía ampliar la consulta a otros proyectos.
- **URL base inválida:** todos los métodos devuelven `ErrorInesperado` (error de configuración) en lugar de `network_timeout`; timeout y fallo de red siguen en `network_timeout`. `AppConfigProvider` (TK-02a) tampoco valida que `jiraBaseUrl` sea una URL; se deja anotado para TK-02g / TK-03a.
- **`Retry-After` negativo:** la espera se acota a un mínimo de 0. Una fecha HTTP en la cabecera sigue cayendo al backoff por defecto (Jira Cloud envía segundos).
- **Tests que faltaban:** `/myself` caído por error de red tras un 404, y backoff por defecto de 2000 ms sin `retryDelayMs`. Nacieron en verde porque fijan comportamiento ya correcto.
- **Sin cambios, a propósito:** un 429 agotado sigue siendo `network_timeout` (el motivo no admite otro valor) y la búsqueda se corta en 50 sin seguir `nextPageToken`.
