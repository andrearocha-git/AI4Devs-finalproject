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


**Prompt 2: Prompt de Auditoría y Evaluación del PRD para después actualizar la descripción general del producto**

```
Actúa como un Auditor Principal de Producto y Lead QA especializado en Herramientas de Ingeniería (DevEx).

=== CONTEXTO ===
Hemos generado la primera versión de nuestro PRD en 'docs/PRD.md' para una herramienta CLI (TUI) de Windows 10/11 que estandariza el inicio de tareas de desarrollo desde Jira, crea ramas en Git, genera carpetas locales y utiliza un LLM local (Ollama) para formatear la documentación en Markdown.

=== TU MISIÓN EN ESTE TURNO ===
Realiza una auditoría crítica y exhaustiva del documento 'docs/PRD.md'. No aplaudas el trabajo; busca vacíos, ambigüedades, riesgos de alcance (scope creep) y puntos débiles.

Evalúa el documento frente a los siguientes 6 puntos de control:

1. **Evaluación de Fronteras (Non-Goals):**
   - ¿Queda 100% claro e inequívoco que Ollama NO generará código fuente (Java/Angular)?
   - ¿Queda 100% claro que NO hay interfaz web ni GUI de escritorio?
   - Si detectas alguna redacción ambigua que pueda confundir a un evaluador, señálala y propone la redacción exacta corregida.

2. **Manejo de Fallos y Resiliencia (Edge Cases):**
   - ¿El PRD especifica el comportamiento cuando la API de Jira no responde (ej. red caída o token inválido)?
   - ¿Especifica qué ocurre si Ollama no está en ejecución en la PC del desarrollador (mecanismo de Fallback)?

3. **Ciclo de Vida del Ticket en la Plantilla Markdown:**
   - ¿La estructura de la plantilla diferencia claramente lo que se genera al INICIO (Contexto, Casos de Uso, Gherkin) de lo que completa el Dev al FINALIZAR (Objetos modificados, Evidencias en 'adjuntos/', Pasaje a Prod)?

4. **Análisis de Fricción (DevEx):**
   - ¿El flujo propuesto realmente elimina el cambio de contexto del desarrollador o le agrega pasos manuales innecesarios?

5. **Factibilidad del MVP:**
   - ¿Existe alguna funcionalidad 'In Scope' que consideres excesiva para una v1.0 y que debería postergarse a la v2.0?

6. **Métricas de Éxito:**
   - ¿Las métricas definidas son medibles y objetivas?

=== FORMATO DE RESPUESTA ===
Estructura tu dictamen en:
- 🔴 **Hallazgos Críticos / Puntos Ciegos** (Lo que debe corregirse inmediatamente).
- 🟡 **Oportunidades de Mejora** (Sugerencias para afinar la especificación).
- 🟢 **Veredicto:** [APROBADO CON CAMBIOS / RECHAZADO].
- 📝 **Bloque de Parches:** Texto exacto formateado en Markdown para reemplazar o añadir en 'docs/PRD.md' para solucionar cada hallazgo.

```

✏️ Nota: Despues de cada prompt se le pide a Claude Code que actualice los archivos PRD.md, 000, 001 y 002

---

## 2. Arquitectura del Sistema

### **2.0. Documento ADR:**

**Prompt 1: Prompt para evaluar módulos y generar el ADR**

```
Actúa como un Arquitecto de Software Principal especializado en Gobernanza Técnica y DevEx.

=== CONTEXTO ===
Estamos definiendo la arquitectura técnica para una herramienta CLI/TUI en Windows 10/11 que estandariza el inicio de tareas desde Jira, crea ramas en Git, genera carpetas locales de evidencias y utiliza Ollama para estructurar especificaciones Markdown.

=== TU MISIÓN EN ESTE TURNO ===
Evalúa críticamente el patrón arquitectónico modular propuesto (TUI Layer, Service Layer, Storage Layer) y genera un Registro de Decisiones de Arquitectura (ADR) formal en formato Markdown para guardarse en 'docs/ADR-001-arquitectura-inicial.md'.

El documento debe seguir la plantilla estándar de ADR (MADR v3.0 / Michael Nygard) e incluir explícitamente 4 registros de decisión:

1. **ADR-001.1: Interfaz CLI/TUI frente a Aplicación Gráfica (GUI/Web).**
2. **ADR-002.1: Persistencia en SQLite embebida frente a archivos planos (JSON/YAML).**
3. **ADR-003.1: LLM Local (Ollama) con Fallback Determinista frente a APIs Cloud (OpenAI/Anthropic).**
4. **ADR-004.1: Almacenamiento local de evidencias en carpeta del ticket frente a Sincronización Automática con Google Drive.**

Para CADA decisión, debes estructurar estrictamente los siguientes apartados:
- **Título y Estado:** [Aprobado]
- **Contexto y Problema:** Qué necesidad o restricción técnica motiva la decisión.
- **Opciones Consideradas:** Alternativa A (Elegida) vs Alternativa B (Descartada).
- **Criterios de Decisión:** Factores clave (rendimiento, simplicidad, costo, privacidad, mantenibilidad).
- **Decisión Elegida:** Justificación clara de por qué se tomó esa opción.
- **Consecuencias y Trade-offs:**
  - 🟢 *Consecuencias Positivas* (Lo que ganamos).
  - 🔴 *Consecuencias Negativas / Riesgos aceptados* (Lo que sacrificamos y cómo lo mitigamos).

=== RESTRICCIONES ===
- Lenguaje: Español técnico profesional.
- Tono: Analítico, objetivo y sin adornos.
- Enfócate en la justificación arquitectónica real, no en teoría genérica.

```



### **2.1. Diagrama de arquitectura:**

**Prompt 1: Prompt para completar `002-arquitectura-del-sistema.md`**

```
Actúa como un Arquitecto de Software Senior y Lead de Infraestructura/DevEx.

=== CONTEXTO DEL PROYECTO Y ARCHIVOS BASE ===
Revisa detenidamente los siguientes archivos presentes en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'docs/PRD.md')
2. 'ADR-001-arquitectura-inicial.md' (Decisiones de arquitectura aprobadas)
3. '002-arquitectura-del-sistema.md' (Plantilla/documento actual de arquitectura a completar)

=== TU MISIÓN EN ESTE TURNO ===
Basándote estrictamente en el PRD y en las decisiones registradas en el ADR-001 (patrón de 3 capas: TUI Layer, Service Layer, Storage Layer; SQLite embebida; Ollama con fallback a texto plano; evidencias locales en '/adjuntos/'), debes COMPLETAR y ACTUALIZAR el archivo '002-arquitectura-del-sistema.md' en las secciones correspondientes a la Entrega 1:

1. **Sección 2.1 — Diagrama de arquitectura (Mermaid):**
   - Diagrama de contexto/componentes en sintaxis Mermaid (`graph TD` o similar) representando las 3 capas (TUI, Services, Storage) y sus relaciones.
   - Diagrama de secuencia E2E (`sequenceDiagram`) en Mermaid detallando el flujo desde que el usuario ejecuta 'dev-tool start ID-123' hasta la creación de la rama Git, invocación de Ollama (con el flujo de fallback) y generación de carpetas/Markdown.
   - Breve justificación del patrón de 3 capas enlazando directamente con los apartados de 'ADR-001-arquitectura-inicial.md'.

2. **Sección 2.2 — Descripción de componentes principales:**
   - Explicación detallada de responsabilidades por capa y componente:
     - **TUI Layer:** Controlador de interfaz de consola Windows.
     - **Service Layer:** Jira REST Client, Ollama AI Transformer (con fallback), Git Manager, FileSystem Manager.
     - **Storage Layer:** SQLite Storage Manager y sistema de archivos local.

3. **Sección 2.3 — Descripción de alto nivel del proyecto y estructura de ficheros:**
   - Árbol de directorios representativo para el repositorio de la herramienta CLI (`/src/tui`, `/src/services`, `/src/database`, `/docs`, `/tests`, etc.).
   - Explicación breve de la responsabilidad de cada carpeta principal.

4. **Sección 3 — Modelo de Datos (SQLite):**
   - **Sección 3.1:** Diagrama ERD en sintaxis Mermaid (`erDiagram`) con entidades, claves y cardinalidades.
   - **Sección 3.2:** Sentencias DDL de SQLite (`CREATE TABLE`) y descripción detallada de atributos para las tablas: `app_config`, `projects_config` y `ticket_logs`.

=== RESTRICCIONES Y REGLAS ===
- Modifica directamente el archivo '002-arquitectura-del-sistema.md' rellenando los bloques marcados como '[A definir]' en las secciones 2.1, 2.2, 2.3 y 3.
- Mantén intacta la estructura general del archivo.
- Asegúrate de que todos los bloques de código Mermaid sean sintácticamente válidos.
- Deja indicadas como '[A definir en Entrega 2]' las secciones correspondientes a infraestructura/despliegue real, pipelines de CI/CD o ejecutables compilados.
- Lenguaje: Español técnico profesional.

```

⚠️ En el prompt quedó la sección 3 - Modelo de datos, Claude code notó que por la convención ya existía el archivo 003-modelo-de-datos.md por lo que separó la información y colocó en ese archivo el diagrama ERD y las sentencias

**Prompt 2: Evaluación Integración con Jira a través MCP Server Vs Jira REST Client**

```
Actúa como un Arquitecto de Software Senior y Lead de Infraestructura/DevEx.

=== CONTEXTO ===
Estamos evaluando la estrategia de integración con Jira para la herramienta 'DevFlow CLI' (Windows 10/11).
Debemos documentar la decisión técnica de usar un 'Jira REST Client' directo (HTTP + API Token) frente a la alternativa de consumir la API a través de un 'MCP Server' (Model Context Protocol como Atlassian Rovo MCP).

=== TU MISIÓN EN ESTE TURNO ===
1. Actualiza el archivo 'docs/ADR-001-arquitectura-inicial.md' añadiendo una sub-sección o registro explícito 'ADR-005.1: Integración directa con Jira REST API frente a consumo vía MCP Server'.
2. Justifica por qué se elige el cliente REST HTTP directo para el MVP:
   - **Garantía de autonomía y resiliencia:** Evita flujos de autenticación OAuth2 con navegador que introducen fricción y violan los Non-Goals del PRD.
   - **Rendimiento y determinismo:** Control preciso de timeouts y disparadores del modo fallback manual (HTTP 401, 403, 404).
   - **Eficiencia de tokens:** El cliente REST parsea JSON directamente sin consumir presupuesto de contexto de un LLM.
3. Actualiza el componente 'Módulo de integración con Jira' en '002-arquitectura-del-sistema.md' reflejando esta decisión.

=== RESTRICCIONES ===
- Utiliza la plantilla estándar de ADR (MADR v3.0) con Contexto, Opciones Consideradas, Decisión y Consecuencias (Pros/Cons).
- Lenguaje: Español técnico profesional.
```


### **2.2. Descripción de componentes principales:**

**Prompt 1:**

```
Actúa como un Arquitecto de Software Principal y Auditor Técnico especializado en Sistemas Modulares y DevEx.

=== CONTEXTO DEL PROYECTO Y ARCHIVOS DE REFERENCIA ===
Revisa los siguientes archivos en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'PRD.md')
2. 'ADR-001-arquitectura-inicial.md'
3. '002-arquitectura-del-sistema.md' (Enfócate específicamente en la Sección 2.2: "Descripción de componentes principales")

=== TU MISIÓN EN ESTE TURNO ===
Audita de manera crítica y exhaustiva la **Sección 2.2 (Descripción de componentes principales)** de '002-arquitectura-del-sistema.md'. Tu objetivo es encontrar vacíos de definición técnica, ambigüedades en las responsabilidades de cada módulo y falta de contratos/interfaces entre capas.

Para cumplir tu misión, realiza las siguientes tareas:

1. **Auditoría Componente por Componente:**
   Analiza cada uno de los componentes de las 3 capas:
   - **Capa TUI (Presentación):** Controller/View de la terminal, captura de inputs, renderizado de estados/spinners.
   - **Capa de Servicios (Negocio e Integraciones):** Jira REST Client, Ollama AI Transformer (con fallback), Git Manager, FileSystem Manager.
   - **Capa de Persistencia:** SQLite Storage Manager y Local File System Storage.

2. **Identificación de Gaps y Definiciones Faltantes:**
   Detecta qué falta especificar en el documento. Pon especial atención a:
   - **Contratos e Interfaces:** ¿Está claro cómo se comunican las capas entre sí (DTOs, eventos, llamadas directas)?
   - **Manejo de Errores y Resiliencia:** ¿Cada componente define cómo reaccionar ante fallos de sus dependencias (ej. tiempo de timeout de Jira/Ollama, repositorios Git bloqueados)?
   - **Inyección de Dependencias y Configuración:** ¿Cómo recibe cada servicio sus parámetros (rutas, tokens, conexión a SQLite)?
   - **Límites de Responsabilidad (*Single Responsibility*):** ¿Hay algún componente asumiendo tareas que corresponden a otra capa?

3. **Matriz de Opciones y Alternativas:**
   Por CADA punto ciego o definición faltante que encuentres, presenta entre 2 y 3 opciones técnicas claras para resolverlo.
   Estructura las opciones indicando:
   - **Opción A / Opción B / Opción C**
   - 🟢 *Ventajas / Pros*
   - 🔴 *Desventajas / Trade-offs*
   - 💡 *Recomendación sugerida*

=== FORMATO DE RESPUESTA ===
Estructura tu reporte así:
1. 🔍 **Diagnóstico General de la Sección 2.2**
2. 🚨 **Gaps y Definiciones Faltantes Identificadas** (Agrupados por componente)
3. 🛠️ **Opciones de Solución y Decisiones Pendientes** (Con pros/contras para que yo pueda elegir)
4. 📝 **Propuesta de Parche/Redacción** (Una vez elegidas las opciones, cómo quedaría el texto mejorado para '002-arquitectura-del-sistema.md')

```

📝 Se tomaron decisiones según creí conveniente, algunas por recomendación otras para definir un poco más el alcance. Se deja la conversación en el archivo .docs/prompts-claude-fase-inicial.md 


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
