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

1. La consulta a la API de Jira para extraer el contexto del ticket (o, sin ID, la lista de tickets abiertos asignados al desarrollador para que elija uno).
2. La creación automática de la rama de Git con nomenclatura estandarizada (`<prefijo>/<ID>-<SUFIJO>`), en el repositorio local elegido y a partir de su rama base actualizada.
3. La creación de la estructura de carpetas local del ticket, incluyendo la subcarpeta de adjuntos.
4. La generación de un documento de desarrollo en Markdown, cuyas primeras secciones son redactadas por un LLM local (Ollama) a partir del texto crudo de Jira, y cuyas secciones restantes actúan como plantilla estandarizada que el desarrollador completa durante el ciclo de vida del ticket. La plantilla depende del tipo de issue (bug o historia).

### 2.3. Propuesta de Valor

| Rol | Valor entregado |
|---|---|
| **Desarrollador** | Un solo comando reemplaza cuatro herramientas; arranca a codear con la rama creada, la carpeta lista y el contexto del ticket ya resumido, sin redactar el documento desde cero. |
| **QA / Testing** | Documento de desarrollo con estructura idéntica en todos los tickets del mismo tipo (bug o historia): criterios de aceptación en formato Gherkin, objetos modificados y evidencias en una ubicación conocida y predecible (`<raíz de tickets>/ID/<repositorio>/adjuntos/`). |
| **DevOps** | Registro homogéneo y trazable de qué se modificó por ticket (tablas, endpoints, clases/componentes) y una checklist estandarizada de pasaje a producción, reduciendo el riesgo de despliegues incompletos. |

---

## 3. Alcance del MVP (In Scope)

- **Interfaz CLI TUI interactiva** para terminal Windows, que guía al desarrollador paso a paso (ingreso o elección del ticket, selección de repositorio, confirmación de acciones).
- **Persistencia local en SQLite** de configuración (credenciales de Jira, claves de proyecto, repositorios locales, convenciones del equipo) e historial de tickets procesados.
- **Alta de claves de proyecto de Jira y repositorios.** El usuario da de alta una o más claves de proyecto (p. ej. `SCRUM`); cada clave se valida contra Jira al darla de alta y la herramienta solo trabaja con tickets de las claves registradas. Cada clave tiene **0..N repositorios opcionales**, con nombre (`backend`, `frontend`…), ruta local y rama base (por defecto `main`, editable). El sufijo de usuario para las ramas se configura una sola vez y se sugiere a partir del nombre de la cuenta de Jira.
- **Integración REST con la API de Jira Cloud (v2)**, autenticada con **email + API Token** (Basic) configurados localmente (sin flujo OAuth con redirección a navegador, para no introducir un componente web en el flujo — ver §4). Ante un fallo de esta integración, la herramienta distingue al menos tres causas y activa el **modo fallback manual** en todas ellas: (a) **red caída / sin respuesta** (timeout), (b) **token inválido o expirado**, (c) **ticket inexistente**. Jira Cloud responde 404 —no 401— a un `/issue` o `/project` con token inválido, por lo que ante un 404 la herramienta consulta `/myself`: 401 = token inválido, 200 = el recurso no existe. En los tres casos, informa el motivo del fallo cuando es identificable y permite al desarrollador ingresar manualmente los datos mínimos del ticket (ID, título, descripción) para continuar el flujo sin bloquear la creación de rama y carpetas.
- **Selección del ticket.** `devflow start <ID>` inicia un ticket concreto; `devflow start` sin ID muestra los tickets abiertos asignados al usuario dentro de sus claves registradas (excluidas las épicas) para elegir uno.
- **Tipos de issue.** Las épicas no se usan para desarrollar: la herramienta avisa y no crea rama ni documento. Bug/Error/Defecto usan la plantilla *bug* y el prefijo de rama `bugs`; el resto de los tipos (historia, tarea, subtarea…) usan la plantilla *historia* y el prefijo `features`.
- **Creación automática de rama Git** con el formato `<prefijo>/<ID>-<SUFIJO>` (p. ej. `features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`) en el repositorio local elegido. La rama nace de la rama base configurada del repositorio (por defecto `main`, con override puntual `--base`), previamente actualizada desde el remoto, sin importar en qué rama esté el desarrollador. Si el repositorio tiene cambios pendientes, la herramienta se detiene y los lista; si la rama ya existe, informa y continúa. La herramienta nunca hace `commit`, `add` ni `push`.
- **Un repositorio por ejecución.** En cada ejecución el desarrollador elige un único repositorio de los asociados a la clave del ticket. Si el ticket toca varios (p. ej. backend y frontend), se ejecuta una vez por repositorio, de forma secuencial. Se genera un documento (y su carpeta de adjuntos) por ticket y repositorio; el análisis de Ollama (Fase 1) se genera una sola vez por ticket y se copia en el documento del siguiente repositorio. Una clave sin repositorios genera solo el documento, sin rama.
- **Procesamiento con Ollama (LLM local)** del texto crudo de Jira para autogenerar, en el documento Markdown:
  - Descripción y Contexto.
  - Casos de Uso.
  - Criterios de Aceptación en formato Gherkin (*Given / When / Then*).

  Modelo mínimo `qwen2.5:3b`, con salida estructurada (JSON Schema por tipo de issue) y un posprocesado determinista que marca como "No especificado en el ticket" los datos ausentes en lugar de dejar que el modelo los invente. Los prompts y las plantillas son archivos versionados de la aplicación (`templates/`), no configuración del usuario.
- **Resiliencia del procesamiento con Ollama**: si el servicio no está en ejecución, no responde dentro de un timeout definido (por defecto 120 s: la generación medida en CPU tarda 30–105 s por ticket), o no tiene el modelo requerido instalado, la herramienta **no bloquea el flujo**. Crea igualmente la rama Git y la estructura de carpetas, y genera el documento Markdown con el texto crudo de Jira sin estructurar en las secciones correspondientes, marcado con el aviso `⚠️ Generado sin Ollama — completar manualmente`. El desarrollador puede continuar de inmediato y, opcionalmente, reprocesar el documento más tarde cuando Ollama esté disponible.
- **Estructura de carpetas local por ticket y repositorio** (`<raíz de tickets>/ID/<repositorio>/adjuntos/`), generada automáticamente junto con el documento Markdown.
- **Plantilla del documento, en dos fases explícitas** (con estructura idéntica por tipo de issue):
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
- **Sin soporte para tickets multi-repositorio en una misma ejecución.** Cada ejecución de la herramienta opera sobre un único repositorio local, elegido de la lista de la clave del ticket. Un ticket que requiera cambios en más de un repositorio (p. ej. backend y frontend) se procesa ejecutando la herramienta una vez por repositorio afectado, una tras otra; cada ejecución genera su propio documento.
- **Sin documento ni rama para épicas.** Las épicas no se usan para desarrollar y no tienen plantilla: la herramienta solo avisa.
- **Sin seguimiento del cierre de la Fase 2.** La herramienta registra el historial al terminar la generación de la Fase 1 (`ticket_logs`); no detecta ni registra cuándo el desarrollador completa la Fase 2 del documento (Objetos Modificados, Evidencias, Pasaje a Producción). Queda como mejora futura.
- **Sin reglas de prompts ni plantillas configurables por el usuario.** Los prompts y las plantillas por tipo de issue son contenido versionado de la aplicación, igual para todo el equipo.

---

## 5. Criterios de Éxito Medibles

- **Tiempo de arranque del ticket**: tiempo desde que el desarrollador tiene el ID del ticket hasta que tiene la rama creada, la carpeta local lista y el documento base generado. Meta: ≤ 2 minutos por ticket usando la herramienta (baseline manual actual a medir en el equipo antes del lanzamiento). Riesgo conocido: la generación con Ollama medida solo con CPU tarda 30–105 s por ticket (ver ADR-006.1); la segunda ejecución de un ticket para otro repositorio reutiliza la Fase 1 y evita esa espera.
- **Cobertura de flujo sin salir de la terminal**: 100% de las acciones de arranque (consulta de contexto, creación de rama, creación de carpetas, generación del documento base) ejecutadas dentro de la TUI, sin que el desarrollador abra manualmente el navegador, una terminal de Git aparte o el explorador de archivos.
- **100% de cumplimiento en la nomenclatura** de ramas Git y documentos de entrega generados por la herramienta, verificable por QA mediante validación automática (lint de nombres), sin intervención manual de corrección.
- **Tasa de éxito sin fallback**: % de tickets cuyo documento se genera sin necesidad de fallback manual (ni de Jira ni de Ollama), medido durante el primer mes de adopción, como indicador temprano de fricción residual.

---

## 6. Referencias

- Ver síntesis ejecutiva en [`README.md`](../README.md).
