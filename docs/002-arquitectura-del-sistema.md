## 2. Arquitectura del Sistema

### **2.1. Diagrama de arquitectura:**

[A definir]

### **2.2. Descripción de componentes principales:**

El PRD (sección "Alcance del MVP") identifica los siguientes componentes funcionales, sin especificar aún su tecnología de implementación concreta:

- **Interfaz CLI/TUI:** interfaz de texto interactiva para terminal Windows, punto de entrada único del flujo.
- **Módulo de integración con Jira:** consulta la API REST de Jira para extraer el contexto del ticket; incluye modo de fallback manual si no hay conexión.
- **Módulo de integración con Git:** crea automáticamente la rama estandarizada en el repositorio local correspondiente.
- **Módulo de generación de documentación:** crea la estructura de carpetas local del ticket (`/ticket-ID/adjuntos/`) y el documento Markdown de desarrollo.
- **Módulo de procesamiento con LLM local (Ollama):** procesa el texto crudo de Jira para estructurar las secciones de Descripción y Contexto, Casos de Uso y Criterios de Aceptación (Gherkin) del documento Markdown.
- **Almacenamiento local (SQLite):** persiste configuración (credenciales de Jira, rutas de repositorios locales, convenciones del equipo) e historial de tickets procesados.

[A definir] — tecnología concreta de cada componente y forma en que se comunican entre sí.

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

[A definir]

### **2.4. Infraestructura y despliegue**

[A definir]

### **2.5. Seguridad**

[A definir]

### **2.6. Tests**

[A definir]
