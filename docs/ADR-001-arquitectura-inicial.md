# ADR-001: Arquitectura Inicial — DevFlow CLI

| Campo | Detalle |
|---|---|
| **Fecha** | 2026-09-25 |
| **Estado general** | Aprobado |
| **Autores** | Andrea Rocha |
| **Contexto del producto** | Ver `docs/PRD.md` |

---

## 0. Evaluación del patrón arquitectónico modular propuesto (TUI Layer / Service Layer / Storage Layer)

**Patrón propuesto:** una separación en tres capas —

- **TUI Layer:** interacción con el desarrollador (prompts, selección de ticket/repositorio, confirmación de acciones, render del resultado).
- **Service Layer:** lógica de negocio y orquestación (cliente Jira, cliente Git, procesador Ollama, generador de documento/carpetas).
- **Storage Layer:** acceso a SQLite (configuración, historial) y al sistema de archivos (carpeta del ticket, adjuntos).

**Evaluación crítica:**

El patrón es correcto como punto de partida y aporta lo esencial: la TUI puede sustituirse (hoy texto interactivo, mañana un modo `--batch` no interactivo para CI) sin tocar la lógica de negocio, y el Storage Layer puede migrar de SQLite a otro motor sin que el resto del sistema lo note. Para una herramienta de un solo desarrollador-consumidor por ejecución, tres capas es proporcional: ni un monolito de un solo archivo, ni una arquitectura hexagonal completa con puertos/adaptadores que sería sobre-ingeniería para este alcance.

El riesgo real no está en las tres capas en sí, sino en **tratar la Service Layer como un único servicio monolítico** (`TicketService.iniciar(ticketId)`). El PRD ya define múltiples ramas de fallo independientes por integración (Jira: red / token / 404; Ollama: no disponible / timeout / sin modelo) que deben poder fallar y degradarse de forma aislada sin que un fallo en una tumbe a las demás. Si la Service Layer se implementa como una función lineal que llama a Jira, luego a Git, luego a Ollama en secuencia rígida, cualquier excepción no distinguida rompe el flujo completo — exactamente lo que el PRD prohíbe (H1/H3 del PRD ya corregidos).

**Ajuste exigido a la Service Layer, no al patrón de 3 capas:** organizarla como un **orquestador de pasos independientes** (uno por integración: `ConsultarJira`, `CrearRama`, `CrearCarpetas`, `ProcesarConOllama`), cada uno con su propio contrato de resultado (`Ok | FallbackManual | FallbackDeterminista`), en vez de un único método con try/catch anidados. Esto no cambia el número de capas ni su responsabilidad; solo evita que la Service Layer se vuelva, en la práctica, una cuarta capa oculta sin estructura.

Con ese ajuste, el patrón de 3 capas se considera **válido y suficiente** para el MVP.

---

## ADR-001.1: Interfaz CLI/TUI frente a Aplicación Gráfica (GUI/Web)

**Título y Estado:** Interfaz CLI/TUI frente a GUI/Web — **[Aprobado]**

**Contexto y Problema:**
La herramienta debe integrarse en el flujo diario de 5 desarrolladores que ya operan sobre Windows 10/11 y ya viven en una terminal para usar Git. Se necesita un punto de entrada único, de arranque instantáneo, sin instalador pesado ni runtime adicional (navegador embebido), y que no reintroduzca un componente web — condición ya fijada como Non-Goal en el PRD para no requerir flujos de autenticación OAuth con redirección a navegador.

**Opciones Consideradas:**
- **A — CLI/TUI nativa de terminal (Elegida):** interfaz de texto interactiva (prompts, listas, confirmaciones) ejecutada directamente en la consola de Windows.
- **B — Aplicación de escritorio o panel web local (Descartada):** GUI empaquetada con Electron/Tauri, o un servidor local con interfaz servida en el navegador.

**Criterios de Decisión:**
Tiempo de arranque en frío, tamaño de distribución/instalación, superficie de ataque (un servidor web local expone un puerto, aunque sea en loopback), alineación con el flujo de trabajo real (terminal-first, ya usado para Git), coherencia con la decisión de autenticación sin navegador.

**Decisión Elegida:**
Se elige CLI/TUI. Un binario/script único que arranca en milisegundos, sin proceso de instalación tipo MSI ni runtime de navegador embebido, es coherente con un equipo que ya opera en terminal para el 100% de sus interacciones con Git. Descarta además, por construcción, la necesidad de resolver cómo servir y proteger una interfaz web local — problema que la opción B habría introducido sin necesidad.

**Consecuencias y Trade-offs:**
- 🟢 Arranque prácticamente instantáneo; distribución como ejecutable único sin dependencias de runtime pesado; superficie de ataque mínima (sin puertos ni servidor local); consistente con el resto de las decisiones (sin OAuth, sin componente web).
- 🔴 La TUI limita la experiencia visual (sin capturas de pantalla embebidas, sin previsualización rica del Markdown generado) y es menos accesible para roles no técnicos (QA/DevOps) que no operan habitualmente en terminal. Se mitiga porque el artefacto de consumo de QA/DevOps es el **documento Markdown generado**, no la TUI en sí — QA nunca necesita abrir la herramienta, solo leer el documento resultante en el repositorio o carpeta del ticket.

---

## ADR-002.1: Persistencia en SQLite embebida frente a archivos planos (JSON/YAML)

**Título y Estado:** Persistencia en SQLite embebida frente a archivos planos — **[Aprobado]**

**Contexto y Problema:**
La herramienta debe persistir configuración local (rutas de repositorios, convenciones del equipo, referencia a credenciales de Jira) e ir acumulando un **historial de tickets procesados**, sobre el cual el PRD ya apoya una métrica de éxito ("tasa de éxito sin fallback", medida durante el primer mes de adopción). Se necesita un mecanismo de almacenamiento local, sin servidor, que tolere escritura repetida a lo largo del tiempo sin corromperse.

**Opciones Consideradas:**
- **A — SQLite embebida (Elegida):** base de datos de archivo único, sin proceso servidor, con soporte transaccional.
- **B — Archivos planos JSON/YAML (Descartada):** un archivo de configuración y un archivo (o uno por ticket) de historial en disco.

**Criterios de Decisión:**
Integridad ante escritura repetida/concurrente (evitar corrupción si dos ejecuciones del CLI escriben historial casi al mismo tiempo), capacidad de consulta filtrada (para poder calcular la métrica de "tasa de éxito sin fallback" sin parsear manualmente N archivos), dependencias/infraestructura (cero servidor en ambos casos), legibilidad humana/diffabilidad (ventaja natural de JSON/YAML), simplicidad de implementación inicial.

**Decisión Elegida:**
Se elige SQLite. El historial de tickets no es un dato que se lea una vez: es la fuente de la métrica de adopción del PRD, que requiere agregaciones (conteos, porcentajes, filtrado por fecha/proyecto) — exactamente el caso de uso para el que un archivo plano obliga a reimplementar a mano lo que SQL ya resuelve. Las garantías transaccionales (ACID) de SQLite además evitan corrupción si el historial se escribe repetidamente a lo largo del día sin que el desarrollador lo perciba.

**Consecuencias y Trade-offs:**
- 🟢 Consultas SQL directas para las métricas del PRD sin código de agregación manual; integridad transaccional ante escrituras repetidas; sigue siendo cero-infraestructura (archivo único embebido, sin proceso servidor).
- 🔴 El archivo `.db` no es legible ni diffable en control de versiones (a diferencia de JSON/YAML), y no se versiona — vive en el directorio de datos de usuario local, fuera del repositorio, por lo que su pérdida no es recuperable vía Git. Se mitiga documentando su ubicación y dejando la reconstrucción de configuración (no del historial) como un flujo de re-onboarding trivial de la herramienta.

---

## ADR-003.1: LLM Local (Ollama) con Fallback Determinista frente a APIs Cloud (OpenAI/Anthropic)

**Título y Estado:** LLM Local (Ollama) con Fallback Determinista frente a APIs Cloud — **[Aprobado]**

**Contexto y Problema:**
El texto crudo de los tickets de Jira puede contener información interna del negocio (nombres de clientes, detalles de funcionalidades no públicas, datos de otros proyectos del portfolio). Se necesita estructurar ese texto en Markdown (Gherkin incluido) sin depender de conectividad saliente permanente ni de un costo variable por token que escale con 5 desarrolladores ejecutando el flujo varias veces al día sobre 6 proyectos, y sin bloquear el flujo si el mecanismo de IA no responde (ya definido como requisito no negociable en el PRD).

**Opciones Consideradas:**
- **A — LLM local vía Ollama, con fallback determinista (Elegida):** modelo ejecutado en la máquina del desarrollador; si no está disponible, el documento se genera igual con el texto crudo sin estructurar, marcado para completar manualmente.
- **B — API Cloud (OpenAI/Anthropic) (Descartada para el MVP):** llamada remota a un proveedor externo de LLM.

**Criterios de Decisión:**
Privacidad/exfiltración de datos internos hacia un tercero, costo marginal por invocación a escala de equipo, disponibilidad sin depender de conectividad saliente (redes corporativas con proxies/firewalls restrictivos), previsibilidad de latencia (sin rate-limits de terceros), calidad de la generación (criterio en el que la opción B es objetivamente superior).

**Decisión Elegida:**
Se elige Ollama local. El criterio de privacidad es determinante: el contenido de un ticket de Jira interno no debería salir de la red del equipo hacia un proveedor externo solo para dar formato a un documento. A esto se suma que el costo marginal de una API cloud, multiplicado por 5 desarrolladores ejecutando el flujo por cada ticket que toman, es un costo operativo recurrente evitable con hardware ya amortizado. Se acepta explícitamente una calidad de generación inferior a un modelo cloud de última generación, mitigada porque el LLM **solo estructura texto, nunca genera código ni es la fuente de verdad** (el documento es siempre un borrador que el desarrollador revisa), y porque el fallback determinista ya aprobado en el PRD garantiza que un fallo del modelo nunca bloquea ni corrompe el flujo.

**Consecuencias y Trade-offs:**
- 🟢 Cero exfiltración de datos internos a terceros; cero costo marginal por token/uso; funciona sin conexión saliente a internet (solo requiere red interna hacia Jira); latencia predecible, sin rate-limits externos.
- 🔴 Calidad de estructuración inferior a un modelo cloud de última generación (riesgo de Gherkin mal formado o resúmenes menos precisos) y requisito de instalación/mantenimiento de Ollama y un modelo local en cada máquina del equipo (footprint de disco/RAM). Se mitiga con el fallback determinista (nunca bloquea, y el texto crudo sigue siendo una base de trabajo válida) y con que el desarrollador siempre revisa y edita el documento antes de darlo por completo — el LLM no es la última palabra.

---

## ADR-004.1: Almacenamiento local de evidencias en carpeta del ticket frente a Sincronización Automática con Google Drive

**Título y Estado:** Almacenamiento local en carpeta del ticket frente a sincronización con Google Drive — **[Aprobado]**

**Contexto y Problema:**
Las evidencias de prueba (capturas, logs, archivos adjuntos) necesitan un lugar predecible donde QA pueda encontrarlas para cada ticket. Hoy se gestionan libremente en Google Drive, sin convención. Introducir sincronización automática vía la API de Google Drive implicaría, además, resolver un flujo de autenticación OAuth con redirección a navegador — el mismo problema que ADR-001.1 decidió evitar explícitamente.

**Opciones Consideradas:**
- **A — Carpeta local `/ticket-ID/adjuntos/` (Elegida):** estructura de carpetas generada automáticamente junto al documento del ticket, en el sistema de archivos local.
- **B — Sincronización automática con Google Drive vía API (Descartada para el MVP; diferida a v2):** subida automática de adjuntos a una carpeta remota de Drive.

**Criterios de Decisión:**
Complejidad de integración (Drive requiere OAuth y gestión de tokens, contradiciendo ADR-001.1), tiempo de desarrollo del MVP, dependencia de conectividad para una operación básica (guardar un archivo), gobernanza de permisos de acceso compartido, alcance mínimo viable para validar el flujo principal antes de sumar integraciones externas.

**Decisión Elegida:**
Se elige almacenamiento local. Reutiliza directamente la decisión de ADR-001.1 de no introducir ningún flujo OAuth/navegador, no depende de conectividad para una operación tan elemental como guardar un archivo, y reduce el alcance técnico del MVP a lo estrictamente necesario para validar que el flujo principal (Jira → Git → carpetas → documento) funciona de punta a punta. La sincronización con Drive queda explícitamente diferida a v2, una vez validado ese flujo base con el equipo.

**Consecuencias y Trade-offs:**
- 🟢 Cero dependencia de red para gestionar adjuntos; cero necesidad de gestionar tokens/permisos de una integración externa adicional; implementación trivial mediante operaciones de sistema de archivos; consistente con la decisión de "sin OAuth" de ADR-001.1.
- 🔴 Sin backup automático fuera de la máquina del desarrollador (riesgo de pérdida ante falla de disco local) y sin acceso remoto directo para QA sin acceso a la máquina o red compartida del desarrollador. Ambos riesgos se aceptan explícitamente para el MVP — el primero mitigable con la política de backup de equipo/IT ya existente, el segundo señalado en el PRD como la motivación concreta para la sincronización con Drive planificada en v2.

---

## ADR-005.1: Integración directa con Jira REST API frente a consumo vía MCP Server

**Título y Estado:** Cliente REST HTTP directo frente a MCP Server (Model Context Protocol) para la integración con Jira — **[Aprobado]**

**Contexto y Problema:**
El **Jira REST Client** de la Service Layer (ver ADR-001.1 y `002-arquitectura-del-sistema.md`, §2.2) necesita obtener el contexto de un ticket a partir de su ID. Existen dos formas de resolver esa integración: llamar directamente al endpoint REST de Jira, o consumirla indirectamente a través de un **MCP Server** (Model Context Protocol) — por ejemplo, Atlassian Rovo MCP — que expone Jira como una herramienta consumible por un agente/LLM. Esta decisión determina el protocolo de comunicación, el mecanismo de autenticación y el costo de cada consulta, y debe ser coherente con las decisiones ya aprobadas de no introducir flujos OAuth con navegador (ADR-001.1) y de no depender de un LLM cloud (ADR-003.1).

**Opciones Consideradas:**
- **A — Cliente REST HTTP directo, autenticado con API Token (Elegida):** el Jira REST Client llama directamente a los endpoints REST de Jira (`GET /rest/api/*/issue/{id}`) y parsea la respuesta JSON con un mapeo determinista a `ContextoTicket`.
- **B — Consumo vía MCP Server, p. ej. Atlassian Rovo MCP (Descartada para el MVP):** el Jira REST Client delega la consulta a un servidor MCP intermedio, que expone la operación como una herramienta invocable por un agente/LLM y devuelve el resultado mediado por ese protocolo.

**Criterios de Decisión:**
- **Garantía de autonomía y resiliencia:** independencia de un proceso intermedio adicional y de su disponibilidad; compatibilidad con el mecanismo de autenticación ya aprobado.
- **Rendimiento y determinismo:** control preciso de timeouts y de qué código de respuesta dispara cada rama del fallback manual.
- **Eficiencia de recursos (tokens/cómputo):** costo de procesar la respuesta de Jira para obtener `ContextoTicket`.
- **Coherencia arquitectónica:** alineación con ADR-001.1 (sin OAuth/navegador) y ADR-003.1 (sin dependencia de un LLM para operaciones deterministas).

**Decisión Elegida:**
Se elige el cliente REST HTTP directo, por tres razones concretas:

1. **Garantía de autonomía y resiliencia:** Atlassian Rovo MCP y los MCP Server de Jira en general se autentican típicamente mediante OAuth2 con flujo de autorización por navegador — exactamente el componente que ADR-001.1 descartó explícitamente para no introducir fricción ni una superficie de ataque adicional en la herramienta. Un cliente REST directo se autentica con el mismo API Token/PAT ya decidido, sin depender de un proceso MCP externo que deba estar instalado, actualizado y disponible en la máquina del desarrollador — una dependencia y un punto de fallo adicional que el MVP no necesita.
2. **Rendimiento y determinismo:** el fallback manual del PRD depende de distinguir con precisión un código HTTP 401/403 (token inválido) de un 404 (ticket inexistente) o un timeout (red caída). Un cliente REST directo controla esa clasificación en una sola capa; un MCP Server añade una capa de traducción de protocolo entre el cliente y Jira cuyo comportamiento ante esos mismos códigos de error no está bajo el control del equipo, dificultando garantizar la distinción de causas ya exigida en ADR-001.1.
3. **Eficiencia de tokens:** un cliente REST parsea la respuesta JSON de Jira de forma determinista (mapeo campo a campo), sin consumir presupuesto de contexto de ningún LLM para esa operación. Un MCP Server, al estar diseñado para ser consumido por un agente/LLM, introduce ese costo de tokens en una operación —obtener el contexto de un ticket— que no requiere ningún tipo de razonamiento o comprensión de lenguaje natural, solo una llamada HTTP y un mapeo de datos estructurados.

**Consecuencias y Trade-offs:**
- 🟢 Cero dependencia de un proceso MCP externo o de su disponibilidad; autenticación 100% consistente con ADR-001.1 (sin OAuth/navegador); clasificación de errores HTTP bajo control total del equipo, exactamente como la exige el fallback manual del PRD; sin costo de tokens en una operación puramente mecánica.
- 🔴 El equipo asume directamente el mantenimiento del cliente REST ante cambios de versión de la API de Jira (Cloud vs. Data Center, versionado de endpoints), responsabilidad que un MCP Server oficial de Atlassian absorbería por su cuenta. Se mitiga aislando por completo esa responsabilidad dentro del **Jira REST Client** (Service Layer): es el único componente que conoce el contrato de la API de Jira, de modo que un cambio de versión se resuelve en un solo lugar sin propagarse al resto del sistema. Se deja explícitamente abierta la puerta a reevaluar un MCP Server en versiones futuras si el ecosistema MCP de Atlassian estabiliza una autenticación sin navegador.
