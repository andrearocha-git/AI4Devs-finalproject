## 1. Descripción general del producto

### **1.1. Objetivo:**

DevFlow CLI es una herramienta CLI/TUI para Windows 10/11 cuyo propósito es eliminar el cambio de contexto (*context switching*) que sufre un desarrollador al iniciar una User Story de Jira, automatizando en un solo comando la consulta a Jira, la creación de la rama Git, la estructura de carpetas local del ticket y la generación de un documento de desarrollo en Markdown.

Aporta valor a tres perfiles:

- **Desarrollador:** un solo comando reemplaza cuatro herramientas (Jira, terminal de Git, explorador de archivos y Google Drive); arranca a codear con la rama creada, la carpeta lista y el contexto del ticket ya resumido.
- **QA/Testing:** un documento de desarrollo con estructura idéntica en todos los tickets del mismo tipo (criterios de aceptación en Gherkin, objetos modificados y evidencias en una ubicación conocida).
- **DevOps:** un registro homogéneo y trazable de los objetos modificados por ticket y una checklist estandarizada de pasaje a producción.

Resuelve la falta de estandarización en la creación de ramas, carpetas y documentos, y la fricción de cambio de contexto entre Jira, Git, el explorador de archivos y Google Drive, para un equipo de 5 ingenieros que trabaja en paralelo sobre 6 proyectos (4 backend Java Spring Boot, 2 frontend Angular).

### **1.2. Características y funcionalidades principales:**

Según el alcance del MVP definido en el PRD:

- Interfaz CLI TUI interactiva para terminal Windows.
- Persistencia local de configuración e historial en SQLite.
- Alta de una o más **claves de proyecto de Jira** (validadas contra Jira al darlas de alta), cada una con 0..N repositorios opcionales (nombre, ruta local y rama base, por defecto `main`), y de un **sufijo de usuario** para las ramas, sugerido a partir del nombre de la cuenta de Jira.
- Integración REST con Jira Cloud (API v2), autenticada con email + API Token (sin flujo OAuth con navegador). Ante fallo de red, token inválido/expirado o ticket inexistente, activa un modo fallback manual sin bloquear el flujo; como Jira Cloud responde 404 con un token inválido, ante un 404 la herramienta consulta `/myself` para distinguir ambos casos.
- `devflow start <ID>` inicia un ticket; `devflow start` sin ID lista los tickets abiertos asignados al usuario en sus claves (sin épicas) para elegir uno. Las épicas no generan rama ni documento: solo se avisa.
- Creación automática de la rama de Git con el formato `<prefijo>/<ID>-<SUFIJO>` (`features/SCRUM-1-AROCHA`, `bugs/SCRUM-2-AROCHA`; el prefijo depende del tipo de issue), a partir de la rama base del repositorio previamente actualizada. Si hay cambios pendientes en el repositorio, la herramienta se detiene y los lista; nunca hace `commit`, `add` ni `push`.
- **Un repositorio por ejecución:** el desarrollador elige un repositorio de la lista de la clave. Si el ticket toca varios (backend y frontend, por ejemplo), se ejecuta una vez por cada uno, de forma secuencial; cada ejecución genera su propio documento y su carpeta de adjuntos, y el análisis de Ollama de la Fase 1 se genera una sola vez por ticket y se copia en el documento del siguiente repositorio. Una clave sin repositorios genera solo el documento, sin rama.
- Procesamiento con un LLM local (Ollama, modelo mínimo `qwen2.5:3b`) para autogenerar, a partir del texto crudo de Jira, la Descripción y Contexto, los Casos de Uso y los Criterios de Aceptación en formato Gherkin (*Given/When/Then*), con salida estructurada y un posprocesado que marca como "No especificado en el ticket" lo que el ticket no dice. Si Ollama no está disponible o no responde en 120 s, el flujo continúa igual: se genera el documento con el texto crudo sin estructurar, marcado para completar manualmente.
- Creación automática de la estructura de carpetas local por ticket y repositorio (`<raíz de tickets>\ID\<repositorio>\adjuntos\`), fuera del repositorio Git.
- Plantilla del documento en dos fases, con estructura idéntica por tipo de issue (bug o historia): **Fase 1** (generada automáticamente al crear el ticket: Descripción y Contexto, Casos de Uso, Gherkin) y **Fase 2** (completada por el desarrollador durante el ciclo de vida del ticket: Objetos Modificados, Evidencias de Pruebas, Instrucciones de Pasaje a Producción).

### **1.3. Diseño y experiencia de usuario:**

[A definir]

### **1.4. Instrucciones de instalación:**

[A definir]
