## 2. Arquitectura del Sistema

> Las decisiones de esta sección están respaldadas por el registro formal de decisiones: [`ADR-001-arquitectura-inicial.md`](ADR-001-arquitectura-inicial.md).

### **2.1. Diagrama de arquitectura:**

Patrón adoptado: **3 capas** (ver [ADR-001-arquitectura-inicial.md, §0](ADR-001-arquitectura-inicial.md#0-evaluación-del-patrón-arquitectónico-modular-propuesto-tui-layer--service-layer--storage-layer)):

- **TUI Layer** — interacción con el desarrollador.
- **Service Layer** — orquestador de pasos independientes por integración (no un servicio monolítico), cada uno con resultado `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.
- **Storage Layer** — acceso a SQLite y al sistema de archivos.

**Diagrama de componentes:**

```mermaid
graph TD
    subgraph TUI["TUI Layer"]
        CLI["Controlador CLI/TUI (Consola Windows)"]
    end

    subgraph SVC["Service Layer (orquestador de pasos independientes)"]
        ORCH["Orquestador de Ticket"]
        JIRA["Jira REST Client"]
        OLLAMA["Ollama AI Transformer (con Fallback Determinista)"]
        GITM["Git Manager"]
        FSM["FileSystem Manager"]
    end

    subgraph STG["Storage Layer"]
        SQLITE[("SQLite Storage Manager")]
        DISK[("Local File Storage")]
    end

    JiraAPI(("API REST de Jira")):::ext
    OllamaSvc(("Servicio Ollama local")):::ext
    GitRepo(("Repositorio Git local")):::ext

    CLI -->|"devflow start ID-123"| ORCH
    ORCH --> JIRA
    ORCH --> GITM
    ORCH --> FSM
    ORCH --> OLLAMA

    JIRA -->|"HTTPS REST"| JiraAPI
    OLLAMA -->|"HTTP local"| OllamaSvc
    GITM -->|"comandos git"| GitRepo
    FSM --> DISK

    ORCH --> SQLITE

    ORCH -.->|"resultado / progreso"| CLI

    classDef ext fill:#eee,stroke:#999,stroke-dasharray: 5 5;
```

> `ORCH --> SQLITE` es la **única** flecha hacia la Storage Layer: el Orquestador es el único componente que escribe en `ticket_logs`, al finalizar el flujo, con el resultado agregado de todos los pasos. Jira REST Client, Ollama AI Transformer y Git Manager no acceden a SQLite directamente — así el `SQLite Storage Manager` sigue siendo el único punto de acceso a la Storage Layer y ningún componente de integración necesita conocer su esquema.

**Diagrama de secuencia E2E** (`devflow start ID-123`):

```mermaid
sequenceDiagram
    actor Dev as Desarrollador
    participant TUI as TUI Layer
    participant ORCH as Service Layer (Orquestador)
    participant JIRA as Jira REST Client
    participant GITM as Git Manager
    participant OLLAMA as Ollama AI Transformer
    participant FSM as FileSystem Manager
    participant SQL as SQLite Storage Manager
    participant JiraAPI as API Jira
    participant OllamaSvc as Servicio Ollama

    Dev->>TUI: devflow start ID-123
    TUI->>ORCH: iniciarTicket(ID-123)

    ORCH->>JIRA: consultarTicket(ID-123)
    JIRA->>JiraAPI: GET /issue/ID-123
    alt Jira responde OK
        JiraAPI-->>JIRA: 200 OK (contexto del ticket)
        JIRA-->>ORCH: ContextoTicket
    else Fallo (red caída / token inválido / ticket inexistente)
        JiraAPI-->>JIRA: timeout | 401/403 | 404
        JIRA-->>ORCH: FallbackManual(motivo)
        ORCH->>TUI: solicitar datos manuales
        TUI->>Dev: prompt (ID, título, descripción)
        Dev-->>TUI: datos mínimos del ticket
        TUI-->>ORCH: ContextoTicket (manual)
    end

    ORCH->>GITM: crearRama(ContextoTicket)
    GITM->>GITM: git checkout -b feature/ID-123-resumen
    GITM-->>ORCH: RamaCreada

    ORCH->>FSM: crearEstructuraCarpetas(ID-123)
    FSM->>FSM: crear /ticket-ID-123/adjuntos/
    FSM-->>ORCH: CarpetasCreadas

    ORCH->>OLLAMA: procesarContexto(ContextoTicket)
    OLLAMA->>OllamaSvc: POST /api/generate
    alt Ollama disponible y responde a tiempo
        OllamaSvc-->>OLLAMA: Markdown estructurado (Contexto, Casos de Uso, Gherkin)
        OLLAMA-->>ORCH: DocumentoFase1 (estructurado)
    else Ollama no disponible / timeout / sin modelo
        OLLAMA-->>ORCH: FallbackDeterminista (texto crudo)
        Note over OLLAMA,ORCH: Documento marcado ⚠️ Generado sin Ollama
    end

    ORCH->>FSM: generarDocumentoMarkdown(DocumentoFase1, plantillaFase2)
    FSM-->>ORCH: documento.md generado

    ORCH->>SQL: registrarHistorial(ID-123, resultado)
    SQL-->>ORCH: OK

    ORCH-->>TUI: resumen (rama, carpetas, documento)
    TUI-->>Dev: Ticket ID-123 listo para trabajar
```

**Justificación del patrón de 3 capas** (ver [ADR-001-arquitectura-inicial.md](ADR-001-arquitectura-inicial.md)):

El diagrama de secuencia materializa el ajuste exigido en el [§0 del ADR-001](ADR-001-arquitectura-inicial.md#0-evaluación-del-patrón-arquitectónico-modular-propuesto-tui-layer--service-layer--storage-layer): la Service Layer no es un método lineal con un único bloque try/catch, sino un **orquestador de pasos independientes** (Jira, Git, FileSystem, Ollama), donde cada paso devuelve explícitamente `Ok`, `FallbackManual`, `FallbackDeterminista` o `ErrorBloqueante` sin detener el flujo completo ante un fallo aislado. `ErrorBloqueante` cubre los fallos que no tienen un camino de fallback definido (p. ej. repositorio no encontrado, permisos insuficientes al escribir en disco): en esos casos el Orquestador detiene el flujo y reporta a la TUI qué pasos sí se completaron, dejando la resolución en manos del desarrollador (ver Git Manager y FileSystem Manager en §2.2). La rama de fallback de Jira corresponde a la clasificación de errores y a la autenticación sin navegador decidida en [ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb); la rama de fallback de Ollama corresponde directamente a [ADR-003.1](ADR-001-arquitectura-inicial.md#adr-0031-llm-local-ollama-con-fallback-determinista-frente-a-apis-cloud-openaianthropic); la persistencia del historial vía `SQLite Storage Manager` corresponde a [ADR-002.1](ADR-001-arquitectura-inicial.md#adr-0021-persistencia-en-sqlite-embebida-frente-a-archivos-planos-jsonyaml); y la escritura de carpetas/documento en disco local corresponde a [ADR-004.1](ADR-001-arquitectura-inicial.md#adr-0041-almacenamiento-local-de-evidencias-en-carpeta-del-ticket-frente-a-sincronización-automática-con-google-drive).

### **2.2. Descripción de componentes principales:**

El PRD (sección "Alcance del MVP") y el ADR-001 definen los siguientes componentes funcionales, agrupados por capa, ya con su decisión tecnológica aprobada (sin especificar todavía lenguaje/framework de implementación):

**TUI Layer**

- **Controlador de interfaz de consola (Windows):** único punto de entrada del usuario (`devflow start <ID>` y comandos relacionados). Se comunica con el Orquestador de forma **asíncrona basada en eventos de progreso** (`onStep(paso, estado)`), no mediante una única llamada bloqueante — esto le permite renderizar spinners/estado en vivo durante los pasos que pueden tardar (consulta a Jira, procesamiento con Ollama) en vez de quedar "congelada" hasta el resultado final. Renderiza también prompts (incluida la carga manual del fallback de Jira), menús de selección y el resumen final de la ejecución; nunca accede directamente a la Storage Layer ni a servicios externos — todo pasa por el Orquestador de la Service Layer. Decisión: [ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb) — CLI/TUI frente a GUI/Web.

**Service Layer** *(orquestador de pasos independientes — ver [ADR-001, §0](ADR-001-arquitectura-inicial.md#0-evaluación-del-patrón-arquitectónico-modular-propuesto-tui-layer--service-layer--storage-layer))*

Toda la configuración que necesitan estos componentes (token de Jira, host/modelo de Ollama, rutas de repositorios, timeouts) se resuelve **una única vez**, al arrancar la herramienta, leyéndola del `SQLite Storage Manager`; el Orquestador la inyecta por constructor a cada componente. Ninguno de los componentes de integración (Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager) lee configuración por su cuenta ni accede directamente a SQLite — esto los mantiene fácilmente testeables con mocks simples de configuración.

- **Orquestador de Ticket:** coordina la secuencia de pasos (Jira → Git → FileSystem → Ollama) sin acoplarlos entre sí, emitiendo un evento de progreso por paso hacia la TUI. Cada paso devuelve `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante` y el orquestador decide cómo continuar sin abortar el flujo completo ante un fallo aislado; ante `ErrorBloqueante` detiene el flujo y reporta qué pasos sí se completaron. Es el **único** componente que escribe en `ticket_logs` (ver Storage Layer), al finalizar el flujo, con el resultado agregado de todos los pasos — ningún componente de integración escribe en SQLite directamente.
- **Jira REST Client:** consulta **directamente** los endpoints REST de Jira (`GET /rest/api/*/issue/{id}`) — sin intermediar un MCP Server (p. ej. Atlassian Rovo MCP) — autenticado mediante API Token/PAT (sin OAuth con navegador). Parsea la respuesta JSON con un mapeo determinista a `ContextoTicket`, sin consumir presupuesto de contexto de ningún LLM para esta operación. Aplica **un único reintento con backoff corto** (p. ej. 2s) ante un timeout antes de declarar el fallo, y clasifica el resultado en al menos cuatro causas — red caída/timeout persistente, token inválido/expirado (401/403), ticket inexistente (404), límite de peticiones excedido (429, respetando el header `Retry-After` si Jira lo envía) — devolviendo `FallbackManual` con el motivo cuando corresponde. Recibe `jira_base_url`, `jira_api_token` y `jira_timeout_seconds` (tabla `app_config`, ver §3) inyectados por el Orquestador. Es el único componente que conoce el contrato de la API de Jira, aislando ahí cualquier cambio de versión de esa API. Opera sobre un único repositorio por ejecución (sin soporte multi-repo en una misma corrida). Decisiones: [ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb) y [ADR-005.1](ADR-001-arquitectura-inicial.md#adr-0051-integración-directa-con-jira-rest-api-frente-a-consumo-vía-mcp-server) — REST directo frente a consumo vía MCP Server.
- **Ollama AI Transformer (con Fallback):** arma el prompt a partir del contexto del ticket e invoca el modelo local vía HTTP, esperando una respuesta en **JSON estructurado** (`{ contexto, casosDeUso, gherkin }`), validada contra un schema antes de renderizarse a Markdown. Si el servicio no responde a tiempo, no está disponible, no tiene el modelo instalado, **o responde pero el JSON no valida contra el schema (incluye código fuente, está mal formado, o le faltan campos)**, retorna `FallbackDeterminista`: el texto crudo de Jira sin estructurar, marcado con `⚠️ Generado sin Ollama`. Esta validación de forma es lo que hace verificable en código la garantía del PRD de que el LLM nunca inserta código fuente en el documento. Recibe `ollama_host`, `ollama_model` y `ollama_timeout_seconds` inyectados por el Orquestador. Decisión: [ADR-003.1](ADR-001-arquitectura-inicial.md#adr-0031-llm-local-ollama-con-fallback-determinista-frente-a-apis-cloud-openaianthropic).
- **Git Manager:** resuelve la ruta local del repositorio a partir de la configuración por proyecto (tabla `projects_config`, ver §3), calcula el nombre de rama estandarizado (`feature|bugfix/ID-resumen`) y ejecuta **exclusivamente** la creación/cambio de rama (`git checkout -b`) sobre el repositorio del desarrollador. Detecta y reporta el caso de rama ya existente. **Su única escritura sobre el repositorio del proyecto es la rama en sí**: no hace `commit`, no hace `add`, no hace `push` ni modifica ningún archivo trackeado del repositorio — el código y los archivos del proyecto de desarrollo quedan intactos, tal como estaban antes de ejecutar la herramienta.

  **Alcance de la validación (deliberadamente mínimo para el MVP):** antes de crear la rama, el Git Manager solo verifica (a) que el repositorio local exista en la ruta configurada y (b) que la rama a crear no exista ya. El resultado que reporta al Orquestador se limita a: rama creada (con su nombre) / rama no creada porque ya existía. **No** valida estado del working directory, no hace `fetch`/`pull` de la rama base, ni detecta bloqueos del repositorio (p. ej. `.git/index.lock`) — cualquier otro problema de Git (repositorio bloqueado, cambios sin commitear, permisos, conflictos) queda fuera del alcance de la herramienta y es responsabilidad del desarrollador resolverlo manualmente con su cliente Git habitual.
- **FileSystem Manager:** crea la estructura `/ticket-ID/adjuntos/` y escribe el documento Markdown (combinando el resultado del Ollama AI Transformer en Fase 1 con la plantilla estática de Fase 2) **enteramente fuera del repositorio Git del proyecto**, en una ubicación separada del sistema de archivos local de la PC Windows del desarrollador (p. ej. `%USERPROFILE%\DevFlowCLI\tickets\ID-123\`), no dentro de `<repo>\...`. Este componente **no interactúa con Git en absoluto**: no crea, modifica ni referencia ningún archivo dentro del repositorio del proyecto donde se desarrolla — el repositorio de código permanece sin cambios salvo por la rama creada por el Git Manager. Esta separación es intencional: evita que carpetas/documentos de gestión del ticket terminen commiteados, trackeados o siquiera visibles para Git, y confirma que la persistencia de evidencias/documentación es exclusivamente local a la máquina Windows del desarrollador (sin sincronización remota en el MVP). Es **idempotente solo para la Fase 1**: si el ticket ya fue iniciado antes, una reejecución (p. ej. para reprocesar tras un `FallbackDeterminista` de Ollama) regenera únicamente las secciones auto-generadas del documento, preservando siempre el contenido de Fase 2 que el desarrollador ya haya completado (Objetos Modificados, Evidencias, Pasaje a Producción). No escribe bytes directamente a disco: delega esa operación al `Local File Storage` de la Storage Layer, limitándose a decidir *qué* escribir, con qué plantilla y en qué ruta. Decisión: [ADR-004.1](ADR-001-arquitectura-inicial.md#adr-0041-almacenamiento-local-de-evidencias-en-carpeta-del-ticket-frente-a-sincronización-automática-con-google-drive) — carpeta local frente a sincronización con Google Drive.

**Storage Layer**

- **SQLite Storage Manager:** único componente del sistema con acceso a `app_config`, `projects_config` y `ticket_logs` (esquema detallado en `003-modelo-de-datos.md`) — ningún otro componente lee ni escribe SQLite directamente (ver nota del diagrama de componentes más arriba). Expone también las consultas agregadas que alimentan la métrica "tasa de éxito sin fallback" del PRD. Decisión: [ADR-002.1](ADR-001-arquitectura-inicial.md#adr-0021-persistencia-en-sqlite-embebida-frente-a-archivos-planos-jsonyaml) — SQLite embebida frente a archivos planos.
- **Local File Storage:** capa de acceso a disco sin conocimiento del dominio del ticket — expone únicamente operaciones genéricas (`write(path, content)`, `exists(path)`) usadas por el `FileSystem Manager` de la Service Layer para persistir el documento Markdown y crear la carpeta de adjuntos. Al no conocer el dominio, mantiene la Storage Layer simétrica entre SQLite (datos estructurados) y disco (archivos), sin lógica de negocio filtrándose a esta capa.

[A definir] — tecnología/lenguaje concreto de implementación de cada componente y la definición exacta de campos de `ContextoTicket` y del schema JSON validado del Ollama AI Transformer (el contrato de resultado entre capas — `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`, comunicación por eventos de progreso, e inyección de configuración por constructor — ya quedó fijado arriba).

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

Árbol de directorios representativo del repositorio de la herramienta, alineado a las 3 capas del ADR-001. Las extensiones de archivo (`.ts`) son ilustrativas: el lenguaje/runtime concreto aún no está decidido (ver §2.2) y quedará fijado en un ADR posterior.

```
devflow-cli/
├── docs/                          # PRD, ADRs, especificación de arquitectura y de datos
│   ├── PRD.md
│   ├── ADR-001-arquitectura-inicial.md
│   ├── 002-arquitectura-del-sistema.md
│   └── 003-modelo-de-datos.md
├── src/
│   ├── tui/                       # TUI Layer
│   │   ├── controller.ts          # Parseo de comandos y ciclo de vida de la sesión interactiva
│   │   ├── prompts/                # Prompts de selección, confirmación y carga manual (fallback)
│   │   └── views/                  # Renderizado de progreso y resumen final
│   ├── services/                   # Service Layer
│   │   ├── orchestrator/
│   │   │   └── ticket-orchestrator.ts   # Coordina los pasos independientes (Jira/Git/FS/Ollama)
│   │   ├── jira/
│   │   │   └── jira-rest-client.ts      # Cliente REST + clasificación de errores (red/token/404)
│   │   ├── ollama/
│   │   │   └── ollama-ai-transformer.ts # Prompt building + parseo + fallback determinista
│   │   ├── git/
│   │   │   └── git-manager.ts           # Cálculo de nombre de rama + creación/cambio de rama
│   │   └── filesystem/
│   │       └── filesystem-manager.ts    # Creación de carpetas y escritura del documento Markdown
│   ├── database/                   # Storage Layer (SQLite)
│   │   ├── sqlite-storage-manager.ts
│   │   ├── migrations/             # Migraciones versionadas del esquema (ver §3.2)
│   │   └── schema.sql
│   └── shared/                     # Tipos, configuración y errores comunes a las 3 capas
│       ├── config/
│       ├── errors/                 # Tipos Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante
│       └── types/
├── templates/
│   └── ticket-document.md.hbs      # Plantilla del documento: Fase 1 (generada) + Fase 2 (a completar)
├── tests/
│   ├── unit/                       # Pruebas por componente (mocks de Jira/Ollama/Git/SQLite)
│   └── integration/                # Pruebas del flujo E2E descrito en el diagrama de secuencia (§2.1)
└── README.md
```

**Responsabilidad de cada carpeta principal:**

| Carpeta | Responsabilidad |
|---|---|
| `docs/` | Fuente de verdad de producto y arquitectura (PRD, ADRs, especificaciones). No contiene código. |
| `src/tui/` | TUI Layer: toda interacción con el desarrollador vía consola. No conoce a Jira, Git, Ollama ni SQLite directamente. |
| `src/services/` | Service Layer: un submódulo por integración (`jira/`, `ollama/`, `git/`, `filesystem/`) más el `orchestrator/` que los coordina. Cada submódulo encapsula su propio manejo de fallos. |
| `src/database/` | Storage Layer: acceso a SQLite y control de versiones del esquema (migraciones). |
| `src/shared/` | Contratos (tipos de resultado, configuración, errores) usados por las tres capas, para no duplicar definiciones entre ellas. |
| `templates/` | Plantilla del documento Markdown en sus dos fases (§ Alcance del MVP del PRD). |
| `tests/` | Pruebas unitarias por componente e integración del flujo E2E completo. |

### **2.4. Infraestructura y despliegue**

[A definir en Entrega 2]

### **2.5. Seguridad**

Prácticas ya decididas a nivel arquitectónico (ver ADR-001):

- **Autenticación sin navegador:** el acceso a Jira se realiza mediante API Token / Personal Access Token configurado localmente, sin flujo OAuth con redirección a navegador ([ADR-001.1](ADR-001-arquitectura-inicial.md#adr-0011-interfaz-clitui-frente-a-aplicación-gráfica-guiweb)), reduciendo la superficie de ataque de la herramienta (sin servidor/puerto local expuesto).
- **No exfiltración de datos a terceros:** el procesamiento de texto de tickets se realiza con un LLM local (Ollama); ningún contenido de ticket sale de la red del equipo hacia un proveedor cloud ([ADR-003.1](ADR-001-arquitectura-inicial.md#adr-0031-llm-local-ollama-con-fallback-determinista-frente-a-apis-cloud-openaianthropic)).

[A definir] — cómo se almacena el API Token en SQLite (en claro vs. cifrado con DPAPI de Windows u otro mecanismo) y política de rotación/expiración de credenciales.

### **2.6. Tests**

[A definir]
