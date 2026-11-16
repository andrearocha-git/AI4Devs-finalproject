## 7. Pull Requests

**Pull Request 1**

### 🚀 Pull Request: Entrega 1 — Especificación de producto, arquitectura, modelo de datos, historias de usuario y tickets de DevFlow CLI

- **Rama:** `feature/entrega-1-ANR` → `main`

#### 📌 Resumen Ejecutivo

- **Propósito:** Define la especificación completa de **DevFlow CLI** antes de escribir código, con un enfoque Spec-Driven y Docs-as-Code: PRD, decisiones de arquitectura (ADR), evaluación del stack, modelo de datos SQLite, historias de usuario y tickets técnicos. Estos documentos serán la fuente de verdad para implementar el MVP en la próxima entrega. También se consolida el `README.md` con el esqueleto fijo del curso (secciones 0–7) y se registran los prompts usados con asistencia de IA.
- **Historias de Usuario / Tickets Relacionados:** US-01, US-02, US-03 · TK-01, TK-02, TK-03 (se **especifican** en esta PR; su implementación queda para la próxima entrega).

#### 🛠️ Cambios Generados por Capa

- **🗄️ Base de Datos / Persistencia:** N/A (sin cambios de código). Solo se especifica el esquema en `docs/003-modelo-de-datos.md`: tablas `app_config` (singleton), `projects_config` y `ticket_logs`, con diagrama ER en Mermaid y DDL de SQLite.
- **⚙️ Backend / Servicios:** N/A (sin cambios de código). Solo se especifican los componentes de la Service Layer en `docs/002-arquitectura-del-sistema.md` §2.2: Orquestador de Ticket, Jira REST Client, Ollama AI Transformer con fallback, Git Manager y FileSystem Manager, además del contrato de resultado `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.
- **🖥️ Frontend / TUI:** N/A (sin cambios de código). Solo se especifica el controlador de consola para Windows (TUI Layer) y se detalla en TK-03.
- **📄 Documentación / Specs:**
  - PRD con alcance del MVP, non-goals y criterios de éxito medibles; incorpora los parches de una auditoría de producto.
  - ADR-001 (formato MADR): evaluación del patrón de 3 capas (§0) y las decisiones ADR-001.1 a ADR-005.1 (CLI/TUI, SQLite, Ollama local con fallback, evidencias fuera del repo, Jira REST directo sin MCP).
  - ADR-006.1: evaluación comparativa del stack (Node.js/TS frente a Bash, Java, PowerShell, Python y Go) con puntuación ponderada; recomienda Node.js/TypeScript.
  - Arquitectura: diagramas Mermaid, auditoría de viabilidad técnica previa al código (§2.2.1), árbol de directorios propuesto y prácticas de seguridad.
  - Historias de usuario con criterios Given/When/Then, prioridad MoSCoW, secuencia y dependencias.
  - Tickets técnicos con archivos, contratos, criterios de aceptación y Definition of Done.
  - `README.md` unificado como único archivo canónico: se elimina `readme.md` para evitar colisiones en sistemas de archivos que no distinguen mayúsculas (Windows).
  - Guía para agentes de IA (`CLAUDE.md`, con `AGENTS.md` como enlace simbólico) y registro de prompts.

#### 📂 Lista de Archivos Creados y Modificados

- `README.md`: creado; esqueleto fijo del curso (secciones 0–7) con resúmenes cortos que enlazan a `docs/`.
- `readme.md`: eliminado; su contenido se fusionó en `README.md`.
- `CLAUDE.md`: creado; guía del repositorio para asistentes de IA (estructura de docs, decisiones de arquitectura cerradas, convenciones).
- `AGENTS.md`: creado; enlace simbólico a `CLAUDE.md`.
- `prompts.md`: modificado; resumen ejecutivo de los prompts usados, organizado por sección del curso.
- `docs/PRD.md`: creado; especificación de producto.
- `docs/ADR-001-arquitectura-inicial.md`: creado; registro de decisiones de arquitectura (§0 y ADR-001.1 a ADR-005.1).
- `docs/001-descripcion-general-del-producto.md`: creado; objetivo, funcionalidades, UX e instalación.
- `docs/002-arquitectura-del-sistema.md`: creado; diagramas, componentes, viabilidad técnica, estructura de ficheros, seguridad.
- `docs/003-modelo-de-datos.md`: creado; diagrama ER, entidades y DDL de SQLite.
- `docs/004-especificacion-de-la-api.md`: creado; aclara que la herramienta consume la API de Jira y no expone una API propia en el MVP.
- `docs/005-historias-de-usuario.md`: creado; US-01, US-02 y US-03.
- `docs/006-tickets-de-trabajo.md`: creado; TK-01 (Base de Datos), TK-02 (Backend/Servicios) y TK-03 (Frontend/TUI).
- `docs/007-pull-requests.md`: creado; registro de las Pull Requests del proyecto.
- `docs/008-evaluacion-stack-tecnologico.md`: creado; ADR-006.1, evaluación del stack de implementación.
- `docs/prompts-claude-fase-inicial.md`: creado; registro verbatim de las conversaciones con IA de la fase inicial.

#### 🧪 Pruebas y Verificación (Evidencia)

- **Comandos Ejecutados:**
  - `git diff --stat origin/main...HEAD` y `git log origin/main..HEAD` para verificar el alcance de la PR.
  - Búsqueda de secretos en las líneas agregadas del diff (`git diff origin/main...HEAD | grep -iE 'api[_-]?key|token…|ATATT|sk-…'`).
- **Resultados:**
  - La búsqueda no encontró tokens ni claves expuestas. `jira_api_token` aparece solo como nombre de columna en la especificación del modelo de datos, no como valor.
  - No hay tests automatizados porque todavía no existe código de aplicación (TK-01 a TK-03 están pendientes de implementación).

#### ✅ Checklist de Calidad (Definition of Done)

- [ ] Código compilable y libre de errores. — *N/A: la PR es solo de documentación.*
- [ ] Criterios de Aceptación verificados contra la especificación. — *N/A: los criterios se definen aquí y se verificarán al implementar.*
- [x] Documentación/Specs actualizadas y alineadas entre sí (PRD ↔ ADR ↔ docs 001–008 ↔ README).
- [x] Sin variables de entorno, claves ni tokens expuestos.

**Pull Request 2**

### 🚀 Pull Request: Entrega 2 — MVP de DevFlow CLI: `devflow config` y `devflow start` con Ollama local

- **Rama:** `feature/entrega-2-ANR` → `main`

#### 📌 Resumen Ejecutivo

- **Propósito:** Implementa el MVP especificado en la Entrega 1. Desde la terminal, `devflow start` consulta Jira, crea la rama estándar en el repositorio elegido, crea la carpeta de evidencias fuera del repo y genera con Ollama local la Fase 1 del documento Markdown; `devflow config` y `devflow config proyectos` guardan la configuración. Se instala desde un clon con `npm run build` y `npm link`, y se probó de punta a punta en Windows 11.
- **Historias de Usuario / Tickets Relacionados:** US-01, US-02, US-03 · TK-00 a TK-03 (con sus subtickets TK-02a a TK-02i y TK-03a a TK-03b3) · GH-17, GH-18, GH-19, GH-20 (instalación y prueba en Windows) y GH-44 (Fase 1 con el formato wiki de Jira).

#### 🛠️ Cambios Generados por Capa

- **🗄️ Base de Datos / Persistencia:** SQLite embebido (`node:sqlite`) con migración inicial y `SQLiteStorageManager` (`app_config`, `jira_projects`, `repositories`, `ticket_logs` con *upsert* por ticket y repositorio). Es lo único que importa `node:sqlite`.
- **⚙️ Backend / Servicios:**
  - Orquestador de ticket y de configuración; contrato de resultado `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.
  - Cliente REST de Jira (API v2, Basic email + token) con clasificación de fallos.
  - Git Manager con el flujo manual congelado: `status`, `switch`, `pull --ff-only` y `switch -c`; nunca commit, add ni push.
  - FileSystem Manager: carpeta del ticket fuera del repo, `adjuntos/` y documento por ticket y repositorio.
  - Ollama AI Transformer (`qwen2.5:3b`): JSON Schema en `format`, validación con Ajv, posprocesado y fallback determinista.
- **🖥️ Frontend / TUI:** CLI con Commander e `@inquirer/prompts`: `devflow config`, `devflow config proyectos` y `devflow start`, con resumen previo, confirmación, spinner y mensajes de fallo.
- **📄 Documentación / Specs:** plantillas versionadas en `templates/` (prompts, schemas y Handlebars para `bug` e `historia`), un contrato por ticket en `docs/changes/`, `docs/009-flujo-funcional.md`, instalación (§1.4), despliegue (§2.4), tests (§2.6) y bitácoras.

#### 📂 Lista de Archivos Creados y Modificados

- `src/database/`: esquema, migración y `SQLiteStorageManager`.
- `src/services/`: orquestador, Jira, Git, sistema de archivos y Ollama.
- `src/shared/`: tipos, configuración y contrato de resultado.
- `src/tui/`: CLI, comandos, prompts y vistas.
- `templates/`: prompts, JSON Schemas y plantillas del documento.
- `tests/`: unitarios, de integración y fixtures (unas 8.800 líneas).
- `package.json`, `tsconfig*.json`, `vitest.config.ts`, `eslint.config.js`, `scripts/copy-assets.mjs`: Node ≥ 22.13, TypeScript `strict`, Vitest, lint con reglas de capas, `build` y `bin devflow`.
- `docs/changes/`: 24 contratos (TK, GH y US-01 a US-03).

#### 🧪 Pruebas y Verificación (Evidencia)

- **Comandos Ejecutados:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build`, `npm link` y `devflow config`, `devflow config proyectos` y `devflow start` a mano.
- **Resultados:**
  - 829 tests en 36 archivos en verde; TDD con RED antes de GREEN y mutaciones temporales en 12 de los 24 contratos.
  - Cobertura de la Service Layer: 98,97 % de sentencias y 94,92 % de ramas (umbral del 80 %).
  - Prueba de aceptación en Windows 11 con repositorios de prueba, Jira Cloud real en solo lectura y Ollama (`qwen2.5:3b`, solo CPU) en WSL: camino feliz, reutilización de la Fase 1, `--reprocesar`, `--base`, token inválido, Ollama apagado, rutas con espacios y cancelación.
  - Los 22 criterios de aceptación de US-01 a US-03 tienen test.
  - `/code-review` de `src/`: 10 hallazgos, ninguno bloqueante; tres pasaron a deuda (#49, #50 y #51).
  - Video de demostración del flujo principal (configuración, `devflow start` con una historia y con un bug, y el documento generado): [https://youtu.be/i_tWna7VC9c](https://youtu.be/i_tWna7VC9c); ver también `README` §1.3.
  - No probado: Windows 10.

#### ✅ Checklist de Calidad (Definition of Done)

- [x] Código compilable y libre de errores.
- [x] Criterios de Aceptación verificados contra la especificación.
- [x] Documentación/Specs actualizadas y alineadas con el código.
- [x] Sin variables de entorno, claves ni tokens expuestos.

**Pull Request 3**

[A definir]
