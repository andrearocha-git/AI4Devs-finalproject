# PRD — Documento de Descripción General del Producto

## 1. Ficha del Proyecto

| Campo | Detalle |
|---|---|
| **Nombre del producto** | DevFlow CLI |
| **Versión** | v1.0 — MVP |
| **Autor** | Andrea Rocha |
| **Entorno objetivo** | CLI / TUI para Windows 10/11 |
| **Repositorio** | AI4Devs-finalproject (este repositorio) |
| **Stakeholders** | 5 ingenieros de desarrollo (4 backend Java Spring Boot, 2 frontend Angular — proyectos no excluyentes por persona), equipo de QA/Testing, DevOps |

---

## 2. Descripción General

### 2.1. Problema

El equipo trabaja en paralelo sobre **6 proyectos** (4 backend en Java Spring Boot, 2 frontend en Angular) bajo Windows. Al tomar una User Story de Jira, cada desarrollador debe:

1. Abrir la web de Jira para leer el ticket y copiar su contexto.
2. Abrir una terminal de Git para crear manualmente la rama correspondiente.
3. Abrir el explorador de archivos para crear a mano una carpeta de trabajo del ticket.
4. Abrir Google Drive (u otro medio) para crear o buscar el documento de desarrollo.

Este flujo provoca:

- **Cambio de contexto constante** (*context switching*) entre cuatro herramientas distintas para iniciar una sola tarea.
- **Falta de estandarización**: cada desarrollador nombra ramas, carpetas y documentos de manera libre, sin convención común.
- **Fricción para QA/Testing**, que no cuenta con un documento predecible del que extraer casos de prueba ni evidencias.
- **Riesgo en el pasaje a producción**, por ausencia de un registro claro y homogéneo de los objetos modificados (tablas de BD, endpoints, clases, componentes) ticket a ticket.

### 2.2. Solución Propuesta

Una **herramienta CLI con interfaz de texto interactiva (TUI)** para Windows que, a partir del identificador de un ticket de Jira, automatiza en un único comando:

1. La consulta a la API de Jira para extraer el contexto del ticket.
2. La creación automática de la rama de Git con nomenclatura estandarizada, en el repositorio local correspondiente.
3. La creación de la estructura de carpetas local del ticket, incluyendo la subcarpeta de adjuntos.
4. La generación de un documento de desarrollo en Markdown, cuyas primeras secciones son redactadas por un LLM local (Ollama) a partir del texto crudo de Jira, y cuyas secciones restantes actúan como plantilla estandarizada que el desarrollador completa durante el ciclo de vida del ticket.

### 2.3. Propuesta de Valor

| Rol | Valor entregado |
|---|---|
| **Desarrollador** | Un solo comando reemplaza cuatro herramientas; arranca a codear con la rama creada, la carpeta lista y el contexto del ticket ya resumido, sin redactar el documento desde cero. |
| **QA / Testing** | Documento de desarrollo con estructura idéntica en todos los tickets: criterios de aceptación en formato Gherkin, objetos modificados y evidencias en una ubicación conocida y predecible (`/ticket-ID/adjuntos/`). |
| **DevOps** | Registro homogéneo y trazable de qué se modificó por ticket (tablas, endpoints, clases/componentes) y una checklist estandarizada de pasaje a producción, reduciendo el riesgo de despliegues incompletos. |

---

## 3. Alcance del MVP (In Scope)

- **Interfaz CLI TUI interactiva** para terminal Windows, que guía al desarrollador paso a paso (ingreso del ID de ticket, selección de repositorio/proyecto, confirmación de acciones).
- **Persistencia local en SQLite** de configuración (credenciales de Jira, rutas de repositorios locales, convenciones del equipo) e historial de tickets procesados.
- **Integración REST con la API de Jira**, con **modo fallback manual**: si no hay conexión o la consulta falla, el desarrollador puede ingresar manualmente los datos mínimos del ticket (ID, título, descripción) para continuar el flujo.
- **Creación automática de rama Git** (`feature/ID-123-resumen`, `bugfix/ID-123-resumen`, etc.) en el repositorio local correspondiente, respetando la convención de nomenclatura del equipo.
- **Procesamiento con Ollama (LLM local)** del texto crudo de Jira para autogenerar, en el documento Markdown:
  - Descripción y Contexto.
  - Casos de Uso.
  - Criterios de Aceptación en formato Gherkin (*Given / When / Then*).
- **Estructura de carpetas local por ticket** (`/ticket-ID/adjuntos/`), generada automáticamente junto con el documento Markdown.
- **Plantilla estandarizada** dentro del documento generado, con secciones a completar manualmente por el desarrollador durante el ciclo de vida del ticket: Objetos Modificados, Evidencias de Pruebas y Instrucciones de Pasaje a Producción.

---

## 4. Límites Explícitos (Out of Scope / Non-Goals)

- **Sin generación de código.** Ollama **no** generará, escribirá ni desarrollará código fuente (clases Spring Boot, componentes Angular, scripts de migración, etc.). Su función se limita estrictamente a procesar el texto de Jira y estructurar la documentación en Markdown.
- **Sin interfaz gráfica (GUI ni Web).** La herramienta funciona exclusivamente desde terminal / línea de comandos (CLI / TUI). No incluye ventanas de escritorio (Electron, Tauri, etc.) ni paneles web en navegador.
- **Sin sincronización automática con Google Drive por API.** Los adjuntos y documentos se gestionan localmente en el MVP; la integración con Drive queda **diferida a v2**.
- Sin soporte multiplataforma (macOS/Linux) en esta versión — el MVP se valida y soporta exclusivamente sobre Windows 10/11.
- Sin gestión automática de merges, pull requests o revisiones de código: la herramienta crea la rama, pero el ciclo de PR/merge sigue siendo manual.
- Sin motor de reglas configurable de nomenclatura por proyecto en el MVP: la convención de ramas/carpetas es única y fija para todo el equipo (parametrización avanzada queda para versiones futuras).

---

## 5. Criterios de Éxito Medibles

- **Reducción del cambio de contexto**: el desarrollador inicia un ticket sin necesidad de abrir manualmente Jira, Git y el explorador de archivos por separado; el objetivo es completar el arranque del ticket (contexto + rama + carpeta + documento base) en un único flujo dentro de la terminal.
- **100% de cumplimiento en la nomenclatura** de ramas Git y de documentos de entrega generados por la herramienta, verificable por QA sin intervención manual de corrección.

---

## 6. Referencias

- Ver síntesis ejecutiva en [`README.md`](../README.md).
