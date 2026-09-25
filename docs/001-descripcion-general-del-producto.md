## 1. Descripción general del producto

### **1.1. Objetivo:**

DevFlow CLI es una herramienta CLI/TUI para Windows 10/11 cuyo propósito es eliminar el cambio de contexto (*context switching*) que sufre un desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a Jira, la creación de la rama Git, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown.

Aporta valor a tres perfiles:

- **Desarrollador:** un solo comando reemplaza cuatro herramientas (Jira, terminal de Git, explorador de archivos y Google Drive); arranca a codear con la rama creada, la carpeta lista y el contexto del ticket ya resumido.
- **QA/Testing:** un documento de desarrollo con estructura idéntica en todos los tickets (criterios de aceptación en Gherkin, objetos modificados y evidencias en una ubicación conocida).
- **DevOps:** un registro homogéneo y trazable de los objetos modificados por ticket y una checklist estandarizada de pasaje a producción.

Resuelve la falta de estandarización en la creación de ramas, carpetas y documentos, y la fricción de cambio de contexto entre Jira, Git, el explorador de archivos y Google Drive, para un equipo de 5 ingenieros que trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular).

### **1.2. Características y funcionalidades principales:**

Según el alcance del MVP definido en el PRD:

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Integración REST con la API de Jira, autenticada mediante API Token / Personal Access Token (sin flujo OAuth con navegador). Ante fallo de red, token inválido/expirado o ticket inexistente, activa un modo fallback manual sin bloquear el flujo.
- Creación automática de la rama de Git (`feature/ID-123-resumen`, `bugfix/ID-123-resumen`) en el repositorio correspondiente, según la convención del equipo (una ejecución por repositorio; no hay soporte multi-repo en una misma corrida).
- Procesamiento con un LLM local (Ollama) para autogenerar, a partir del texto crudo de Jira, la Descripción y Contexto, los Casos de Uso y los Criterios de Aceptación en formato Gherkin (*Given/When/Then*). Si Ollama no está disponible, el flujo continúa igual: se genera el documento con el texto crudo sin estructurar, marcado para completar manualmente.
- Creación automática de la estructura de carpetas local por ticket (`/ticket-ID/adjuntos/`).
- Plantilla del documento en dos fases: **Fase 1** (generada automáticamente al crear el ticket: Descripción y Contexto, Casos de Uso, Gherkin) y **Fase 2** (completada por el desarrollador durante el ciclo de vida del ticket: Objetos Modificados, Evidencias de Pruebas, Instrucciones de Pasaje a Producción).

### **1.3. Diseño y experiencia de usuario:**

[A definir]

### **1.4. Instrucciones de instalación:**

[A definir]
