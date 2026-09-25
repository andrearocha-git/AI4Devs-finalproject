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
- **Integración REST con la API de Jira**, autenticada mediante **API Token / Personal Access Token** configurado localmente (sin flujo OAuth con redirección a navegador, para no introducir un componente web en el flujo — ver §4). Ante un fallo de esta integración, la herramienta distingue al menos tres causas y activa el **modo fallback manual** en todas ellas: (a) **red caída / sin respuesta** (timeout), (b) **token inválido o expirado** (401/403), (c) **ticket inexistente** (404). En los tres casos, informa el motivo del fallo cuando es identificable y permite al desarrollador ingresar manualmente los datos mínimos del ticket (ID, título, descripción) para continuar el flujo sin bloquear la creación de rama y carpetas.
- **Creación automática de rama Git** (`feature/ID-123-resumen`, `bugfix/ID-123-resumen`, etc.) en el repositorio local correspondiente, respetando la convención de nomenclatura del equipo.
- **Procesamiento con Ollama (LLM local)** del texto crudo de Jira para autogenerar, en el documento Markdown:
  - Descripción y Contexto.
  - Casos de Uso.
  - Criterios de Aceptación en formato Gherkin (*Given / When / Then*).
- **Resiliencia del procesamiento con Ollama**: si el servicio no está en ejecución, no responde dentro de un timeout definido, o no tiene el modelo requerido instalado, la herramienta **no bloquea el flujo**. Crea igualmente la rama Git y la estructura de carpetas, y genera el documento Markdown con el texto crudo de Jira sin estructurar en las secciones correspondientes, marcado con el aviso `⚠️ Generado sin Ollama — completar manualmente`. El desarrollador puede continuar de inmediato y, opcionalmente, reprocesar el documento más tarde cuando Ollama esté disponible.
- **Estructura de carpetas local por ticket** (`/ticket-ID/adjuntos/`), generada automáticamente junto con el documento Markdown.
- **Plantilla del documento, en dos fases explícitas:**
  - **Fase 1 — Generada automáticamente al crear el ticket:** Descripción y Contexto, Casos de Uso, Criterios de Aceptación en Gherkin (procesados por Ollama a partir del texto de Jira).
  - **Fase 2 — Completada manualmente por el desarrollador durante el ciclo de vida del ticket, antes del pasaje a producción:** Objetos Modificados, Evidencias de Pruebas (enlaces a `adjuntos/`), Instrucciones de Pasaje a Producción.

---

## 4. Límites Explícitos (Out of Scope / Non-Goals)

- **Sin generación de código, en ningún formato.** Ollama **no** generará, escribirá, completará ni sugerirá código fuente ni fragmentos de código en ningún lenguaje o sintaxis (clases Java/Spring Boot, componentes/servicios Angular, scripts SQL o de migración, comandos de shell, snippets JSON/YAML, etc.), **ni siquiera a modo de ejemplo ilustrativo** dentro del documento generado. Su función se limita estrictamente a: (a) procesar el texto en lenguaje natural del ticket de Jira, y (b) estructurar ese contenido como prosa y listas en Markdown, incluyendo el formato Gherkin — que se considera **lenguaje de especificación de comportamiento, no código fuente**. Cualquier bloque de código que termine apareciendo en el documento (p. ej. en "Objetos Modificados") es ingresado manualmente por el desarrollador, nunca por el LLM.
- **Sin interfaz gráfica (GUI ni Web).** La herramienta funciona exclusivamente desde terminal / línea de comandos (CLI / TUI). No incluye ventanas de escritorio (Electron, Tauri, etc.) ni paneles web en navegador.
- **Sin sincronización automática con Google Drive por API.** Los adjuntos y documentos se gestionan localmente en el MVP; la integración con Drive queda **diferida a v2**.
- Sin soporte multiplataforma (macOS/Linux) en esta versión — el MVP se valida y soporta exclusivamente sobre Windows 10/11.
- Sin gestión automática de merges, pull requests o revisiones de código: la herramienta crea la rama, pero el ciclo de PR/merge sigue siendo manual.
- Sin motor de reglas configurable de nomenclatura por proyecto en el MVP: la convención de ramas/carpetas es única y fija para todo el equipo (parametrización avanzada queda para versiones futuras).
- **Sin autenticación OAuth con redirección a navegador.** La autenticación contra Jira se realiza exclusivamente mediante API Token / Personal Access Token configurado localmente, para no introducir un componente web dentro del flujo de la herramienta (ver §3).
- **Sin soporte para tickets multi-repositorio en una misma ejecución.** Cada ejecución de la herramienta opera sobre un único repositorio local. Un ticket que requiera cambios en más de un repositorio (p. ej. backend y frontend) se procesa ejecutando la herramienta una vez por repositorio afectado.

---

## 5. Criterios de Éxito Medibles

- **Tiempo de arranque del ticket**: tiempo desde que el desarrollador tiene el ID del ticket hasta que tiene la rama creada, la carpeta local lista y el documento base generado. Meta: ≤ 2 minutos por ticket usando la herramienta (baseline manual actual a medir en el equipo antes del lanzamiento).
- **Cobertura de flujo sin salir de la terminal**: 100% de las acciones de arranque (consulta de contexto, creación de rama, creación de carpetas, generación del documento base) ejecutadas dentro de la TUI, sin que el desarrollador abra manualmente el navegador, una terminal de Git aparte o el explorador de archivos.
- **100% de cumplimiento en la nomenclatura** de ramas Git y documentos de entrega generados por la herramienta, verificable por QA mediante validación automática (lint de nombres), sin intervención manual de corrección.
- **Tasa de éxito sin fallback**: % de tickets cuyo documento se genera sin necesidad de fallback manual (ni de Jira ni de Ollama), medido durante el primer mes de adopción, como indicador temprano de fricción residual.

---

## 6. Referencias

- Ver síntesis ejecutiva en [`README.md`](../README.md).
