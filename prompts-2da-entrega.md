# Prompts — 2.ª entrega

> Rama de la entrega: `feature/entrega-2-ANR`

## Contexto de trabajo

Antes de escribir código, usé Claude para hacer un **análisis previo** que probara las integraciones con **Ollama** y **Jira**. Las decisiones que salieron de ese análisis quedaron registradas en la rama `rama-prueba`, en el archivo `VALIDACION-PRE-CODIGO.md`.

También le pedí a Claude un documento de **retrospectiva**, `RETROSPECCION.md`, para usarlo como insumo en esta segunda entrega.

## Skills de trabajo

Con ayuda de **Gemini Notebook** creé varias *skills*. Después se las pasé a Claude para que las revisara y las corrigiera, de modo que se ejecuten **en orden**, cada una a partir del resultado de la anterior:

| Orden | Skill | Propósito |
|---|---|---|
| 1 | `01-explorar-coherencia` | Explorar el estado real del repositorio y la documentación |
| 2 | `02-crear-backlog` | Crear historias de usuario válidas |
| 3 | `03-refinar-historia` | Definir el contrato BDD y el plan técnico |
| 4 | `04-tdd-pair` | Implementar con TDD (Red → Green → Refactor) |
| 5 | `05-verificar-y-revisar` | Control de calidad: verificar y revisar el resultado |

---

## Inicio del desarrollo desde la rama `feature/entrega-2-ANR`

**Skill 1: Invocación a la skill `01-explorar-coherencia`.**

**Prompt 1: Volcar las decisiones en la documentación.**

```text
Estamos en la rama feature/entrega-2-ANR, creada desde la Entrega 1 (48952cf). Todavía NO hay código.

Después de la Entrega 1 validé integraciones y tomé decisiones que están registradas en otra rama. Léelas con:
  git show rama-prueba:VALIDACION-PRE-CODIGO.md
Ese archivo contiene el historial de iteraciones; a los docs solo van las DECISIONES FINALES. No copies ese archivo a esta rama. Si contradice algo de esta lista, manda esta lista:

DECISIONES FINALES
- Jira Cloud, API REST v2 (descripción en texto plano), auth Basic email + API token. Ante un 404 en /issue o /project, llamar a /myself: 401 = token inválido, 200 = no existe. Claves de proyecto validadas con GET /rest/api/2/project/{key} al darlas de alta (la JQL ignora claves inexistentes sin error).
- Claves: el usuario da de alta una o más claves de proyecto. Cada clave tiene 0..N repositorios opcionales con nombre (backend, frontend…), ruta local y rama base (por defecto main, editable).
- Ejecución: UN repositorio por ejecución, elegido de la lista de la clave. Para varios repos se ejecuta varias veces, una tras otra. Un documento (y su carpeta adjuntos/) por ticket y repositorio. La Fase 1 de Ollama se genera una vez por ticket y se copia en el documento del siguiente repo. Una clave sin repositorios genera solo el documento, sin rama.
- `devflow start` sin ID muestra los tickets abiertos asignados al usuario en sus claves (assignee = currentUser(), statusCategory != Done, sin épicas).
- Ramas: <prefijo>/<ID>-<SUFIJO>, p. ej. features/SCRUM-1-AROCHA y bugs/SCRUM-2-AROCHA. El prefijo depende del tipo de issue. El sufijo se configura una vez y se sugiere desde el displayName de /myself (inicial del nombre + último apellido, sin acentos, en mayúsculas).
- Git Manager (CAMBIO DE DECISIÓN respecto del ADR original):
  1. Verifica que el repo exista.
  2. git status --porcelain: si hay cambios pendientes, se detiene y los lista.
  3. Si la rama ya existe, informa y continúa.
  4. Hace pull de la rama base sin importar la rama actual: git pull --ff-only origin <base> si está en ella, o git fetch origin <base>:<base> si está en otra.
  5. Crea la rama con git switch -c <rama> <base>.
  6. Si el pull falla, error bloqueante (nunca crear la rama desde una base vieja).
  7. Nunca commit, add ni push.
  8. Override puntual con --base.
- Tipos de issue: Epic/Épica bloqueadas (aviso, sin rama ni documento). Bug/Error/Defecto → plantilla bug, prefijo bugs. Story/Historia/Task/Tarea/Subtarea/Sub-task y el resto → plantilla historia, prefijo features. La "estructura idéntica" del documento pasa a ser idéntica POR TIPO.
- Ollama:
  - Modelo mínimo qwen2.5:3b (el 1.5b queda descartado por calidad). ollama_timeout_seconds por defecto 120 (medido: 30–105 s por ticket solo con CPU), streaming para mostrar progreso, keep_alive corto.
  - Salida estructurada pasando el JSON Schema del tipo en `format`. El JSON Schema es la fuente de verdad (validado con Ajv), no Zod.
  - El primer campo del schema es `presenteEnTicket`, seguido de un posprocesado determinista en código (ver templates/README.md en rama-prueba).
- Prompts y plantillas: archivos versionados en ./templates/. Se registra prompt_version en ticket_logs.
- Modelo de datos:
  - app_config: + jira_email, + tickets_root_path, + branch_user_suffix; prefijos por defecto features/bugs; ollama_model qwen2.5:3b; ollama_timeout_seconds 120.
  - projects_config se reemplaza por jira_projects + repositories.
  - ticket_logs: una fila por (ticket_id, repository_id) con upsert; + repository_id nullable, issue_type, base_branch, branch_status ('created','already_existed','pending_changes','error'), ollama_status incluye 'reused', prompt_version.
  - DDL completo en la §8.4 del registro.
- Stack (ADR-006.1 pasa de Propuesto a ACEPTADO): Node.js ≥ 22.13 + TypeScript strict, node:sqlite (sin compilación nativa), Commander + @inquirer/prompts + un spinner simple, SIN Ink (Ink e inquirer compiten por stdin), Handlebars, Ajv, Vitest, msw.

ARCHIVOS A ACTUALIZAR
- docs/PRD.md
- docs/ADR-001-arquitectura-inicial.md: actualizar ADR-003.1 y agregar un ADR nuevo para el cambio de alcance del Git Manager, registrado como cambio de decisión con su motivo, sin reescribir la decisión original.
- docs/008-evaluacion-stack-tecnologico.md (estado Aceptado + medición inicial de Ollama)
- docs/001, docs/002 (prosa + diagramas Mermaid de componentes y de secuencia), docs/003 (DDL + ERD Mermaid), docs/005 (US-01 a US-03), docs/006 (TK-01 a TK-03)
- README.md (solo los resúmenes; enlaza a docs/)
- CLAUDE.md: reemplaza el bullet del Git Manager y agrega una sección "Reglas de implementación" con estas restricciones técnicas en forma de lista corta, para que las lean todas las sesiones siguientes.

REGLAS
- Docs en español. Nombres de archivo sin acentos.
- NO cambies la estructura de secciones existente: solo el contenido. Si algo exige reestructurar, pregúntame primero.
- Los diagramas Mermaid se actualizan junto con la prosa.
- No crees código ni la carpeta finalproject-ANR/ todavía.

Al terminar, dame la lista de archivos modificados.
Cada resultado tiene que ser una mención histórica (p. ej. en la sección "Antes" del ADR nuevo), nunca una decisión vigente.
```

**Prompt 2: Solicitud de Flujo Funcional para el inicio del desarrollo.**

```text
Actúa como un Lead Systems Analyst y Arquitecto de Producto.

=== CONTEXTO DEL PROYECTO Y FUENTES DE VERDAD ===
Por favor, analiza en detalle los siguientes 4 archivos de especificación del proyecto 'DevFlow CLI' presentes en el repositorio:
1. `docs/001-descripcion-general-del-producto.md`
2. `docs/002-arquitectura-del-sistema.md`
3. `docs/005-historias-de-usuario.md`
4. `docs/006-tickets-de-trabajo.md`
5. `README.md`
6. `docs/PRD.md`

=== TU MISIÓN EN ESTE TURNO ===
Genera un listado cronológico y detallado del **flujo funcional completo** de la aplicación, explicando exactamente cómo se comporta la herramienta paso a paso desde que el usuario realiza la instalación inicial hasta que completa la documentación de una historia de usuario seleccionada.

Estructura el comportamiento en las siguientes etapas cronológicas:
1. ⚙️ **Instalación y Configuración Inicial** (Alta de claves de Jira, repositorios y sufijo de usuario — US-01 / TK-01).
2. 📋 **Selección y Consulta del Ticket de Jira** (Búsqueda JQL, obtención de datos y manejo de Fallback Manual — US-02 / TK-02).
3. 🛠️ **Preparación Automática del Entorno** (Validaciones de Git status, creación de rama estandarizada y carpetas físicas — US-03 / TK-02).
4. 🤖 **Generación Asistida por IA y Documentación de Fase 1** (Transformación con Ollama local, JSON Schemas y renderizado Handlebars — US-03 / TK-02).
5. 📝 **Completado por el Desarrollador (Fase 2) y Registro de Métricas** (Edición manual en IDE, preservación de bloques y registro en SQLite — TK-01 / TK-02).

=== RESTRICCIONES Y ESTILO ===
- Asegúrate de citar las Historias de Usuario (`US-XX`) y Tickets (`TK-XX`) correspondientes en cada paso.
- Detalla los escenarios de **resiliencia y fallbacks** (falta de red, Ollama no disponible, cambios pendientes en Git, épicas).
- Idioma: Español técnico profesional.

```

Después de solicitar el flujo funcional se le solicita a Claude que lo documente en el archivo  [`docs/009-flujo-funcional.md`](docs/009-flujo-funcional.md).
