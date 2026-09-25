# DevFlow CLI

> Herramienta CLI/TUI para Windows que elimina el cambio de contexto del desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la creación de la rama Git, la estructura de carpetas local y el documento de desarrollo (asistido por un LLM local vía Ollama).

**Versión:** v1.0 — MVP · **Entorno:** Windows 10/11 (CLI/TUI) · **PRD completo:** [`docs/PRD.md`](docs/PRD.md)

## El problema

Un equipo de 5 ingenieros trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular). Para arrancar un ticket hoy hace falta saltar entre la web de Jira, la terminal de Git, el explorador de archivos y Google Drive, creando ramas, carpetas y documentos de forma libre y no estandarizada. Esto genera fricción para el desarrollador, dificulta a QA armar casos de prueba y complica el pasaje a producción por falta de un registro claro de los objetos modificados.

## La solución

Con el ID de un ticket de Jira, la herramienta:

1. Consulta la API de Jira para extraer el contexto del ticket (con fallback manual si no hay conexión).
2. Crea automáticamente la rama Git estandarizada (`feature/ID-123-resumen`, `bugfix/ID-123-resumen`) en el repositorio correspondiente.
3. Crea la estructura de carpetas local del ticket (`/ticket-ID/adjuntos/`).
4. Genera el documento de desarrollo en Markdown: un LLM local (Ollama) redacta la Descripción y Contexto, los Casos de Uso y los Criterios de Aceptación en formato Gherkin a partir del texto crudo de Jira; el resto del documento es una plantilla estandarizada (Objetos Modificados, Evidencias de Pruebas, Instrucciones de Pasaje a Producción) que el desarrollador completa durante el ciclo de vida del ticket.

## Alcance del MVP

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Integración REST con la API de Jira, con fallback manual.
- Creación automática de rama Git según la convención del equipo.
- Procesamiento con Ollama para estructurar el Markdown en formato Gherkin.
- Estructura de carpetas local por ticket con subcarpeta de adjuntos.

**Fuera de alcance en el MVP:** generación de código por parte del LLM, interfaz gráfica/web, y sincronización automática con Google Drive (diferida a v2). Detalle completo de límites en el [PRD](docs/PRD.md#4-límites-explícitos-out-of-scope--non-goals).

## Criterios de éxito

- Reducción del cambio de contexto del desarrollador al iniciar un ticket.
- 100% de cumplimiento en la nomenclatura de ramas Git y documentos de entrega para QA.

## Documentación

- [PRD — Descripción General del Producto](docs/PRD.md)

---

> Nota: este repositorio también contiene [`readme.md`](readme.md) y [`prompts.md`](prompts.md), la plantilla de entrega del curso AI4Devs (ficha del proyecto, arquitectura, modelo de datos, historias de usuario, tickets y prompts), que se irá completando en paralelo a este README de producto.
