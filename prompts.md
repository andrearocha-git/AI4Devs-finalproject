> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Esperamos un máximo de 3 por sección, principalmente los de creación inicial o  los de corrección o adición de funcionalidades que consideres más relevantes.
Puedes añadir adicionalmente la conversación completa como link o archivo adjunto si así lo consideras


## Índice

1. [Descripción general del producto](#1-descripción-general-del-producto)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Especificación de la API](#4-especificación-de-la-api)
5. [Historias de usuario](#5-historias-de-usuario)
6. [Tickets de trabajo](#6-tickets-de-trabajo)
7. [Pull requests](#7-pull-requests)

---

## 1. Descripción general del producto

**Prompt 1: Armado del PRD para después armar la descripción general del producto**

```
Actúa como un Lead Product Manager y Arquitecto de Software Senior especializado en Developer Experience (DevEx).

=== CONTEXTO DEL PROBLEMA ===
Somos un equipo de desarrollo de 5 ingenieros que trabajamos en paralelo sobre 6 proyectos (4 backend en Java Spring Boot y 2 frontend en Angular) en entornos Windows 10/11.
Actualmente, al tomar una User Story de Jira, los desarrolladores sufren de constante cambio de contexto (saltando entre la web de Jira, la terminal de Git, el explorador de archivos y Google Drive). Cada uno crea sus ramas de Git, carpetas y documentos de desarrollo de manera libre y no estandarizada.
Esto genera alta fricción para el desarrollador, dificulta el trabajo de QA/Testing al armar casos de prueba y complica el pasaje a producción por falta de un registro claro de objetos modificados.

=== OBJETIVO DEL PRODUCTO ===
Crear una herramienta CLI amigable (TUI) para Windows que elimine el cambio de contexto del desarrollador, automatizando en un solo comando:
1. La consulta a la API de Jira para extraer el contexto del ticket.
2. La creación automática de la rama en Git (ej. 'feature/ID-123-resumen' o 'bugfix/ID-123-resumen') dentro del repositorio correspondiente.
3. La creación de la estructura de carpetas local por ticket (`/ticket-ID/adjuntos/`).
4. La generación inteligente del documento de desarrollo en Markdown enriquecido con un LLM local (Ollama).

=== FLUJO DE GENERACIÓN DEL DOCUMENTO DE DESARROLLO ===
1. La herramienta consulta la API de Jira con el ID del ticket.
2. Identifica el repositorio local afectado e invoca Git para crear y cambiar a la nueva rama estandarizada.
3. Un LLM local (Ollama) procesa el texto crudo de Jira y autogenera las primeras secciones del documento Markdown:
   - **Descripción y Contexto:** Resumen estructurado del problema.
   - **Casos de Uso:** Desglose del flujo funcional.
   - **Criterios de Aceptación:** Formato estandarizado Gherkin ('Given / When / Then').
4. La plantilla incluye secciones estandarizadas que el desarrollador completará durante el ciclo de vida del ticket:
   - **Objetos Modificados:** Tablas de BD, endpoints API, clases Java / componentes Angular.
   - **Evidencias de Pruebas:** Enlaces a archivos colocados en la subcarpeta local 'adjuntos/'.
   - **Instrucciones de Pasaje a Producción:** Checklist y scripts requeridos para el despliegue.

=== TU MISIÓN EN ESTE TURNO ===
Genera el documento de Descripción General del Producto (PRD) en formato Markdown para guardarse en 'docs/PRD.md' y sintetizarse en el 'README.md' principal.

El documento debe estructurarse estrictamente así:
1. **Ficha del Proyecto:** Nombre del producto, versión (v1.0 MVP), autor, entorno (Windows CLI) y repositorio.
2. **Descripción General:** Problema detallado, solución propuesta y propuesta de valor para Devs, QA y DevOps.
3. **Alcance del MVP (In Scope):**
   - Interfaz CLI TUI interactiva para terminal Windows.
   - Persistencia local de configuración e historial en SQLite.
   - Integración REST con API de Jira (con fallback manual si no hay conexión).
   - Creación automática de rama Git en el repositorio correspondiente según la convención del equipo.
   - Procesamiento con Ollama para estructuración Gherkin del Markdown.
   - Estructura de carpetas local (`/ticket-ID/adjuntos/`).
4. **Límites Explícitos (Out of Scope / Non-Goals):**
   - **Sin generación de código:** Ollama NO generará, escribirá ni desarrollará código fuente (clases Spring Boot, componentes Angular, scripts, etc.). Su función se limita estrictamente a procesar el texto de Jira y estructurar la documentación en Markdown.
   - **Sin interfaz gráfica (GUI ni Web):** La herramienta funcionará exclusivamente desde la terminal / línea de comandos (CLI / TUI). NO incluirá ventanas de escritorio (Electron, Tauri, etc.) ni paneles web en el navegador.
   - Sincronización automática con Google Drive por API (diferido a v2).
5. **Criterios de Éxito Medibles:**
   - Reducción del cambio de contexto (*context switching*) del desarrollador al iniciar un ticket.
   - 100% de cumplimiento en la nomenclatura de ramas Git y documentos de entrega para QA.

=== RESTRICCIONES ===
- Lenguaje: Español técnico profesional.
- No generes código de implementación aún. Limítate a la especificación del producto.

```


**Prompt 2:**

**Prompt 3:**

---

## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.2. Descripción de componentes principales:**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.4. Infraestructura y despliegue**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.5. Seguridad**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.6. Tests**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 3. Modelo de Datos

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 4. Especificación de la API

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 5. Historias de Usuario

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 6. Tickets de Trabajo

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 7. Pull Requests

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**
