En esta sección, se detallan los prompts principales utilizados durante la creación del proyecto, que justifican el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Principalmente los de creación inicial o los de corrección o adición de funcionalidades que consideré más relevantes.

Para el armado de prompts se utilizó Gemini Notebook, comenzando por el armado del prompt para la generación del PRD. Luego, realizó la validación del prompt, realizo las correcciones que creo necesarias y se los paso de forma limpia a Claude Code.
Los prompts principales son adjuntados en este documento. Adicionalmente, en `docs/prompts-claude-fase-inicial.md` se encuentran las conversaciones completas utilizadas para las secciones: Descripción general del producto, Arquitectura del sistema y Modelo de datos. 


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

📝 Se tomaron decisiones según creí conveniente, algunas por recomendación otras para definir un poco más el alcance. Se deja la conversación completa en el archivo `docs/prompts-claude-fase-inicial.md` 


**Prompt 2: Auditoría de Viabilidad Técnica Pre-Código**

```
Actúa como un Arquitecto Principal de Software y Auditor de Viabilidad Técnica.

=== CONTEXTO DEL PROYECTO Y FUENTES DE VERDAD ===
Revisa los archivos de especificación en el repositorio:
1. '001-descripcion-general-del-producto.md' (o PRD.md)
2. 'ADR-001-arquitectura-inicial.md'
3. '002-arquitectura-del-sistema.md' (especialmente la Sección 2.2 sobre Componentes)

=== TU MISIÓN EN ESTE TURNO ===
Agrega el sub-apartado "2.2.1. Viabilidad Técnica de Componentes e Integraciones Pre-Código" dentro del archivo '002-arquitectura-del-sistema.md' (inmediatamente después de la descripción de los componentes principales) y actualiza el resumen en 'readme.md'.

El apartado '2.2.1' debe estructurarse con las siguientes sub-secciones:

1. **Matriz de Viabilidad de Integraciones:**
   - Una tabla Markdown con las columnas: `Componente` | `Mecanismo Técnico` | `Viabilidad` | `Estrategia de Fallback / Resiliencia`.
   - Evalúa Jira REST API (HTTP Directo), Ollama Local (HTTP/JSON), Git Local Engine (CLI commands) y SQLite (DDL local).

2. **Requisitos Previos del Entorno Windows:**
   - Lista explícita de dependencias que la PC del desarrollador debe cumplir para ejecutar la herramienta (ej. puerto 11434 activo para Ollama, Git en PATH, API Token configurado).

3. **Análisis de Riesgos y Puntos de Fricción:**
   - Identificación de posibles fallos (ej. Ollama sin VRAM, timeouts de Jira, permisos de carpeta en Windows) y cómo la arquitectura los absorbe sin romper la TUI.

4. **Dictamen Final de Viabilidad (Readiness Gate):**
   - Declaración formal de que la arquitectura es [100% VIABLE Y CONSTRUIBLE DESDE CERO].

=== RESTRICCIONES ===
- Modifica directamente '002-arquitectura-del-sistema.md' insertando el apartado 2.2.1 sin borrar las secciones 2.1, 2.2 ni 2.3.
- Utiliza lenguaje técnico profesional en español.

```

### **2.3. Descripción de alto nivel del proyecto y estructura de ficheros**

**Prompt 1:**  

```
Actúa como un Arquitecto de Software Senior y Lead de Infraestructura.

=== CONTEXTO Y FUENTES DE VERDAD ===
Revisa los archivos de especificación en el repositorio:
1. '001-descripcion-general-del-producto.md' (o PRD.md)
2. 'ADR-001-arquitectura-inicial.md'
3. '002-arquitectura-del-sistema.md' (especialmente la Sección 2.3: "Descripción de alto nivel del proyecto y estructura de ficheros")

=== TU MISIÓN EN ESTE TURNO ===
Audita y actualiza la sección "2.3. Descripción de alto nivel del proyecto y estructura de ficheros" en '002-arquitectura-del-sistema.md' para garantizar que cumpla con los estándares de documentación técnica y deje 100% explícito el stack técnico.

Asegúrate de cumplir y verificar los siguientes puntos:

1. **Declaración Explícita del Lenguaje y Runtime:**
   - Especifica con claridad el **lenguaje de programación y runtime** seleccionado para el proyecto (ej. TypeScript / Node.js, Go, Python, Rust, etc., según lo definido en la arquitectura/configuración).
   - Especifica la **librería/framework elegida para la TUI** (ej. Ink, Commander, Blessed, Typer, Rich, Bubbletea, etc.) y cómo se organiza dentro de `/src/tui`.

2. **Árbol de Directorios del Repositorio:**
   - Revisa el diagrama de árbol ('tree') del repositorio y verifica que refleje fielmente la separación en 3 capas:
     - `/docs` (PRD, ADRs, arquitectura, modelo de datos, historias, tickets)
     - `/src/tui` (Presentación: controladores de consola, views, prompts de fallback, spinners)
     - `/src/services` (Lógica de negocio: orquestador y clientes para Jira, Ollama, Git, FileSystem)
     - `/src/database` (Persistencia: gestor de SQLite, esquema DDL y migraciones)
     - `/src/shared` (Tipos compartidos, DTOs, contratos e interfaces)
     - `/templates` y `/tests`

3. **Tabla de Responsabilidades por Carpeta:**
   - Confirma que la tabla contenga la relación `Carpeta | Propósito / Lenguaje / Módulos` detallando la responsabilidad técnica de cada directorio y las reglas de acoplamiento.

4. **Sincronización:**
   - Aplica los ajustes directamente en '002-arquitectura-del-sistema.md' y actualiza el resumen correspondiente en 'readme.md'.

=== RESTRICCIONES ===
- Lenguaje: Español técnico profesional.
- No borres ni alteres los diagramas Mermaid ni las secciones 2.1, 2.2 o 2.2.1 ya validadas.

```

⚠️ En este punto, se ha definido el Stack Técnológico. El cual requiere un analisís con más profundidad porque los desarrolladores que usarán la aplicación tienen pc Windows con poco espacio y pocos recursos. Por lo que el siguiente prompt incluirá ese análisis de ese stack antes de la sección de _2.4. Infraestructura y Despliegue_ 


**Prompt 2: Evaluación de Stack en Archivo Independiente**

```
Actúa como un Principal Software Architect y Lead Auditor de Infraestructura.

=== CONTEXTO DEL ENTORNO Y RESTRICCIONES DE HARDWARE ===
Realiza un análisis técnico comparativo para evaluar la opción de **Node.js / TypeScript** frente a otras alternativas para implementar la herramienta 'DevFlow CLI' (Windows 10/11).

El análisis debe considerar las siguientes restricciones operativas reales del parque de PCs del equipo:
1. **Recursos de Hardware Limitados:** PCs con 8 GB de RAM total y ~35 GB de espacio libre en disco.
2. **Carga de Trabajo Existente:** Los desarrolladores mantienen abiertos simultáneamente varios IDEs y herramientas pesadas (IntelliJ IDEA, VSCode, NetBeans, DBeaver, IBM Data Studio).
3. **Software Preinstalado:** Node.js ya está instalado y configurado en el 100% de las máquinas (requerido para proyectos Angular del equipo).

=== TECNOLOGÍAS A COMPARAR VS. NODE.JS / TYPESCRIPT ===
Compara **Node.js / TypeScript** contra las siguientes 5 alternativas:
1. **Shell Script (Bash) + curl + jq** (ejecutado vía Git Bash / WSL)
2. **Java CLI** (ej. Picocli sobre la JVM)
3. **PowerShell** (nativo de Windows)
4. **Python** (usando librerías TUI como Textual)
5. **Go** (compilado nativo usando frameworks TUI como Bubble Tea / Charm)

=== CRITERIOS DE EVALUACIÓN OBLIGATORIOS ===
Para cada tecnología comparada frente a Node.js / TypeScript, analiza:
- **Impacto en Disco:** Necesidad de instalar runtimes/SDKs adicionales vs. reutilizar lo existente (~35 GB libres).
- **Consumo de Memoria RAM:** Huella de memoria en ejecución con IntelliJ / Data Studio activos (límite 8 GB RAM).
- **Rendimiento y TUI en Windows:** Capacidad de renderizar interfaces de consola interactivas (spinners, prompts) en la terminal de Windows.
- **Mantenibilidad y DevEx:** Tipado, manejo de errores, facilidad de pruebas unitarias/mocks y curva de aprendizaje.

=== REGLA ESTRICTA DE ARCHIVO DE SALIDA ===
- **NO modifiques ni actualices ningún archivo existente** (NO toques 'README.md', '002-arquitectura-del-sistema.md' ni ningún otro archivo ya creado).
- Guarda todo el análisis en un **nuevo archivo independiente** ubicado en: `docs/008-evaluacion-stack-tecnologico.md`.

=== ESTRUCTURA DEL DOCUMENTO DE SALIDA ===
Organiza el archivo `docs/008-evaluacion-stack-tecnologico.md` en formato ADR / MADR v3.0 con las siguientes secciones:
1. **Contexto y Problema de Infraestructura**
2. **Criterios de Evaluación (Decision Drivers)**
3. **Análisis Comparativo Detallado** (Node.js/TypeScript vs. Shell/curl/jq, Java CLI, PowerShell, Python y Go)
4. **Tabla Resumen Comparativa** (Tecnología | Impacto Disco | Consumo RAM | TUI Windows | DevEx / Mantenibilidad)
5. **Conclusión y Recomendación Técnica**

=== IDIOMA Y ESTILO ===
- Español técnico profesional.

```
⚠️ Claude code menciona que el mayor riesgo de RAM es Ollama, no la CLI. La idea es ir por qwen2.5:1.5b para la documentación. A evaluar en el desarrollo, o en la segunda entrega.

**Prompt 3:**

```
En el archivo readme se encuentra "Stack técnico ya decidido" modifiquemos esto para que quede a evaluación en la proxima entrega, que se evalua en el documento 008.
``` 

### **2.4. Infraestructura y despliegue**
 
⚠️ Debido a verificación del stack técnico, se completará está sección para la segunda entrega.

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.5. Seguridad**

Prácticas ya decididas a nivel arquitectónico (ver ADR-001)
⚠️ Debido a verificación del stack técnico, si es necesario se completará está sección para la segunda entrega.

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

### **2.6. Tests**

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 3. Modelo de Datos

⚠️ El armado del modelo de datos se había realizado en un paso anterior. Por lo que el siguiente prompt es para validar que cumpla con los requisitos del producto

**Prompt 1:**
```
Actúa como un Database Architect y Auditor de Calidad de Datos especializado en SQLite.

=== MISIÓN ===
Revisa y valida el archivo '003-modelo-de-datos.md' (o 'docs/003-modelo-de-datos.md') en el repositorio.

Verifica únicamente que:
1. Las sentencias SQL (DDL) de SQLite sean sintácticamente correctas (tipos, PK, FK, constraints CHECK, UNIQUE, AUTOINCREMENT).
2. El diagrama Mermaid ('erDiagram') no tenga errores de sintaxis y coincida con las tablas SQL.
3. No existan discrepancias de nombres, tipos o nulabilidad entre el diagrama Mermaid, las tablas descriptivas en Markdown y las sentencias DDL.

=== FORMATO DE RESPUESTA ===
- Si el archivo está 100% correcto: Confirma brevemente que el modelo de datos es válido y no requiere cambios.
- Si requiere cambios: Muestra únicamente las correcciones específicas que hacen falta (o el bloque de código/Markdown corregido), sin agregar secciones de hallazgos, matrices de diagnóstico ni explicaciones extensas.

```

---

### 4. Especificación de la API

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**

---

### 5. Historias de Usuario

**Prompt 1: Generación de Historias de Usuario**

```
Actúa como un Lead Product Owner especializado en Spec-Driven Development (SDD) y Backlogs AI-Ready.

=== CONTEXTO DEL PROYECTO Y FUENTES DE VERDAD ===
Revisa detenidamente los archivos de especificación en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'docs/PRD.md')
2. '002-arquitectura-del-sistema.md'
3. '003-modelo-de-datos.md'
4. 'ADR-001-arquitectura-inicial.md'

=== RESTRICCIONES ESTRICTAS DE FORMATO Y CONTENIDO ===
1. **Archivo de Salida:** Guarda las Historias de Usuario exclusivamente en 'docs/005-historias-de-usuario.md' y sintetiza la sección correspondiente en 'readme.md'.
2. **Cantidad:** Genera EXACTAMENTE 3 Historias de Usuario (US-01, US-02, US-03).
3. **Marcadores Obligatorios:**
   - Si asumes algún detalle no explícito en la documentación base, márcalo explícitamente como "(asumido)".
   - Si encuentras alguna ambigüedad o definición pendiente, márcala explícitamente como "(ambiguo)".
4. **Estructura Estricta de Salida:** CADA Historia de Usuario debe seguir idéntica estructura y sintaxis de criterios de aceptación (Given / When / Then / And):

US-XX: [Título de la Historia]
		**COMO** [rol del usuario]
		**QUIERO** [acción o funcionalidad]
		**PARA** [beneficio o valor de negocio]
**Criterios de Aceptación:**
		1. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].
		2. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].
		3. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].

=== TU MISIÓN EN ESTE TURNO ===
Genera el archivo 'docs/005-historias-de-usuario.md' cubriendo los siguientes 3 flujos:

1. **US-01: Configuración inicial de repositorios y parámetros locales en SQLite**
   - Configurar la ruta raíz de documentación y el mapeo de repositorios locales en SQLite.
   - Criterios de Aceptación: Registro correcto de rutas (Happy Path), manejo de rutas inexistentes o sin permisos en Windows, y actualización de parámetros existentes.

2. **US-02: Consulta REST a Jira con mecanismo de Fallback Manual**
   - Consultar el ID del ticket en la API de Jira para obtener título y descripción.
   - Criterios de Aceptación: Consulta exitosa HTTP 200 OK, fallo por red/timeout o token inválido 401/403 (activando la carga manual por prompt TUI), y ticket no encontrado HTTP 404.

3. **US-03: Automatización de Rama Git, Estructura de Carpetas y Documento Markdown con Ollama**
   - Crear rama Git en el repo correspondiente, generar carpeta local `/ticket-ID/adjuntos/` y procesar plantilla Markdown con Ollama.
   - Criterios de Aceptación: Ejecución completa exitosa con Ollama activo, comportamiento en caso de Ollama offline/timeout (Fallback Determinista a texto plano con aviso ⚠️), y rama Git ya existente.

=== RESTRICCIONES ===
- Respeta estrictamente la plantilla de texto y la sangría para los Criterios de Aceptación.
- No alteres los nombres de las etiquetas (**COMO**, **QUIERO**, **PARA**, **Criterios de Aceptación:**).
- No generes tickets técnicos ni código fuente todavía.
```

**Prompt 2: Corrección de Historias de usuario**

```
Actúa como un Lead Product Owner Senior experto en Spec-Driven Development (SDD) y el marco INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable).

=== CONTEXTO Y PROBLEMA ===
Las Historias de Usuario en 'docs/005-historias-de-usuario.md' quedaron sobrecargadas con detalles técnicos de implementación, haciéndolas complejas de leer y perdiendo el enfoque de valor para el usuario.

=== TU MISIÓN EN ESTE TURNO ===
Reformula por completo el archivo 'docs/005-historias-de-usuario.md' aplicando las mejores prácticas de redacción de User Stories e INVEST:

1. **Aplica Principios INVEST:**
   - **Valuable & User-Centric:** La narrativa (COMO / QUIERO / PARA) debe enfocarse en la necesidad funcional y el valor de negocio (eliminar fricción, estandarizar), evitando detalles internos de código o nombres de clases/funciones en la declaración de la historia.
   - **Small & Clear:** Mantén las frases concisas, directas y fáciles de entender por cualquier miembro del equipo (Dev, QA, PO).
   - **Testable:** Criterios de aceptación limpios y verificables en formato Gherkin.

2. **Marcadores de Transparencia:**
   - Si asumes algún detalle no especificado en la documentación base, márcalo explícitamente como "(asumido)".
   - Si detectas un punto sin definir o ambiguo, márcalo explícitamente como "(ambiguo)".

3. **Estructura Estricta e Innegociable de Salida:**
   CADA una de las 3 Historias de Usuario (US-01, US-02, US-03) debe seguir exactamente esta plantilla de texto y sangría:

US-XX: [Título corto y descriptivo]
**COMO** [rol claro]
**QUIERO** [acción funcional concisa]
**PARA** [beneficio o valor de negocio directo]
**Criterios de Aceptación:**
		1. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].
		2. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].
		3. Given [contexto inicial], When [acción o evento], Then [resultado esperado], And [resultado adicional].

=== ALCANCE DE LAS 3 HISTORIAS ===

- **US-01: Configuración inicial de repositorios y rutas locales**
  - Enfocada en que el desarrollador pueda registrar la carpeta raíz y sus repositorios locales fácilmente.

- **US-02: Consulta automática de ticket de Jira con fallback manual**
  - Enfocada en obtener el contexto del ticket desde Jira para evitar el cambio de contexto, solicitando datos manualmente solo si falla la conexión.

- **US-03: Preparación automática del entorno de desarrollo (Git, carpetas y plantilla Markdown)**
  - Enfocada en crear la rama de Git, las carpetas de evidencias y la plantilla enriquecida con Ollama (o texto plano si Ollama no está disponible) en un solo paso.

=== RESTRICCIONES ===
- Sobrescribe directamente el archivo 'docs/005-historias-de-usuario.md' y actualiza la sección correspondiente en 'readme.md'.
- No cambies los nombres de los bloques (**COMO**, **QUIERO**, **PARA**, **Criterios de Aceptación:**).
- Asegúrate de que los escenarios de Gherkin sean legibles, unívocos y libres de jerga técnica innecesaria.

```

**Prompt 3: Agregar Prioridad, Orden y Dependencias a las US**
```
Actúa como un Lead Product Owner Senior experto en Spec-Driven Development (SDD) y gestión de Backlogs.

=== CONTEXTO ===
Ya has creado las 3 Historias de Usuario en 'docs/005-historias-de-usuario.md'. Ahora necesitamos enriquecerlas añadiendo a cada una su priorización, secuencia lógica y dependencias técnicas.

=== TU MISIÓN EN ESTE TURNO ===
Lee el archivo 'docs/005-historias-de-usuario.md' y actualízalo en el lugar (in-place), manteniendo intactos los textos de las historias, la narrativa (**COMO**, **QUIERO**, **PARA**) y los criterios de aceptación en Gherkin.

Para CADA Historia de Usuario (US-01, US-02, US-03), agrega inmediatamente debajo del título la siguiente metadata:

1. **US-01 (Configuración inicial de repositorios y rutas locales):**
   - **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 1 | **Esfuerzo:** Medio
   - **Dependencias Previas:** Ninguna

2. **US-02 (Consulta automática de ticket de Jira con fallback manual):**
   - **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 2 | **Esfuerzo:** Medio
   - **Dependencias Previas:** US-01

3. **US-03 (Preparación automática del entorno de desarrollo: Git, carpetas y Markdown):**
   - **Prioridad (MoSCoW):** Must Have | **Orden de Secuencia:** 3 | **Esfuerzo:** Alto
   - **Dependencias Previas:** US-01, US-02

=== RESTRICCIONES ===
- Modifica directamente 'docs/005-historias-de-usuario.md' y sincroniza la sección correspondiente en 'readme.md'.
- No modifiques ni borres los Criterios de Aceptación ni el contenido que ya redactaste, solo inyecta los campos de metadata.
- Mantén marcados los "(asumido)" o "(ambiguo)" si los habías incluido.

```

---

### 6. Tickets de Trabajo

**Prompt 1:**


```
Actúa como un Principal Software Engineer y Lead Técnico especializado en Spec-Driven Development (SDD) y Tickets AI-Ready.

=== CONTEXTO DEL PROYECTO Y FUENTES DE VERDAD ===
Revisa detenidamente los archivos de especificación en el repositorio:
1. '001-descripcion-general-del-producto.md' (o 'docs/PRD.md')
2. '002-arquitectura-del-sistema.md'
3. '003-modelo-de-datos.md'
4. 'ADR-001-arquitectura-inicial.md'
5. 'docs/005-historias-de-usuario.md' (Historias de Usuario US-01, US-02 y US-03)

=== RESTRICCIONES ESTRICTAS ===
1. **Archivo de Salida:** Guarda los tickets técnicos exclusivamente en 'docs/006-tickets-de-trabajo.md' y sintetiza la sección correspondiente en 'readme.md'.
2. **Cantidad:** Genera EXACTAMENTE 3 Tickets Técnicos (desglosados por capa: Base de Datos, Backend/Servicios y Frontend/TUI).
3. **Marcadores Obligatorios:**
   - Si asumes algún detalle no explícito en la documentación base, márcalo explícitamente como "(asumido)".
   - Si detectas un punto ambiguo o pendiente de definición, márcalo explícitamente como "(ambiguo)".
4. **Formato Homogéneo 'AI-Ready':** CADA ticket debe seguir exactamente la siguiente estructura de secciones:

---
### [ID-TICKET]: [Título claro del ticket]
- **Capa / Módulo:** [Base de Datos / Backend-Servicios / Frontend-TUI]
- **Historias de Usuario Relacionadas:** [US-01, US-02, US-03 según corresponda]
- **Descripción y Alcance:** [Explicación técnica detallada del trabajo a realizar]
- **Archivos a Crear / Modificar:** [Lista explícita de rutas de archivos en src/]
- **Contratos e Interfaces (Input/Output):** [Estructuras de datos, DTOs, parámetros o firmas de funciones]
- **Criterios de Aceptación Técnicos:** [Pruebas y validaciones unitarias/técnicas necesarias]
- **Definition of Done (DoD):** [Lista de verificación de finalización técnica]
---

=== TU MISIÓN EN ESTE TURNO ===
Genera el archivo 'docs/006-tickets-de-trabajo.md' redactando los siguientes 3 tickets:

1. **TK-01 (Capa Base de Datos): Implementación del Esquema SQLite DDL y Módulo StorageManager**
   - **Enfocado en:** Creación de las tablas 'app_config', 'projects_config' y 'ticket_logs', DDLs, migraciones iniciales y métodos CRUD de persistencia.
   - **Relación:** Vinculado a US-01, US-02 y US-03.

2. **TK-02 (Capa Backend / Servicios): Implementación de JiraRestClient, OllamaAITransformer y Orquestador**
   - **Enfocado en:** Cliente REST direct HTTP para Jira, servicio de formateo con Ollama (y manejo del Fallback a texto plano), cliente GitManager para creación de ramas y FileSystemManager para carpetas/Markdown.
   - **Relación:** Vinculado a US-02 y US-03.

3. **TK-03 (Capa Frontend / TUI): Controlador CLI e Interfaz Interactiva de Terminal Windows**
   - **Enfocado en:** Parsing de comandos CLI ('devflow start ID-123'), renderizado de vistas/prompts interactivos en terminal, spinners de progreso asíncrono y pantallas de Fallback Manual.
   - **Relación:** Vinculado a US-01, US-02 y US-03.

=== RESTRICCIONES ===
- Respeta estrictamente la plantilla y los nombres de las secciones para cada ticket.
- No generes código fuente de la aplicación aún (solo la especificación detallada de los tickets técnicos).

```

**Prompt 2:**

```
Necesitamos enriquecer los tickets técnicos añadiendo a cada una su priorización, secuencia lógica y dependencias técnicas similar a las historias de usuario
```


---

### 7. Pull Requests

**Prompt 1:**

**Prompt 2:**

**Prompt 3:**
