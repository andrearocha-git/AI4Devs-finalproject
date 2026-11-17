## 4. Especificación de la API

DevFlow CLI es una herramienta CLI/TUI sin interfaz gráfica ni panel web (ver "Límites Explícitos / Non-Goals" del PRD): **no expone ninguna API propia en el MVP**. Su integración por API es como **consumidora** de dos servicios:

| Servicio | Dónde está | Para qué | Quién lo llama |
|---|---|---|---|
| **Jira Cloud REST API v2** | `https://<sitio>.atlassian.net` (HTTPS) | Leer el ticket, validar claves de proyecto y listar los tickets abiertos del desarrollador | `JiraRestClient` (`src/services/jira/jira-rest-client.ts`), llamado solo por el Orquestador |
| **Ollama (API local)** | `http://localhost:11434` por defecto (`ollama_host`) | Redactar con un LLM local la Fase 1 del documento | `OllamaAITransformer` (`src/services/ollama/ollama-ai-transformer.ts`), llamado solo por el Orquestador |

Ambos se llaman **directamente por HTTP** con el `fetch` de Node, sin MCP Server ni SDK de por medio ([ADR-005.1](ADR-001-arquitectura-inicial.md) para Jira; [ADR-003.1](ADR-001-arquitectura-inicial.md) para Ollama). La aplicación nunca escribe en Jira y nunca llama a un LLM en la nube. La TUI no habla con ninguno: solo con el Orquestador.

---

### 4.1. Jira Cloud REST API v2 (la aplicación como cliente)

**Autenticación.** Cabecera `Authorization: Basic base64(email:apiToken)` con la cuenta Atlassian y un API Token clásico; no hay OAuth ni flujo con navegador. Se envía `Accept: application/json`. Todas las llamadas son `GET` (**solo lectura**).

**Versión de la API.** Se usa la **v2** porque devuelve la descripción en texto plano (con marcas wiki de Jira, que `stripJiraWiki` limpia de forma determinista antes de dárselas al modelo); la v3 la devuelve como documento ADF.

**Parámetros de configuración** (tabla `app_config`, ver [`docs/003-modelo-de-datos.md`](003-modelo-de-datos.md)): URL base (`jira_base_url`), email, token y `jira_timeout_seconds` (por defecto `10`, por intento).

#### Endpoints de Jira

| # | Endpoint | Cuándo se llama | Qué se toma de la respuesta |
|---|---|---|---|
| 1 | `GET /rest/api/2/issue/{id}?fields=summary,description,issuetype` | `devflow start [ID]`, para obtener el ticket | `fields.summary` → título; `fields.description` → descripción (`""` si viene vacía o `null`); `fields.issuetype.name` → tipo de issue (decide la plantilla y el prefijo de rama) |
| 2 | `GET /rest/api/2/project/{key}` | `devflow config proyectos`, al dar de alta una clave | `key` y `name` del proyecto (se guarda el nombre en `jira_projects`). Es necesario porque la JQL ignora sin error las claves que no existen |
| 3 | `GET /rest/api/2/search/jql?jql=…&fields=summary,issuetype&maxResults=50` | `devflow start` sin ID, para elegir un ticket de una lista | `key`, `fields.summary` y `fields.issuetype.name` de hasta 50 tickets, sin paginación en el MVP |
| 4 | `GET /rest/api/2/myself` | Solo para **interpretar un 404** (ver abajo) | Nada del cuerpo; solo importa el código de estado |

**JQL del endpoint 3** (fija, no la escribe el usuario):

```text
project in (<claves dadas de alta>) AND assignee = currentUser() AND statusCategory != Done AND issuetype != Epic ORDER BY updated DESC
```

Las claves se interpolan en la JQL, así que cada una debe cumplir `^[A-Z][A-Z0-9_]+$`; si alguna no lo cumple, no se llama a Jira y se devuelve un error que nombra la clave. Con una lista vacía tampoco se llama (una JQL con `project in ()` es inválida).

**Ejemplo de respuesta del endpoint 1 (campos usados):**

```json
{
  "key": "SCRUM-12",
  "fields": {
    "summary": "Validar el correo en el registro",
    "description": "Como usuario quiero…",
    "issuetype": { "name": "Historia" }
  }
}
```

#### Errores de Jira

Cada llamada devuelve el resultado común de los pasos del Orquestador (`Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`, ver [`docs/002-arquitectura-del-sistema.md`](002-arquitectura-del-sistema.md)). Para Jira:

| Respuesta de Jira | Resultado | Qué ve el desarrollador |
|---|---|---|
| 2xx con la forma esperada | `Ok` | El flujo sigue |
| 2xx con un campo que no es texto (p. ej. `summary: null`) o un cuerpo que no es JSON | `ErrorBloqueante('ErrorInesperado')` | «Jira devolvió una respuesta con un formato inesperado» |
| 401 o 403 | `FallbackManual('invalid_token')` | Token inválido o sin permiso: revisar `devflow config` |
| **404** | Se llama al endpoint 4: 401/403 → `FallbackManual('invalid_token')`; 200 → `FallbackManual('not_found')`; otra cosa → `network_timeout` | Distingue «el token no vale» de «el ticket o proyecto no existe». Hace falta porque Jira Cloud responde 404 (y no 401) a algunos tokens inválidos al pedir un issue |
| 429, 5xx, timeout o error de red | `FallbackManual('network_timeout')` **tras un reintento** | Se ofrece cargar el ticket a mano |
| Otro código (400, 405…) | `ErrorBloqueante('ErrorInesperado')` con el código | «Jira respondió <código>» |
| URL base no válida | `ErrorBloqueante('ErrorInesperado')`, sin llamar | «La URL base de Jira no es válida» |

**Reintentos y límites.** Un solo reintento ante fallos transitorios (timeout, red, 5xx, 429), esperando 2 s o, si Jira manda `Retry-After`, ese tiempo con un tope de 30 s. Cada intento tiene su propio timeout (`jira_timeout_seconds`).

**Fuera de contrato:** crear o editar issues, comentarios, transiciones, adjuntos, paginación, OAuth y MCP (Atlassian Rovo).

---

### 4.2. Ollama (API local, la aplicación como cliente)

**Dónde corre.** En el mismo equipo del desarrollador (o accesible por `localhost`, por ejemplo el Ollama de WSL). No lleva autenticación y no sale a Internet. Si no está activo o no tiene el modelo, el flujo **no se bloquea**: se usa el fallback determinista ([ADR-003.1](ADR-001-arquitectura-inicial.md)).

**Parámetros de configuración** (`app_config`): `ollama_host` (por defecto `http://localhost:11434`), `ollama_model` (por defecto `qwen2.5:3b`, el mínimo viable; el 1.5b está descartado) y `ollama_timeout_seconds` (por defecto `120`).

#### Endpoints de Ollama

| # | Endpoint | Quién lo llama | Para qué |
|---|---|---|---|
| 1 | `POST /api/generate` | La aplicación (`OllamaAITransformer`) | Generar la Fase 1 del documento, una vez por ticket |
| 2 | `GET /api/tags` | **Solo el instalador** (`scripts/install.ps1`), con 3 s de timeout | Comprobar que Ollama responde y que el modelo `qwen2.5:3b` está descargado; solo avisa, no bloquea |

La aplicación en sí no comprueba la disponibilidad antes de generar: lo averigua al llamar al endpoint 1, y cualquier fallo se traduce en el fallback.

#### `POST /api/generate`

Cuerpo de la petición (JSON):

| Campo | Valor | Motivo |
|---|---|---|
| `model` | `ollama_model` | Modelo local |
| `system` | `templates/prompts/comun.system.md` + `<tipo>.system.md` | Instrucciones comunes y las del tipo (`bug` o `historia`) |
| `prompt` | `templates/prompts/ticket.user.md` rellenada con id, título, tipo y descripción (ya sin marcas wiki de Jira) | Contexto del ticket |
| `stream` | `true` | Permite mostrar progreso (caracteres recibidos) |
| `format` | El **JSON Schema** del tipo (`templates/prompts/<tipo>.schema.json`) | Obliga a Ollama a devolver JSON con esa forma; el primer campo es `presenteEnTicket` |
| `keep_alive` | `30s` | Libera la RAM poco después de responder |
| `options` | `{ "temperature": 0 }` | Salida lo más determinista posible |

La petición completa tiene un único timeout de `ollama_timeout_seconds`, que incluye el streaming.

Respuesta: un flujo de líneas JSON (`{"response": "<trozo>", …}`); la aplicación concatena los `response`. Si una línea trae `error`, se trata como fallo.

**Qué se hace con la salida:**

1. El texto completo se parsea como JSON y se **valida con Ajv** contra el mismo schema (el JSON Schema es la fuente de verdad; no hay Zod).
2. Se rechaza cualquier campo con un bloque de código (triple acento grave): los fragmentos de código no se aceptan del modelo.
3. Se aplica el **posprocesado determinista** (`siFalta`, y en bugs `verificarLiterales`) y se rinde a Markdown con Handlebars.
4. Se guarda la `promptVersion` del tipo en `ticket_logs`.

#### Errores de Ollama

| Situación | Resultado | Qué ve el desarrollador |
|---|---|---|
| JSON válido y conforme al schema | `Ok`, con `generatedByOllama: true` | Documento con las secciones de la Fase 1 redactadas |
| Ollama apagado, sin el modelo, error HTTP o de streaming, timeout total, JSON ilegible, JSON que no cumple el schema o con un bloque de código | `FallbackDeterminista` con el título y la descripción originales | El documento se crea igual, con el aviso «⚠️ Generado sin Ollama» |

El transformer **nunca lanza** una excepción hacia el Orquestador.

**Fuera de contrato:** cualquier proveedor en la nube (OpenAI, Anthropic, etc.), la API de chat (`/api/chat`), el envío de datos fuera del equipo y la descarga automática de modelos (el instalador solo indica el comando `ollama pull qwen2.5:3b`).

---

### 4.3. Contrato propio (sin endpoints en el MVP)

DevFlow CLI no expone endpoints, así que no hay OpenAPI que publicar. Si en el futuro se integrara con otras herramientas, los endpoints propios se documentarían aquí en formato OpenAPI. Mientras tanto, los contratos de integración son los de las secciones 4.1 y 4.2, y están fijados por los tests con `msw` de `tests/unit/services/jira/` y `tests/unit/services/ollama/`.
