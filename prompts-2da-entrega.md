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

---

## Bitácora en el desarrollo TK-00 y TK-01

### Bitácora de Trabajo con Agente

#### **Gobierno, Arquitectura y Flujo Guiado (Entrega 2)**

El desarrollo de esta etapa se abordó utilizando a Claude Code como agente ejecutor en terminal, bajo un esquema estricto de supervisión activa y revisión humana en el bucle (Human-in-the-Loop). El objetivo no fue delegar ciegamente la programación, sino auditar sus propuestas, restringir sus contextos y adaptar las herramientas para asegurar calidad técnica y alineación con los principios aprendidos.

##### **Gobierno del Agente y Adaptación de Workflows (.claude/skills)**

En lugar de permitir generaciones descontroladas, se estructuró el trabajo mediante sub-agentes y skills especializadas, introduciendo mejoras clave detectadas durante la iteración:

- Flujo por contratos livianos (docs/changes/<ID>.md): Adopción de una convención inspirada en especificaciones estructuradas. La skill /03-refinar-historia define el contrato funcional, /04-tdd-pair implementa exclusivamente contra ese alcance y /05-verificar-y-revisar audita el cumplimiento.
- Chequeo INVEST: Se detectó la falta de validación de granularidad en las historias de usuario y se forzó a la skill de refinamiento a evaluar el principio INVEST antes de descomponer tareas.
- Cobertura estricta por escenario: Se restringió el contrato para exigir que cada escenario declare explícitamente su archivo de test (tests/...) o justifique técnicamente su omisión (Sin test: <motivo>), impidiendo huecos de cobertura.
- Estandarización de documentación viva (TSDoc): Se detectó que el agente omitía documentación formal en el código generado. Se fijó la convención en CLAUDE.md, obligando al agente a documentar contratos públicos en fase de refactor y a verificarlo en la revisión final.

##### **Decisiones de Arquitectura e Intervenciones**

Durante la ejecución de los tickets TK-00 (Scaffold inicial) y TK-01 (SQLite Storage Manager), la supervisión técnica impidió desvíos funcionales y malas prácticas:

- Control de alcance en Scaffold (TK-00): Se delimitó la configuración base (TypeScript, Vitest, ESLint) fuera del flujo habitual de TDD para no contaminar la raíz, validando manualmente las exclusiones correctas en .gitignore y linters.
- Resolución de ambigüedades arquitectónicas (TK-01): Se fijó por diseño que el constructor reciba la ruta de la base de datos (inyección de dependencias) y se utilizó PRAGMA user_version para evitar complejidad innecesaria en el versionado de migraciones.
- Detección de código muerto o sin cobertura: Durante la Tarea 4 de TK-01, el agente pretendía dar por finalizados métodos de persistencia sin pruebas asociadas. Se auditó el contrato y se exigió la creación de escenarios y tests específicos para cada método.
- Integridad referencial y pruebas de límites: Se realizó una prueba manual aislada (scratchpad) donde se detectó el comportamiento ante borrados de proyectos con historial vinculado (ticket_logs). Se decidió explícitamente respetar la restricción de integridad referencial sin borrado en cascada, protegiendo el diseño mediante un test automatizado negativo.

##### **Resultados de Calidad Obtenidos**

- Suite de pruebas: 43 tests unitarios y de integración en verde bajo metodología TDD.
- Análisis estático: Reglas de linting de capas estrictas (aislando la base de datos del resto del sistema) y typechecking sin errores.
- Trazabilidad: Historial de Git estructurado con commits atómicos, reflejando contratos, código probado y refactorizaciones documentadas.

#### Prompt utilizado para la bitácora

```text
Generame una bitácora detallada de la sesión que refleje mi rol de supervisión y el trabajo realizado. Incluí: lo que estuvimos viendo, los hallazgos que detecté (como la falta de TSDoc), las mejoras que incorporamos en las skills y cómo fui procediendo y decidiendo en cada ticket.
```

#### Respuesta de Claude

```text
Bitácora de la sesión

1. Documentación y herramientas

- Flujo funcional: creé docs/009-flujo-funcional.md, un documento vivo con las 5 etapas y los huecos H-01 a H-06 referenciados a US/TK. Quedaron resueltos H-01 (cierre de la Fase 2 fuera del MVP) y H-05 en parte (token en claro en el MVP).
- Hook de markdownlint: lo extendí de Write a Write|Edit, y solo avisa de las líneas que cambiaste sin commitear.
- Entrega 2: se creó prompts-2da-entrega.md, y se corrigieron sus errores de lint.

2. Mejoras a las skills (detectadas por vos)

┌─────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│               Mejora                │                                                      Qué cambió                                                       │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Contrato único docs/changes/<ID>.md │ Adoptamos un flujo liviano tipo OpenSpec. La 03 escribe el contrato, la 04 lo implementa con TDD y la 05 lo verifica. │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ INVEST (lo notaste vos)             │ La 03 ahora tiene un paso corto de chequeo INVEST, solo como alerta.                                                  │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Un test por escenario               │ La columna Test solo admite una ruta de test o Sin test: <motivo>. Un faltante sin declarar es una falla.             │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TSDoc (lo notaste vos)              │ Convención en CLAUDE.md, la 04 lo aplica al refactorizar y la 05 lo revisa como observación.                          │
└─────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

3. TK-00: scaffold

- Por qué: faltaba el armazón (package.json, TypeScript, Vitest, ESLint), así que lo agregamos como ticket propio antes de TK-01.
- Cómo procedí: lo refiné con /03 y lo implementé escenario por escenario, validando cada uno con vos. Lo hice fuera de /04-tdd-pair (opción A), porque esa skill no puede crear configuración en la raíz.
- Decisiones tuyas: un test automatizado para la regla de lint de CA5, y otro para el .gitignore de CA6.
- Resultado: /05 dio veredicto positivo y se commiteó en 4 grupos.

4. TK-01: SQLite Storage Manager

- Refinado: 3 escenarios, 8 criterios cubiertos y 5 tareas. Resolviste 3 ambigüedades:
  - Se ejecuta la migración y un test comprueba que schema.sql coincide.
  - No hay umbral de cobertura en este ticket.
  - La ruta de la base la recibe el constructor.
- Implementado con /04 en TDD: E1 (esquema), E2 (proyectos y repositorios) y E3 (historial de tickets), cada uno cerrado con tu validación.
- Tarea 4: preguntaste si los métodos quedaban sin test. Tenías razón, eran 5 sin cobertura de ningún escenario. Elegiste implementarlos con tests propios.
- /05: veredicto "Aprobada con observaciones". Todo pasa y los hallazgos son menores.

5. Hallazgos

Detectados por vos:
- Falta de INVEST en la skill 03.
- Falta de TSDoc en el código.
- Métodos sin test por no tener escenario.
- Pedido de una prueba manual antes de commitear.

Míos, durante el trabajo:
- db público en el manager, porque la regla de lint impide a los tests importar node:sqlite.
- Migraciones con PRAGMA user_version, para no sumar una quinta tabla.
- upsertAppConfig sin ON CONFLICT: SQLite valida NOT NULL antes de resolver el conflicto.
- Borrado con historial: lo encontró la prueba manual. No se puede borrar un proyecto o repositorio con ticket_logs, porque no hay ON DELETE CASCADE. Elegiste dejarlo así y documentarlo, y lo fija un test que verifiqué rompiéndolo a propósito.

6. Estado final

- Rama: feature/entrega-2-ANR, árbol limpio, sin push.
- Calidad: 43 tests, typecheck y lint en verde.
- Commits de hoy: 64e1531 (código de TK-01), 79333da (contrato), 8ecd59c (convención TSDoc y skills), 4e3b40c (CLAUDE.md y README), 5fe31ba (borrado con historial).

7. Pendiente

1. Tuyo: push, PR a main y, tras el merge, tildar el DoD de TK-00 y TK-01 en docs/006.
2. Prueba manual: el script está en /tmp/claude-1000/-home-andredev-ai4devs-AI4Devs-finalproject/335e8bca-2479-47f9-a453-d776ec0fc258/scratchpad/prueba-manual-storage.ts, y lo corrés con node. Ese archivo es temporal y no está en el repo.
3. TK-02: es muy grande (Jira, Ollama, Git, FileSystem y Orquestador), probablemente haya que dividirlo. Empezar con /03-refinar-historia TK-02.
4. Umbral de cobertura: decidirlo en TK-02, con propuesta de 80 %.
5. Lint del Orquestador: regla para que solo el Orquestador importe sqlite-storage-manager.ts.
6. Mensajes de error: TK-02 o TK-03 deben traducir el error de borrado con historial.
7. Huecos de docs/009: H-02, H-03, H-04, H-06 y la parte pendiente de H-05.
8. Lint viejo: hay errores de markdownlint anteriores en README y otros docs que no toqué.
9. Skills y hook: pueden necesitar reiniciar la sesión para recargarse.
```
