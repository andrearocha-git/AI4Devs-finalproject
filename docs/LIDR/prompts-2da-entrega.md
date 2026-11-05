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

Después de solicitar el flujo funcional se le solicita a Claude que lo documente en el archivo  [`docs/009-flujo-funcional.md`](../009-flujo-funcional.md).

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

---

## Bitácora en el desarrollo TK-02a y TK-02b

### Bitácora de Trabajo con Agente (TK-02a y TK-02b)

#### **Cierre de huecos, división de tickets y flujo de ramas con revisión en Cursor (Entrega 2)**

Esta etapa continuó con Claude Code como agente ejecutor y el mismo esquema de supervisión activa. Antes de programar se revisó el trabajo hecho sin validar, se dividió el ticket de la TUI y se cambió el modo de entregar: cada sub-ticket se desarrolla en su propia rama y su PR la revisa **Cursor**, no Claude, de modo que quien implementa y quien revisa son herramientas distintas.

##### **Gobierno del Agente y del flujo de entrega**

- Revisión de lo hecho sin validar: pedí revisar los 4 commits que el agente había hecho sin consultarme (decisiones H-02, H-03, H-04 y H-06). La revisión encontró tres inconsistencias reales: el flag `--reprocesar` no estaba en el resumen de confirmación, no figuraba en la llamada a `startTicket` de la TUI, y una frase de `docs/002` quedó rota. Se corrigieron en un commit aparte, sin tocar los anteriores.
- Regla de commits respetada: el agente propuso cada commit y esperó mi visto bueno; ningún «commitea» se extendió a otro grupo de cambios. No hizo `push` en ningún momento.
- Revisor externo con una skill propia: definí que la revisión de cada PR la hace Cursor con una skill `pr-review` (`.cursor/skills/pr-review/SKILL.md`). Claude evaluó la skill que yo traía: detectó que comparaba contra `origin/main` (el diff incluiría trabajo ajeno a la PR), que `allowed-tools` es de Claude Code y Cursor lo ignora, y que faltaban los criterios del repo. Se parametrizó la rama base (por defecto `feature/entrega-2-ANR`), con tres puntos en el diff, y se añadió una prohibición explícita de `commit`, `add`, `push` y similares porque Cursor no respeta la lista de herramientas permitidas.
- Flujo de ramas: `feature/entrega-2-ANR` → `feature/TK-02` (integración, sin commits directos) → una rama por sub-ticket (`feature/TK-02a`, `feature/TK-02b`…) con PR hacia `feature/TK-02`. Esto contradice una regla anterior mía («sin PRs, solo commits en la rama»); lo decidí como excepción para TK-02 porque la revisión de Cursor por sub-ticket lo exige. Pregunté quién tilda las casillas del DoD al aprobar: Cursor es de solo lectura, así que lo hace Claude a petición mía, tras la merge que hago yo.
- Entorno: aclaré que mi máquina de destino es Windows sin WSL, mientras el agente trabaja en WSL. Se confirmó que las rutas por defecto usan formato Windows (`path.win32`) y que los tests inyectan el entorno para pasar en ambos sitios; la prueba real en Windows sigue pendiente (Hito 3 del backlog).

##### **Decisiones de Arquitectura e Intervenciones (TK-02a y TK-02b)**

- División de TK-03 (aprobada por mí): TK-03a (CLI base y `devflow config`) y TK-03b (`devflow start`), con TK-03 como paraguas, igual que TK-02. Se actualizaron `docs/006`, `README.md`, `docs/009` y el backlog.
- Confirmación única de H-03: el agente señaló que `validateRepository` y `git status` son lecturas de Git, así que podía confirmarse un resumen y que Git lo bloqueara después. Elegí la opción recomendada: nuevo `GitManager.inspectRepository` (solo lectura) **antes** de la confirmación, y `createBranch` después, repitiendo el `status` por seguridad. El resumen de confirmación gana `branchAlreadyExists`. Quedó cubierto en `docs/002` (diagrama de secuencia), `docs/006` y `docs/009`.
- Verificación del diagrama Mermaid: el agente intentó renderizarlo con `mermaid-cli` vía `npx`, pero el sistema bloqueó la descarga externa. No se buscó otra vía de ejecución; se hizo una comprobación estructural (bloques balanceados, `else` solo dentro de `alt`) y se dejó dicho que no se había renderizado.
- Prefijo de rama (TK-02a): `AppConfig` ya tenía los prefijos y el ticket decía que el resolutor los leía de `templates/issue-types.json`. Pedí que me explicara el punto y elegí la opción B: una sola fuente de verdad. El resolutor devuelve `branchType` (`feature` o `bugfix`) y el Orquestador arma el prefijo con `AppConfig`. Se corrigió `docs/006` antes de programar.
- Escritura fuera de `src/` y `tests/`: la skill `/04-tdd-pair` solo permite escribir ahí, pero el contrato aprobado exigía tocar `templates/`, `eslint.config.js`, `vitest.config.ts` y `package.json`. El agente se detuvo y pidió autorización explícita en lugar de improvisar; la di, y quedó registrada en el contrato. Lo mismo con la instalación de `@vitest/coverage-v8`, que además subió `vitest` de 5.0.5 a 5.1.0; se documentó.
- Autorización para consultar Jira real: el agente avisó antes de leer `~/.config/devflow/jira.env` y verificó a mano, sin imprimir el token, que `GET /rest/api/2/search` responde 410 y `GET /rest/api/2/search/jql` responde 200. El cliente usa el segundo.
- Caso sin especificar (TK-02b): el agente detectó que una respuesta 2xx con cuerpo inválido haría lanzar una excepción cruda, lo cual rompe la regla de no exponer excepciones. No lo implementó por su cuenta; lo preguntó y decidí tratarlo como `ErrorInesperado`, con tests propios.
- Fricciones con herramientas: msw 3 renombró `onUnhandledRequest` a `onUnhandledFrame`; lo detectó el typecheck, no la ejecución. Los errores de markdownlint (MD049) de los contratos se trataron aparte, preguntándome antes de cambiar el estilo de énfasis.

##### **Hallazgos de la revisión de Cursor**

- Primera revisión de la PR de TK-02a (4 hallazgos reales, todos aplicados con TDD): rutas con solo espacios aceptadas en `ticketsRootPath`/`databasePath`; bloque de la TUI sin el patrón del storage manager; textos obligatorios guardados sin recortar. El segundo era un error del agente: había dicho que lo comprobó, pero solo lo probó con rutas que pasaban por `database/`. Lo reconoció y lo confirmó con `eslint --stdin` antes de corregirlo.
- Segunda revisión: `resolveDatabasePath` no recortaba `APPDATA`. Arreglado con su test y una nota en el CA2 del contrato (sin reescribir el criterio de origen).
- Revisión de la PR #2 (TK-02b), dos hallazgos medios, ambos reales y aplicados con TDD:
  - `fetchTicket` devolvía `Ok` con una forma que no era `ContextoTicket` (una descripción en formato de documento, `summary: null`, `issuetype` sin `name`). Era un incumplimiento mío de la decisión sobre cuerpos 2xx inválidos: la apliqué en tres métodos y dejé el cuarto con un cast. Habría llegado hasta `resolveIssueType` como excepción.
  - `listAssignedTickets` interpolaba las claves en la JQL: una clave como `FOO) OR (summary is not EMPTY` ampliaba la consulta a otros proyectos. El contrato asumía claves ya validadas; ahora el método rechaza las que no cumplen `^[A-Z][A-Z0-9_]+$`, sin llamar a Jira.
- Esa misma revisión dejó tres hallazgos bajos, también aplicados: una URL base inválida se informaba como `network_timeout` (ahora `ErrorInesperado`), un `Retry-After` negativo daba una espera negativa (ahora se acota a 0) y faltaban dos tests (`/myself` caído por error de red y el backoff por defecto de 2000 ms, que nacieron en verde).
- Cursor señaló además que la documentación quedó detrás del código (estado del backlog, `docs/009`, casillas del DoD y contratos). Era un olvido del agente al cerrar TK-02a y TK-02b: `CLAUDE.md` pide mantener `docs/009` al día. Se sincronizó en un commit aparte.
- Dos observaciones se registraron sin tocar código por ser decisiones de política o de TK-03: un tipo de issue vacío cae en `historia` y la plantilla se carga con `readFileSync` relativo al módulo, lo que fallaría al emitir a `dist/`.

##### **Resultados de Calidad Obtenidos (TK-02a y TK-02b)**

- Suite de pruebas: de 43 a 147 tests en verde (98 al cerrar TK-02a, 134 al cerrar TK-02b y 147 tras aplicar la revisión de la PR #2), con TDD en cada escenario: el test se escribió primero y se comprobó que fallaba por la razón esperada.
- Cobertura: umbral del 80 % configurado para `src/services/**` (`npm run test:coverage`), verificado forzando un umbral imposible para comprobar que falla. Resultado actual: 100 % en sentencias, ramas, funciones y líneas (antes de la revisión de la PR #2 eran 98,8 % y 96 % en sentencias y ramas).
- Análisis estático: la regla «solo el Orquestador importa `sqlite-storage-manager`» se comprobó con un archivo temporal que la violaba y rompió `npm run lint`; typecheck y lint sin errores.
- Veredictos de `/05-verificar-y-revisar`: TK-02a y TK-02b «Aprobada con observaciones». La revisión externa de Cursor encontró después problemas que el `/05` no había visto (el mapeo de `fetchTicket` y la JQL), lo que confirma el valor de un revisor distinto del implementador.
- Trazabilidad: commits atómicos por grupo, con contratos aprobados antes del código y PR #1 (TK-02a) fusionada en `feature/TK-02`.

#### Prompt utilizado para la bitácora (TK-02a y TK-02b)

```text
Generá una bitácora similar a ## Bitácora en el desarrollo TK-00 y TK-01 (la que está dentro de docs/LIDR/prompts-2da-entrega.md) pero de los tickets realizados en esta sesión, y colocala al final del archivo docs/LIDR/prompts-2da-entrega.md.
```

#### Respuesta de Claude (TK-02a y TK-02b)

```text
Bitácora de la sesión (TK-02a y TK-02b)

1. Antes de programar

- Leí el resumen de la sesión anterior y propuse empezar por los 4 commits sin validar (H-06, H-03, H-02 y el ajuste del backlog). La revisión encontró 3 inconsistencias y se corrigieron en un commit nuevo.
- Dividimos TK-03 en TK-03a (CLI base y config) y TK-03b (devflow start).
- Resolvimos la observación pendiente de H-03: la inspección de Git de solo lectura va antes de la confirmación (nuevo GitManager.inspectRepository).
- Preparamos la skill pr-review de Cursor: rama base parametrizada y prohibición explícita de commits.

2. Flujo de ramas

- feature/TK-02 como rama de integración y una rama por sub-ticket. Cursor revisa cada PR; Claude aplica los hallazgos que acordamos; la merge la hacés vos.
- Tildar el DoD tras la merge lo hago yo a pedido tuyo, dentro del primer commit del siguiente sub-ticket.

3. TK-02a: base compartida de la Service Layer

- Refinado: 3 escenarios, 4 criterios y 5 tareas. Resolviste el prefijo de rama (opción B) y aceptaste mis propuestas para campos obligatorios, ruta de la base y cobertura.
- Implementado con /04: E1 (StepResult y resolutor de tipo), E2 (AppConfigProvider), E3 (regla de lint) y cobertura del 80 %. Cada escenario se cerró con tu validación.
- Autorizaste escribir fuera de src/ y tests/ y la instalación de @vitest/coverage-v8.
- /05: Aprobada con observaciones. Cursor encontró 4 hallazgos reales en dos revisiones; todos se aplicaron con TDD.

4. TK-02b: cliente REST de Jira

- Refinado: 3 escenarios, 1 criterio técnico con 4 métodos y 5 tareas. Aceptaste mis propuestas sobre reintentos, 429 y errores inesperados.
- Implementado con /04: E1 (fetchTicket), E2 (clasificación de fallos, reintento y regla del 404) y E3 (validateProjectKey, listAssignedTickets, getMyDisplayName).
- Comprobé a mano contra tu Jira de pruebas el endpoint de búsqueda: /search da 410 y /search/jql da 200.
- Decidiste que un cuerpo 2xx inválido sea ErrorInesperado.
- /05: Aprobada con observaciones.
- Revisión de Cursor (PR #2): 2 hallazgos medios y 3 bajos, todos reales. Se aplicaron con TDD (tests en rojo primero), se registraron en el contrato y quedó 147 tests con 100 % de cobertura en src/services. Además se sincronizó la documentación que había quedado atrás.

5. Hallazgos

Detectados por vos:
- La skill pr-review comparaba contra la base equivocada, o sea, contra main en lugar de la rama de integración.
- Los pasos de una PR con rama de integración: pediste confirmar el flujo y aclaraste quién tilda el DoD.
- Aviso de que tu máquina es Windows sin WSL.

Míos:
- El bloque de la TUI sin el patrón del storage manager: dije que lo había comprobado y Cursor lo encontró.
- msw 3 renombró onUnhandledRequest a onUnhandledFrame.
- El cuerpo 2xx inválido no estaba especificado y lo pregunté en lugar de decidirlo.
- Aun así apliqué esa decisión solo en 3 de los 4 métodos: fetchTicket quedó con un cast y Cursor lo encontró.
- No sincronicé docs/009, el backlog ni los contratos al cerrar TK-02a y TK-02b; lo señaló la revisión de la PR #2.

6. Estado final

- Rama: feature/TK-02b, árbol limpio; el push lo hacés vos.
- Calidad: 147 tests, typecheck y lint en verde; cobertura de src/services 100 %.
- Commits: 47417c0, 7fd29ad, f23905b, 7164459, acbe2d1, 11fe767, d402b42, b7d2d90, ef6ce06, 789aac3, 73fb1e6, da35486 (bitácora), 0a08472 (revisión de la PR #2) y 9a858e9 (sincronización de documentación).

7. Pendiente

1. Tuyo: push de feature/TK-02b y nueva pasada de Cursor sobre la PR #2; luego la merge hacia feature/TK-02.
2. Tras la merge: tildar el DoD de TK-02b en docs/006 y marcar TK-02b en el backlog.
3. Siguiente: TK-02c (Git Manager), luego TK-02d/e, TK-02f y TK-02g.
4. Observaciones diferidas: tipo de issue vacío, carga de plantillas en dist/ (TK-03), validar jiraBaseUrl como URL en AppConfigProvider (TK-02g / TK-03a) y prueba contra Jira real de los otros tres métodos.
5. Prueba en Windows (Hito 3), pendiente porque el desarrollo corre en WSL.
```

---

## Bitácora en el desarrollo TK-02c

### Bitácora de Trabajo con Agente (TK-02c)

#### **Git Manager: del primer diseño al flujo manual congelado, con tres pasadas de revisión de Cursor**

TK-02c se implementó con TDD sobre repositorios Git reales y se revisó en la PR #3 (`feature/TK-02c` → `feature/TK-02`). La revisión no encontró problemas de lógica del producto sino bordes de Git, y terminó con una decisión mía de producto: el flujo de la herramienta tiene que ser el que yo uso a mano.

##### **Gobierno del Agente y del flujo de entrega (TK-02c)**

- Antes de programar pedí ampliar US-03 CA5 con una regla de rama: si la rama del ticket existe en local, la herramienta avisa y consulta en la confirmación única; si existe solo en `origin`, se detiene con `RamaExistenteEnRemoto`; nunca crea ni publica ramas en el remoto (el `push` es mío). Quedó como CA10 y como subtipo de error nuevo.
- Regla de commits respetada: el agente propuso cada grupo de cambios y esperó mi visto bueno; el `push` lo hice yo. Un «commitea» valió solo para ese grupo.
- Primera revisión de la PR #3 (un hallazgo alto): `git pull --ff-only` respetaba `pull.rebase` y `branch.<base>.rebase`, así que con historial divergente podía reescribir un commit local. Se corrigió con `--no-rebase`, y los tests pasaron a aislar la configuración de Git de quien los corre (`HOME`, `USERPROFILE`, `GIT_CONFIG_GLOBAL`). También se validaron los nombres de rama con `git check-ref-format` y se añadió un timeout de 120 s al runner.

##### **Decisiones de Arquitectura e Intervenciones (TK-02c)**

- Segunda pasada (3 hallazgos medios, todos reales): el `fetch` con refspec podía escribir un tag si la base se llamaba `refs/tags/v1`; un rebase parado en `edit` no se detectaba porque `git status --porcelain` sale vacío; el `stderr` de Git podía repetir el token de un `origin` con credenciales en la URL.
- **Mi intervención principal:** dije que no se usen tags y que quería que la herramienta se comporte como yo trabajo a mano: `git status`, ir a la rama base si no estoy en ella, `git pull`, `git checkout -b`, y con eso basta. Antes de aceptar la propuesta del agente le pregunté qué era un *refspec*; me lo explicó y comparamos su flujo con el mío. Se eliminó el `fetch`: ahora es `git switch <base>` si no está en ella y luego `git pull --no-rebase --ff-only`. Autoricé cambiar los 4 tests aprobados que afirmaban el `fetch`.
- Los nombres que empiezan por `refs/` se rechazan; un merge, rebase, cherry-pick o revert en curso corta con `CambiosPendientes`; los mensajes ocultan usuario y token de las URLs.
- Tercera pasada: sin el `fetch`, una base que solo existe en el servidor y nunca se trajo falla en `git switch`. Decidimos no reintroducir el `fetch` (es lo que me pasaría a mano) y dar un error que pide `git fetch origin`. También se validó la lectura de la rama actual, se distinguió el corte por `maxBuffer` del timeout, y el `PullFallido` dice en qué rama quedó el repositorio.
- Para que el flujo no se vuelva a tocar pedí tres capas: un test «Contrato del flujo» con la secuencia exacta de comandos (se comprobó que falla al meter un `fetch`), una regla en `CLAUDE.md` y un comentario en `createBranch`.
- Cursor aprobó la PR sin hallazgos medios ni altos. Los cuatro bajos restantes se dejaron anotados en el contrato como decisiones diferidas, para no mover una rama ya aprobada.

##### **Resultados de Calidad Obtenidos (TK-02c)**

- Suite de pruebas: de 147 a 214 tests en verde (197 al implementar TK-02c, 206 tras la segunda pasada y 214 tras la tercera y el test de contrato del flujo).
- Cobertura de `git-manager.ts`: 99 % de sentencias y 95 % de ramas (umbral 80 %).
- Comprobaciones hechas a mano: que `check-ref-format` acepta `refs/tags/v1` y que un `fetch` con destino `refs/tags/…` escribe un tag; que `git switch <base>` crea la rama local desde `origin/<base>` si esa referencia ya está en el repositorio.
- El agente reconoció un límite que ya había anticipado (la base no traída) antes de que Cursor lo señalara, y lo documentó en lugar de resolverlo con un comando que yo no uso.

#### **FileSystem Manager y plantillas: de mi plantilla al documento, con dos pasadas de revisión de Cursor**

TK-02d se implementó con TDD y se revisó en la PR #4 (`feature/TK-02d` → `feature/TK-02`). Es el primer ticket en que el producto escribe el documento que yo voy a completar, así que el criterio fue que se parezca al que ya uso.

##### **Gobierno del Agente y del flujo de entrega (TK-02d)**

- Las plantillas `bug.md.hbs` y `historia.md.hbs` se basan en mi `plantilla-user-story.md` (la tengo fuera del repositorio). La Fase 2 va tal cual está en ella y la IA no la toca; se comprobó con `diff` que es idéntica en las dos plantillas.
- Autoricé de forma expresa lo que el contrato no permitía hacer solo: instalar `handlebars` (`package.json`) y crear `templates/documents/` con la sección correspondiente de `templates/README.md`.
- Regla de commits respetada: el agente propuso cada grupo de cambios y esperó mi visto bueno; el `push` lo hice yo.

##### **Decisiones de Arquitectura e Intervenciones (TK-02d)**

- **Fase 2 del documento:** quedó como «Datos del desarrollo, Evidencias y Observaciones»; se quitó «Instrucciones de Pasaje a Producción». El cambio se propagó a `PRD`, `001`, `002` y `009`.
- **Cobertura:** `/05-verificar-y-revisar` detectó que la cifra de cobertura de `local-file-storage.ts` que el agente había escrito no estaba medida (`vitest.config.ts` solo mide `src/services/**`): eran 91,7 % de sentencias y 77,8 % de ramas. Se añadió un test (6 casos) y subió a 100 %. **Decidí no ampliar el umbral de cobertura a `src/database/`**: ya estaba por encima del 95 %, ningún ticket lo pide y tocar la configuración arriesgaba romper `npm run test:coverage`.
- **Primera pasada de la PR #4 (2 medios y 4 bajos, todos reales, corregidos con TDD):**
  - `adjuntosDirName` sin validar permitía salir de la raíz de tickets; los tests en rojo llegaron a crear carpetas en `/tmp` (se borraron) y ahora se rechaza antes de crear nada.
  - Un marcador `FASE1:FIN` dentro del texto cortaba el bloque al regenerar; se neutraliza en todos los textos que se renderizan.
  - `writeDocument` rechaza una ruta fuera de la raíz, el mensaje de error distingue leer de escribir, la plantilla `bug` separa mejor sus líneas y se limpiaron dos frases obsoletas de `docs/002` y `PRD`.
- **Segunda pasada:** Cursor aprobó la PR sin hallazgos medios ni altos. Los tres residuales bajos (marcador en documentos antiguos, nombres reservados de Windows y symlinks) se dejaron anotados en el contrato como decisiones diferidas, para no mover una rama aprobada.

##### **Resultados de Calidad Obtenidos (TK-02d)**

- Suite de pruebas: de 214 a 282 tests en verde (261 al cerrar E3, 267 tras la corrección de `/05` y 280 tras la primera pasada de la PR #4).
- Cobertura de `src/services/filesystem/` ≥ 97 % de sentencias y 93 % de ramas, y 100 % en `local-file-storage.ts`.
- `typecheck` y `lint` limpios.
- Lo que no se pudo comprobar: el comportamiento en Windows, que es mi máquina de destino. Queda para el Hito 3.

