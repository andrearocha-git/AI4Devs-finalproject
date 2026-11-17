# DevFlow CLI

> Herramienta CLI/TUI para Windows que elimina el cambio de contexto del desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la creación de la rama Git, la estructura de carpetas local y el documento de desarrollo (asistido por un LLM local vía Ollama).

**Versión:** v1.0 — MVP · **Entorno:** Windows 10/11 (CLI/TUI)

## Índice

0. [Ficha del proyecto](#0-ficha-del-proyecto)
1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## 0. Ficha del proyecto

### **0.1. Tu nombre completo:**

Andrea Rocha

### **0.2. Nombre del proyecto:**

DevFlow CLI

### **0.3. Descripción breve del proyecto:**

Herramienta CLI/TUI para Windows 10/11 que elimina el cambio de contexto del desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a la API de Jira, la creación de la rama Git estandarizada, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown (asistido por un LLM local vía Ollama), facilitando así el trabajo de QA/Testing y el pasaje a producción.

### **0.4. URL del proyecto:**

https://github.com/andrearocha-git/AI4Devs-finalproject

### 0.5. URL o archivo comprimido del repositorio

https://github.com/andrearocha-git/AI4Devs-finalproject

---

## 1. Descripción general del producto

> Detalle completo en [`docs/001-descripcion-general-del-producto.md`](docs/001-descripcion-general-del-producto.md).

### **1.1. Objetivo:**

DevFlow CLI elimina el cambio de contexto (*context switching*) que sufre un desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a Jira, la creación de la rama Git, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown. Aporta valor a tres perfiles: al **desarrollador** (un solo comando reemplaza cuatro herramientas: Jira, terminal de Git, explorador de archivos y Google Drive), a **QA/Testing** (documento con estructura idéntica en todos los tickets del mismo tipo) y a **DevOps** (registro homogéneo y trazable de objetos modificados). Resuelve la falta de estandarización y la fricción de un equipo de 5 ingenieros que trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular).

### **1.2. Características y funcionalidades principales:**

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Alta de una o más claves de proyecto de Jira (validadas contra Jira), cada una con 0..N repositorios opcionales (nombre, ruta local y rama base) y un sufijo de usuario para las ramas.
- Integración REST con Jira Cloud (API v2), autenticada con email + API Token (sin OAuth con navegador), con fallback manual ante fallos de red, token inválido/expirado o ticket inexistente. `devflow start` sin ID lista los tickets abiertos asignados al usuario; las épicas no generan rama ni documento.
- Creación automática de la rama de Git `<prefijo>/<ID>-<SUFIJO>` (`features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`) desde la rama base actualizada del repositorio elegido; se detiene si hay cambios pendientes y nunca hace commit, add ni push. Una ejecución por repositorio.
- Procesamiento con un LLM local (Ollama, modelo mínimo `qwen2.5:3b`) con salida estructurada para autogenerar Descripción y Contexto, Casos de Uso y Criterios de Aceptación en Gherkin; si Ollama no está disponible, el flujo continúa con el texto crudo sin estructurar.
- Creación automática de la estructura de carpetas local por ticket y repositorio (`<raíz>\ID\<repositorio>\adjuntos\`), fuera del repositorio Git versionado.
- Plantilla del documento por tipo de issue (bug o historia), en dos fases: Fase 1 (auto-generada al crear el ticket) y Fase 2 (completada por el desarrollador durante el ciclo de vida del ticket).

**Fuera de alcance en el MVP (Non-Goals):** generación de código por parte del LLM, interfaz gráfica/web, autenticación OAuth con navegador, soporte multi-repositorio en una misma ejecución (un ticket con varios repositorios se ejecuta una vez por cada uno), y sincronización automática con Google Drive (diferida a v2). Detalle completo en [`docs/PRD.md`](docs/PRD.md#4-límites-explícitos-out-of-scope--non-goals).

### **1.3. Diseño y experiencia de usuario:**

[![Demostración de DevFlow CLI (video de YouTube)](https://img.youtube.com/vi/i_tWna7VC9c/maxresdefault.jpg)](https://youtu.be/i_tWna7VC9c)

**Videotutorial:** [Demostración del flujo principal en YouTube](https://youtu.be/i_tWna7VC9c)

DevFlow CLI es una herramienta solo de terminal, sin interfaz gráfica, así que la experiencia de usuario se muestra en un video de demostración. Recorre el flujo completo:

1. **Configuración inicial** (`devflow config`): URL de Jira, email, API token (oculto al escribirlo), carpeta de tickets fuera de los repositorios y sufijo de las ramas.
2. **Proyectos y repositorios** (`devflow config proyectos`): alta de la clave `SCRUM`, validada contra Jira, y de sus repositorios con ruta local y rama base.
3. **Iniciar un ticket** (`devflow start`): lista de tickets asignados, elección de una historia, resumen previo con la rama (`features/SCRUM-7-AROCHA`), la carpeta y el repositorio, creación de la rama y de la carpeta de evidencias, y generación del documento con Ollama local.
4. **El documento generado**: tabla de datos del ticket, Fase 1 completada por la IA (descripción, historia de usuario, criterios Given/When/Then, casos de uso y preguntas abiertas) y Fase 2 para el desarrollador.
5. **Un bug en una clave con dos repositorios**: el programa pregunta en cuál trabajar y usa el prefijo `bugs/` en la rama.

Los pasos se detallan en [`docs/009-flujo-funcional.md`](docs/009-flujo-funcional.md).

### **1.4. Instrucciones de instalación:**

> Detalle completo (datos locales, actualización y solución de problemas) en [`docs/001-descripcion-general-del-producto.md`](docs/001-descripcion-general-del-producto.md#14-instrucciones-de-instalación). Entorno: Windows 10/11; el paquete es privado y se instala desde un clon del repositorio.

**Requisitos previos:** Node.js ≥ 22.13, Git (con acceso a `origin`), Ollama activo con el modelo `qwen2.5:3b` (`ollama pull qwen2.5:3b`), y el email de tu cuenta de Jira con un API Token clásico (id.atlassian.com).

**Instalación y actualización con un comando (recomendada):** `scripts/install.ps1` (Windows PowerShell 5.1 o PowerShell 7) comprueba Node.js, Git y Ollama, clona el repositorio en `%USERPROFILE%\DevFlowCLI\app`, compila y crea el comando `devflow`. Si ya está instalado, trae las novedades con `git pull --ff-only`, recompila y vuelve a enlazar con `npm link`; si el clon tiene cambios locales o su rama diverge de `origin`, se detiene sin tocar nada. Parámetros: `-Rama` (por defecto `final-project-ANR`, hasta que `main` tenga el código), `-Carpeta` y `-Repositorio`.

```text
Invoke-WebRequest https://raw.githubusercontent.com/andrearocha-git/AI4Devs-finalproject/final-project-ANR/scripts/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**Instalación manual (alternativa):**

```text
git clone https://github.com/andrearocha-git/AI4Devs-finalproject.git
cd AI4Devs-finalproject
npm install
npm run build
npm link
devflow --help
```

> Procedimiento verificado en WSL y en Windows 11 (PowerShell y `cmd`): `npm run build`, `npm link` y `devflow --help`. El uso completo (`devflow config`, `devflow config proyectos` y `devflow start`) se verificó a mano en Windows 11 el 2026-11-15 (issue #20), con Jira real en solo lectura, repositorios de prueba con `origin` local y el Ollama de WSL (servicio al que Windows llega por `localhost:11434`), en Windows PowerShell 5.1, `cmd` y Windows Terminal. Windows 10 entra en el criterio del producto (Windows 10/11), pero no se probó en esta entrega.

**Primer arranque:** `devflow config` (Jira, carpeta de tickets y sufijo de rama), `devflow config proyectos` (claves de proyecto y repositorios) y `devflow start [ID]` (prepara un ticket). La base `devflow.db` y sus migraciones se crean solas en `%APPDATA%\DevFlowCLI\`; no hay semillas de datos ni servidor. **El API Token se guarda en claro** en esa base (decisión del MVP, ver [`docs/002`](docs/002-arquitectura-del-sistema.md)).

**Cómo verificarlo**

No hace falta ninguna credencial para comprobar el trabajo, y el repositorio no contiene secretos: hay dos caminos.

1. **Sin credenciales: la suite automática.** Con Node.js ≥ 22.13 y Git, desde la raíz del repositorio: `npm install` y `npm test` (39 archivos y 858 tests, unos 45 s). Jira y Ollama están **simulados** (`msw`), así que no necesita red, ni cuenta de Jira, ni Ollama; el recorrido de `devflow start` se ejecuta con Git, carpetas y SQLite reales (`tests/integration/ticket-flow.e2e.test.ts`). Se complementa con `npm run typecheck`, `npm run lint` y `npm run test:coverage` (umbral del 80 % en la Service Layer). Los tests del instalador necesitan PowerShell y se omiten si no hay; en Windows se omite además el del enlace simbólico.
2. **Con tu propio Jira: el recorrido manual (Windows 10/11).** No se comparte ninguna cuenta ni token de prueba. Necesitas una cuenta de Jira Cloud con un API Token, un repositorio Git local con `origin` y, si quieres ver la Fase 1 redactada, Ollama con `qwen2.5:3b` (sin Ollama el flujo sigue y lo dice). Instala con `scripts/install.ps1` (arriba) y luego:
   - `devflow config`: URL `https://<sitio>.atlassian.net`, email, API Token, carpeta de tickets y sufijo de rama.
   - `devflow config proyectos`: una clave de proyecto (se valida contra Jira) y la ruta de tu repositorio.
   - `devflow start <ID>` (o sin ID, para elegir de tus tickets asignados): debería crear la rama `features/<ID>-<SUFIJO>` (`bugs/…` si es un Bug), la carpeta `<carpeta de tickets>\<ID>\<repositorio>\adjuntos\` y el documento Markdown, y mostrar un resumen.
   - Casos que conviene probar: Ollama apagado (el documento lleva `⚠️ Generado sin Ollama`), token inválido (ofrece cargar el ticket a mano), repositorio con cambios pendientes o ticket de tipo Épica (se detiene sin crear nada) y cancelar con Ctrl+C (código 130). La aplicación solo **lee** de Jira y nunca hace `commit`, `add` ni `push`.

Los 9 criterios de este recorrido se ejecutaron a mano en Windows 11 el 2026-11-15 con Jira real (contrato [`docs/changes/GH-20.md`](docs/changes/GH-20.md)).

---

## 2. Arquitectura del Sistema

> Detalle completo (diagramas Mermaid, decisiones de arquitectura) en [`docs/002-arquitectura-del-sistema.md`](docs/002-arquitectura-del-sistema.md) y [`docs/ADR-001-arquitectura-inicial.md`](docs/ADR-001-arquitectura-inicial.md).

### **2.1. Diagrama de arquitectura:**

Patrón de 3 capas (TUI Layer / Service Layer / Storage Layer). Diagrama de componentes y diagrama de secuencia E2E (Mermaid) en `docs/002-arquitectura-del-sistema.md`, §2.1.

### **2.2. Descripción de componentes principales:**

Detalle de cada componente por capa (Controlador CLI/TUI, Orquestador de Ticket, Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager, SQLite Storage Manager, Local File Storage) en `docs/002-arquitectura-del-sistema.md`, §2.2. Incluye el sub-apartado **§2.2.1 — Viabilidad Técnica de Componentes e Integraciones Pre-Código** (matriz de viabilidad, requisitos previos del entorno Windows, análisis de riesgos y el dictamen: **arquitectura 100% viable y construible desde cero**).

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Stack técnico (ADR-006.1, aceptado):** **TypeScript `strict` sobre Node.js ≥ 22.13**, con `node:sqlite` (sin compilación nativa), **Commander** + **`@inquirer/prompts`** + un spinner simple para la interfaz de terminal (sin Ink), Handlebars, Ajv, Vitest y msw. La comparación frente a Bash + curl + jq, Java CLI, PowerShell, Python y Go, según las restricciones de hardware del equipo (8 GB de RAM, ~35 GB libres, IDEs pesados abiertos a la vez), está en `docs/008-evaluacion-stack-tecnologico.md`. Árbol de directorios completo (`/src/tui`, `/src/services`, `/src/database`, `/src/shared`, `/docs`, `/templates` con prompts, schemas y plantillas versionados, `/tests`) y tabla de responsabilidad/lenguaje/reglas de acoplamiento por carpeta en `docs/002-arquitectura-del-sistema.md`, §2.3.

**Convención de documentación del código:** toda API pública de `src/` (clases, métodos públicos, funciones y tipos exportados) lleva **TSDoc en español** (`/** … */`), con `@param`, `@returns` y `@throws` donde apliquen, explicando el comportamiento no obvio (qué devuelve si no encuentra, cuándo lanza, efectos secundarios). La regla está en `CLAUDE.md` (sección Conventions), la aplica `/04-tdd-pair` al refactorizar y `/05-verificar-y-revisar` la revisa como observación.

### **2.4. Infraestructura y despliegue**

DevFlow CLI **no tiene infraestructura propia**: no hay servidor, base de datos remota, contenedores ni nube. Es una CLI que corre en el PC Windows 10/11 del desarrollador y solo habla con Jira Cloud (HTTPS), con el `origin` de sus repositorios (`git pull`) y con un Ollama local. El «despliegue» es la **instalación local desde un clon**: `npm install`, `npm run build` (compila `src/` a `dist/` y copia las migraciones SQL) y `npm link`, que crea el comando `devflow` (§1.4). Para actualizar: `git pull`, `npm install` y `npm run build`.

Verificado a mano en Windows 11 (PowerShell 5.1 y `cmd`); Windows 10 no se probó. **No hay** CI/CD, ejecutable empaquetado, publicación en npm ni entornos separados: cada desarrollador tiene su propia instancia local. Diagrama de infraestructura, entorno de ejecución y comprobaciones en `docs/002-arquitectura-del-sistema.md`, §2.4.

### **2.5. Seguridad**

Prácticas ya decididas (autenticación contra Jira sin navegador vía API Token, sin exfiltración de datos a un LLM cloud) en `docs/002-arquitectura-del-sistema.md`, §2.5.

### **2.6. Tests**

Los tests se escriben con **TDD** (Red → Green → Refactor) con Vitest, a partir de los escenarios Given/When/Then de un contrato por cambio (`docs/changes/<ID>.md`), que enlaza cada escenario con su test. Hay tres capas:

- **Unitarias** (`tests/unit/`, por capa; Jira y Ollama simulados con `msw`). Dos ejemplos: el «Contrato del flujo» de `git-manager.test.ts`, que fija la secuencia exacta de comandos Git (`status`, `switch`, `pull --no-rebase --ff-only`, `switch -c`) y no se «arregla» si falla; y `postprocess.historia.test.ts`, que comprueba que la Fase 1 conserva la historia de usuario y los criterios Gherkin con el formato wiki de Jira.
- **Integración** (`tests/integration/`): `ticket-flow.e2e.test.ts` (11 casos) recorre `devflow start` completo con Git, carpetas y SQLite reales; solo Jira y Ollama se simulan. `build-install.test.ts` compila a una carpeta temporal y ejecuta `devflow --help` como proceso hijo.
- **Manual en Windows 11** (issue #20): recorrido con Jira real (solo lectura), repositorios de prueba y Ollama real, con 9 criterios. Sus hallazgos están en los issues #39 y #44; el segundo ya está corregido.

Cada escenario se comprueba primero en RED. En 13 de los 25 contratos se comprueba además, tras el GREEN, con **mutaciones temporales**: se rompe el código a propósito y el test debe fallar. Resultado: 39 archivos y 858 tests en verde. La Service Layer (`src/services/**`) tiene un umbral de cobertura del 80 % (decidido en TK-02a, con `npm run test:coverage`) y hoy mide 98,97 % de sentencias, 94,92 % de ramas, 100 % de funciones y 99,69 % de líneas.

*Evaluado y descartado:* Cucumber.js (duplicaría los escenarios de los contratos); Playwright, Cypress y Testing Library no aplican, porque el producto es solo CLI/TUI.

---

## 3. Modelo de Datos

> Detalle completo en [`docs/003-modelo-de-datos.md`](docs/003-modelo-de-datos.md).

### **3.1. Diagrama del modelo de datos:**

Diagrama ERD (Mermaid) de `app_config`, `jira_projects`, `repositories` y `ticket_logs`, con claves y cardinalidades, en `docs/003-modelo-de-datos.md`, §3.1.

### **3.2. Descripción de entidades principales:**

Atributos, tipos, restricciones (`CHECK`, `UNIQUE`, `FOREIGN KEY`) y DDL completo de SQLite para las 4 entidades en `docs/003-modelo-de-datos.md`, §3.2.

---

## 4. Especificación de la API

Detalle completo en [`docs/004-especificacion-de-la-api.md`](docs/004-especificacion-de-la-api.md). En resumen: DevFlow CLI no expone una API propia en el MVP — es una herramienta CLI/TUI sin interfaz web (ver Non-Goals del PRD). Sus integraciones por API son como **consumidora** de dos servicios: la API REST v2 de Jira Cloud (solo lectura: ticket, validación de proyectos, tickets abiertos y `/myself`, para el nombre del desarrollador y para interpretar un 404) para extraer el contexto de los tickets, y la API local de Ollama (`POST /api/generate` con el JSON Schema en `format`) para redactar la Fase 1 del documento. El detalle de endpoints, autenticación y errores está en `docs/004`.

---

## 5. Historias de Usuario

> Documenta 3 de las historias de usuario principales utilizadas durante el desarrollo, teniendo en cuenta las buenas prácticas de producto al respecto.

> Detalle completo (criterios de aceptación Given/When/Then/And) en [`docs/005-historias-de-usuario.md`](docs/005-historias-de-usuario.md).

**Historia de Usuario 1: Configuración inicial de claves de proyecto, repositorios y sufijo de usuario**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Como desarrollador, quiero dar de alta una o más claves de proyecto de Jira, asociarles opcionalmente mis repositorios locales (con su rama base) y fijar mi sufijo de usuario para las ramas, para que la herramienta sepa siempre con qué tickets y repositorios trabajar sin tener que indicárselo cada vez que inicio un ticket.

**Historia de Usuario 2: Selección y consulta de ticket de Jira con fallback manual**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Medio · Dependencias: US-01*

Como desarrollador, quiero elegir de una lista mis tickets abiertos (o indicar el ID de uno) y que la herramienta obtenga automáticamente su título, su descripción y su tipo, para no tener que abrir el navegador ni copiar esa información manualmente; si la consulta falla, quiero poder cargar los datos a mano y seguir trabajando sin interrupciones.

**Historia de Usuario 3: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Alto · Dependencias: US-01, US-02*

Como desarrollador, quiero que la herramienta prepare en un solo paso, para el repositorio que elijo, la rama de trabajo, la carpeta de evidencias y el documento inicial del ticket, para empezar a trabajar de inmediato sin ejecutar cada paso manualmente ni redactar el documento desde cero.

---

## 6. Tickets de Trabajo

> Documenta 3 de los tickets de trabajo principales del desarrollo, uno de backend, uno de frontend, y uno de bases de datos. Da todo el detalle requerido para desarrollar la tarea de inicio a fin teniendo en cuenta las buenas prácticas al respecto. 

> Detalle técnico completo (archivos, contratos, criterios de aceptación técnicos y Definition of Done) en [`docs/006-tickets-de-trabajo.md`](docs/006-tickets-de-trabajo.md).

**Ticket 1 (Base de Datos) — TK-01: Implementación del Esquema SQLite (DDL) y del módulo SQLite Storage Manager**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Crea las tablas `app_config`, `jira_projects`, `repositories` y `ticket_logs` (con sus constraints e índices), el sistema de migraciones versionadas, y el módulo que centraliza todo el acceso a SQLite (`node:sqlite`) — único componente del sistema que lee/escribe la base de datos. Vinculado a US-01, US-02 y US-03.

**Ticket 2 (Backend / Servicios) — TK-02: Implementación de Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Alto · Dependencias: TK-01*

Implementa la consulta directa a Jira (con reintento, clasificación de fallos y la regla del 404 con `/myself`), el procesamiento con Ollama (salida estructurada validada con Ajv, posprocesado determinista y fallback sin código generado), la creación de la rama Git desde la base actualizada (con `git status` previo y sin commit, add ni push) y la generación de la carpeta de evidencias y el documento Markdown en dos fases, todo coordinado por un orquestador que emite eventos de progreso. Vinculado a US-02 y US-03. Por su tamaño se dividió en siete sub-tickets (TK-02a a TK-02g: base compartida, Jira, Git, FileSystem, Ollama, flujo del Orquestador y gestión de configuración), cada uno con su contrato en `docs/changes/`.

**Ticket 3 (Frontend / TUI) — TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Medio · Dependencias: TK-01, TK-02f, TK-02g, TK-02h*

Implementa los comandos `devflow start [ID]` y `devflow config`, la validación del ID, los prompts de selección de ticket y repositorio, carga manual y confirmación, y las vistas de progreso (spinner simple, sin Ink), resumen y fallback en la terminal — la TUI nunca accede a Jira, Git, Ollama o SQLite directamente, solo al orquestador. Vinculado a US-01, US-02 y US-03. Por su tamaño se dividió en sub-tickets (TK-03a: CLI base y `devflow config`; TK-03b, a su vez dividido en TK-03b1: validación y selección, TK-03b2: carga manual y confirmación, y TK-03b3: progreso y pantallas de resultado), cada uno con su contrato en `docs/changes/`.


### Cómo se trabaja cada ticket: SDD liviano (y por qué no OpenSpec)

Cada US, TK o issue de GitHub (`GH-nn`, con `nn` el número del issue) se desarrolla con **Spec-Driven Development liviano**: un único archivo de contrato por cambio, `docs/changes/<ID>.md`, que es la fuente de verdad aunque se pierda el contexto de la conversación. Las fases, cada una con una *skill* propia en `.claude/skills/`:

1. **Refinar (`/03-refinar-historia <ID>`).** Lee la fuente (`docs/005`, `docs/006` o el issue), comprueba INVEST y redacta de 2 a 3 escenarios Given/When/Then trazados a los criterios de aceptación, los archivos afectados y un plan de máximo 5 tareas. El contrato nace en estado `Borrador`.
2. **Aprobar.** El desarrollador revisa el contrato y lo pasa a `Aprobado`. Sin contrato aprobado no se escribe código.
3. **Implementar con TDD (`/04-tdd-pair <ID>`).** Un escenario a la vez: test en rojo, código mínimo en verde y refactor (con TSDoc y reglas de capas en el lint). Cada escenario se cierra con la validación del desarrollador. Estados: `En implementación` → `Implementado`. **Cada escenario necesita un test** (o un `Sin test: <motivo>` aprobado y registrado), y un test ya aprobado solo se cambia con autorización expresa.
4. **Verificar (`/05-verificar-y-revisar <ID>`).** Solo lectura: `typecheck`, `lint` y la suite completa, y una auditoría del diff contra el contrato (trazabilidad, tareas, desvíos). Emite un veredicto: Aprobada, Aprobada con observaciones o No aprobada.
5. **Revisión externa y PR.** Una PR por ticket hacia `feature/entrega-2-ANR`; la revisa otra herramienta (Cursor), distinta de la que implementó, y los hallazgos se corrigen con TDD. La PR la fusiona el desarrollador, y `Closes #nn` cierra el issue.

**Por qué no OpenSpec.** Se evaluó y se descartó para este proyecto: el flujo de arriba ya cubre lo mismo (propuesta, especificación, tareas y verificación) y además impone reglas propias (un test por escenario, tests aprobados protegidos, qué archivos puede tocar cada fase). Adoptar OpenSpec habría obligado a mantener dos sistemas de contratos (`openspec/` y los 15 ya escritos en `docs/changes/`) o a reescribirlos, y sumaría una dependencia sin aportar nada al producto que se entrega. Su ventaja —especificaciones archivadas como documentación viva— compensa más en un proyecto largo con muchos cambios que en esta entrega. El formato actual se inspira en OpenSpec, sin su herramienta.

---

## 7. Pull Requests

> Documenta 3 de las Pull Requests realizadas durante la ejecución del proyecto

> Detalle completo (cambios por capa, archivos, verificación y checklist) en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

**Pull Request 1**

**Entrega 1 — Especificación de producto, arquitectura, modelo de datos, historias de usuario y tickets de DevFlow CLI** (`feature/entrega-1-ANR` → `main`). PR de solo documentación: PRD, ADR-001 y ADR-006.1 (evaluación del stack), arquitectura, modelo de datos SQLite, historias de usuario US-01 a US-03 y tickets TK-01 a TK-03, que serán la fuente de verdad para implementar el MVP. Detalle en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

**Pull Request 2**

**Entrega 2 — MVP de DevFlow CLI: `devflow config` y `devflow start` con Ollama local** (`feature/entrega-2-ANR` → `main`). Implementa el MVP especificado en la Entrega 1: base SQLite, cliente de Jira, Git Manager (flujo manual congelado), carpetas de evidencias fuera del repositorio, Fase 1 del documento con Ollama y fallback determinista, y la CLI instalable con `devflow`. 858 tests en verde, cobertura de la Service Layer del 98,97 %, prueba de aceptación en Windows 11 y [video de demostración](https://youtu.be/i_tWna7VC9c) del flujo principal. Detalle en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

**Pull Request 3**

**Entrega 3 — Instalador para Windows, especificación de la API consumida y guía de verificación** (`final-project-ANR` → `main`). Un solo comando, `scripts/install.ps1`, instala o actualiza DevFlow CLI en Windows sin pisar trabajo local (probado en Windows 11 con PowerShell 5.1, 7 y `cmd`); `docs/004` especifica los endpoints de Jira y de Ollama que la herramienta consume; y §1.4 explica cómo verificar el trabajo sin credenciales o con un Jira propio. 858 tests en verde, sin cambios en `src/`, y cinco hallazgos de la revisión externa corregidos antes de fusionar. Detalle en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

---

> Registro de los prompts utilizados durante el desarrollo con asistencia de IA: [`prompts.md`](prompts.md) (resumen ejecutivo, un prompt por sección) y [`docs/LIDR/prompts-claude-fase-inicial.md`](docs/LIDR/prompts-claude-fase-inicial.md) (registro completo, verbatim).
