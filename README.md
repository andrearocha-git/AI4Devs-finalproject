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

DevFlow CLI elimina el cambio de contexto (*context switching*) que sufre un desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a Jira, la creación de la rama Git, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown. Aporta valor a tres perfiles: al **desarrollador** (un solo comando reemplaza cuatro herramientas: Jira, terminal de Git, explorador de archivos y Google Drive), a **QA/Testing** (documento con estructura idéntica en todos los tickets) y a **DevOps** (registro homogéneo y trazable de objetos modificados). Resuelve la falta de estandarización y la fricción de un equipo de 5 ingenieros que trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular).

### **1.2. Características y funcionalidades principales:**

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Integración REST con la API de Jira, autenticada mediante API Token/PAT (sin OAuth con navegador), con fallback manual ante fallos de red, token inválido/expirado o ticket inexistente.
- Creación automática de la rama de Git (`feature/ID-123-resumen`, `bugfix/ID-123-resumen`) según la convención del equipo (una ejecución por repositorio).
- Procesamiento con un LLM local (Ollama) para autogenerar Descripción y Contexto, Casos de Uso y Criterios de Aceptación en Gherkin; si Ollama no está disponible, el flujo continúa con el texto crudo sin estructurar.
- Creación automática de la estructura de carpetas local por ticket (`/ticket-ID/adjuntos/`), fuera del repositorio Git versionado.
- Plantilla del documento en dos fases: Fase 1 (auto-generada al crear el ticket) y Fase 2 (completada por el desarrollador durante el ciclo de vida del ticket).

**Fuera de alcance en el MVP (Non-Goals):** generación de código por parte del LLM, interfaz gráfica/web, autenticación OAuth con navegador, soporte multi-repositorio en una misma ejecución, y sincronización automática con Google Drive (diferida a v2). Detalle completo en [`docs/PRD.md`](docs/PRD.md#4-límites-explícitos-out-of-scope--non-goals).

### **1.3. Diseño y experiencia de usuario:**

> Proporciona imágenes y/o videotutorial mostrando la experiencia del usuario desde que aterriza en la aplicación, pasando por todas las funcionalidades principales.

### **1.4. Instrucciones de instalación:**
> Documenta de manera precisa las instrucciones para instalar y poner en marcha el proyecto en local (librerías, backend, frontend, servidor, base de datos, migraciones y semillas de datos, etc.)

---

## 2. Arquitectura del Sistema

> Detalle completo (diagramas Mermaid, decisiones de arquitectura) en [`docs/002-arquitectura-del-sistema.md`](docs/002-arquitectura-del-sistema.md) y [`docs/ADR-001-arquitectura-inicial.md`](docs/ADR-001-arquitectura-inicial.md).

### **2.1. Diagrama de arquitectura:**

Patrón de 3 capas (TUI Layer / Service Layer / Storage Layer). Diagrama de componentes y diagrama de secuencia E2E (Mermaid) en `docs/002-arquitectura-del-sistema.md`, §2.1.

### **2.2. Descripción de componentes principales:**

Detalle de cada componente por capa (Controlador CLI/TUI, Orquestador de Ticket, Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager, SQLite Storage Manager, Local File Storage) en `docs/002-arquitectura-del-sistema.md`, §2.2. Incluye el sub-apartado **§2.2.1 — Viabilidad Técnica de Componentes e Integraciones Pre-Código** (matriz de viabilidad, requisitos previos del entorno Windows, análisis de riesgos y el dictamen: **arquitectura 100% viable y construible desde cero**).

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Stack técnico en evaluación (se cierra en la próxima entrega):** la propuesta de partida es **TypeScript sobre Node.js (LTS ≥ 20.x)**, con **Ink** (TUI basada en componentes) + **Commander** (parsing de comandos) + **`@inquirer/prompts`** para la interfaz de terminal. La comparación frente a Bash + curl + jq, Java CLI, PowerShell, Python y Go, según las restricciones de hardware del equipo (8 GB de RAM, ~35 GB libres, IDEs pesados abiertos a la vez), está en `docs/008-evaluacion-stack-tecnologico.md`. Árbol de directorios completo (`/src/tui`, `/src/services`, `/src/database`, `/src/shared`, `/docs`, `/templates`, `/tests`) y tabla de responsabilidad/lenguaje/reglas de acoplamiento por carpeta en `docs/002-arquitectura-del-sistema.md`, §2.3.

### **2.4. Infraestructura y despliegue**

> Detalla la infraestructura del proyecto, incluyendo un diagrama en el formato que creas conveniente, y explica el proceso de despliegue que se sigue

### **2.5. Seguridad**

Prácticas ya decididas (autenticación contra Jira sin navegador vía API Token, sin exfiltración de datos a un LLM cloud) en `docs/002-arquitectura-del-sistema.md`, §2.5.

### **2.6. Tests**

> Describe brevemente algunos de los tests realizados

---

## 3. Modelo de Datos

> Detalle completo en [`docs/003-modelo-de-datos.md`](docs/003-modelo-de-datos.md).

### **3.1. Diagrama del modelo de datos:**

Diagrama ERD (Mermaid) de `app_config`, `projects_config` y `ticket_logs`, con claves y cardinalidades, en `docs/003-modelo-de-datos.md`, §3.1.

### **3.2. Descripción de entidades principales:**

Atributos, tipos, restricciones (`CHECK`, `UNIQUE`, `FOREIGN KEY`) y DDL completo de SQLite para las 3 entidades en `docs/003-modelo-de-datos.md`, §3.2.

---

## 4. Especificación de la API

Detalle completo en [`docs/004-especificacion-de-la-api.md`](docs/004-especificacion-de-la-api.md). En resumen: DevFlow CLI no expone una API propia en el MVP — es una herramienta CLI/TUI sin interfaz web (ver Non-Goals del PRD). Su única integración por API es como **consumidora** de la API REST de Jira para extraer el contexto de los tickets.

---

## 5. Historias de Usuario

> Documenta 3 de las historias de usuario principales utilizadas durante el desarrollo, teniendo en cuenta las buenas prácticas de producto al respecto.

> Detalle completo (criterios de aceptación Given/When/Then/And) en [`docs/005-historias-de-usuario.md`](docs/005-historias-de-usuario.md).

**Historia de Usuario 1: Configuración inicial de repositorios y rutas locales**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Como desarrollador, quiero registrar una única vez la carpeta raíz de documentación y asociar cada proyecto con su repositorio local, para que la herramienta sepa siempre dónde trabajar sin tener que indicárselo cada vez que inicio un ticket.

**Historia de Usuario 2: Consulta automática de ticket de Jira con fallback manual**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Medio · Dependencias: US-01*

Como desarrollador, quiero que la herramienta obtenga automáticamente el título y la descripción del ticket a partir de su ID de Jira, para no tener que abrir el navegador ni copiar esa información manualmente; si la consulta falla, quiero poder cargar los datos a mano y seguir trabajando sin interrupciones.

**Historia de Usuario 3: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Alto · Dependencias: US-01, US-02*

Como desarrollador, quiero que la herramienta prepare en un solo paso la rama de trabajo, la carpeta de evidencias y el documento inicial del ticket, para empezar a trabajar de inmediato sin ejecutar cada paso manualmente ni redactar el documento desde cero.

---

## 6. Tickets de Trabajo

> Documenta 3 de los tickets de trabajo principales del desarrollo, uno de backend, uno de frontend, y uno de bases de datos. Da todo el detalle requerido para desarrollar la tarea de inicio a fin teniendo en cuenta las buenas prácticas al respecto. 

> Detalle técnico completo (archivos, contratos, criterios de aceptación técnicos y Definition of Done) en [`docs/006-tickets-de-trabajo.md`](docs/006-tickets-de-trabajo.md).

**Ticket 1 (Base de Datos) — TK-01: Implementación del Esquema SQLite (DDL) y del módulo SQLite Storage Manager**
*Prioridad: Must Have · Secuencia: 1 · Esfuerzo: Medio · Dependencias: Ninguna*

Crea las tablas `app_config`, `projects_config` y `ticket_logs` (con sus constraints e índices), el sistema de migraciones versionadas, y el módulo que centraliza todo el acceso a SQLite — único componente del sistema que lee/escribe la base de datos. Vinculado a US-01, US-02 y US-03.

**Ticket 2 (Backend / Servicios) — TK-02: Implementación de Jira REST Client, Ollama AI Transformer, Git Manager, FileSystem Manager y Orquestador**
*Prioridad: Must Have · Secuencia: 2 · Esfuerzo: Alto · Dependencias: TK-01*

Implementa la consulta directa a Jira (con reintento y clasificación de fallos), el procesamiento con Ollama (con validación de esquema y fallback determinista sin código generado), la creación mínima de la rama Git (sin tocar nada más del repositorio) y la generación de la carpeta de evidencias y el documento Markdown en dos fases, todo coordinado por un orquestador que emite eventos de progreso. Vinculado a US-02 y US-03.

**Ticket 3 (Frontend / TUI) — TK-03: Controlador CLI e Interfaz Interactiva de Terminal (Windows)**
*Prioridad: Must Have · Secuencia: 3 · Esfuerzo: Medio · Dependencias: TK-01, TK-02*

Implementa el comando `devflow start <ID>`, la validación del ID, los prompts de carga manual y confirmación, y las vistas de progreso, resumen y fallback en la terminal — la TUI nunca accede a Jira, Git, Ollama o SQLite directamente, solo al orquestador. Vinculado a US-01, US-02 y US-03.

---

## 7. Pull Requests

> Documenta 3 de las Pull Requests realizadas durante la ejecución del proyecto

> Detalle completo (cambios por capa, archivos, verificación y checklist) en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

**Pull Request 1**

**Entrega 1 — Especificación de producto, arquitectura, modelo de datos, historias de usuario y tickets de DevFlow CLI** (`feature/entrega-1-ANR` → `main`). PR de solo documentación: PRD, ADR-001 y ADR-006.1 (evaluación del stack), arquitectura, modelo de datos SQLite, historias de usuario US-01 a US-03 y tickets TK-01 a TK-03, que serán la fuente de verdad para implementar el MVP. Detalle en [`docs/007-pull-requests.md`](docs/007-pull-requests.md).

**Pull Request 2**

**Pull Request 3**

---

> Registro de los prompts utilizados durante el desarrollo con asistencia de IA: [`prompts.md`](prompts.md) (resumen ejecutivo, un prompt por sección) y [`docs/prompts-claude-fase-inicial.md`](docs/prompts-claude-fase-inicial.md) (registro completo, verbatim).
