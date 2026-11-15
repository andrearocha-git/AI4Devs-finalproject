# Bitácoras

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


#### **Orquestador de configuración: del contrato a cuatro pasadas de revisión de Cursor**

TK-02g reúne los métodos del Orquestador que la TUI usa para configurar la herramienta (claves de proyecto, repositorios, sufijo y tickets asignados). Se refinó con `/03-refinar-historia`, se implementó con TDD y se revisó en la PR #5 (`feature/TK-02g` → `feature/TK-02`). Es el primer ticket que cierra del lado del servicio la historia US-01.

##### **Gobierno del Agente y del flujo de entrega (TK-02g)**

- Aprobé el contrato en `Borrador` antes de que se escribiera código, tras pedir que me recordaran para qué sirve el sufijo de usuario de las ramas. El sufijo es la parte final de `<prefijo>/<ID>-<SUFIJO>`.
- Regla de commits respetada: el agente propuso cada grupo de cambios y esperó mi visto bueno; pedí que el código y la documentación fueran siempre commits separados, y el `push` lo hice yo.
- Cuando la PR #5 estuvo fusionada, el agente actualizó `feature/TK-02` y creó la rama siguiente desde ahí, para que el diff de cada PR fuera solo el del ticket.

##### **Decisiones de Arquitectura e Intervenciones (TK-02g)**

- **Mi intervención principal fue el sufijo.** Pregunté si podía ser parametrizable por el usuario o si, según el costo de retrabajo, convenía dejar `AR` fijo en primera instancia. El agente respondió que parametrizarlo no costaba más (la columna de `app_config` ya existía) y que dejarlo fijo obligaba a quitarlo después, y confirmé: parametrizable, que yo pueda poner `AROCHA` y otra persona `PGOMEZ`. Pasó a ser la inicial del nombre más el último apellido, editable, validado con `^[A-Z0-9]+$`.
- El cliente de Jira se crea en cada operación con la configuración guardada, para que un cambio con `saveConfig` surta efecto sin reinstanciar el Orquestador. Un borrado con historial lanza un `Error` con mensaje claro en lugar del texto crudo de SQLite.
- La validación de `jiraBaseUrl` (hallazgo diferido de Cursor desde la PR #2) quedó fuera de este ticket, como proponía el contrato que aprobé, y se resolvió en TK-03a.
- **Revisión de Cursor, cuatro pasadas.** Primera: dos hallazgos medios reales: `removeProject` no normalizaba la clave (borraba nada y no avisaba) y una re-alta de un repositorio pisaba la rama base guardada con `main`. Segunda: el nombre, la ruta y la rama no se recortaban, y un TSDoc incompleto. Tercera: un nombre en blanco se guardaba vacío. Cuarta: un artículo mal puesto en un mensaje («El ruta»). Todos se corrigieron con test en rojo primero.
- Quedó anotado, sin cambiar, que `updateRepository` sobre un repositorio inexistente y la validación de Git comparten el subtipo `RepositorioNoEncontrado`; separarlos exige un subtipo nuevo en TK-02a.

##### **Resultados de Calidad Obtenidos (TK-02g)**

- Suite de pruebas: de 282 a 347 tests en verde (45 al implementar, 56 tras la primera pasada y 65 al cierre).
- `typecheck` y `lint` limpios; las reglas de capas siguen pasando.
- Lo que no se hizo en este ticket y quedó anotado: el subtipo de error separado y el endurecimiento del cliente de Jira.

#### **CLI base y `devflow config`: el primer punto de entrada ejecutable**

TK-03a cierra el Hito 1: `cli.ts` con Commander y los comandos `devflow config` y `devflow config proyectos`, que usan solo al Orquestador. Se revisó en la PR #6 (`feature/TK-03a` → `feature/TK-02`).

##### **Gobierno del Agente y del flujo de entrega (TK-03a)**

- Aprobé el contrato con cuatro decisiones que el agente me pidió confirmar: los comandos serán interactivos y sin flags, se ejecutan con `tsx` (sin `build`), `suggestBranchSuffix` acepta credenciales aún sin guardar, y la validación de `jiraBaseUrl` se hace en el Orquestador.
- Autoricé de forma expresa lo que el contrato no permitía hacer solo: instalar `commander`, `@inquirer/prompts` y `tsx` (`package.json`) y, más tarde, tocar `CLAUDE.md` para documentar `npm start`.
- Cuando el agente detectó que el Orquestador no podía listar los repositorios de una clave (el menú los necesita), se detuvo, lo explicó y esperó mi autorización antes de añadir `listRepositories`.
- **Decidí que la prueba completa se haga directamente en Windows, no por WSL**, junto con el resto del Hito 3. Antes autoricé una prueba de solo lectura desde WSL contra mi Jira de pruebas.

##### **Decisiones de Arquitectura e Intervenciones (TK-03a)**

- `cli.ts` no puede importar la base, Jira ni Git por la regla de capas, así que el arranque llama a `createOrchestrator`, una raíz de composición nueva en `src/services/orchestrator/`.
- El primer arranque tenía un círculo: guardar la configuración exige el sufijo y sugerirlo exige las credenciales guardadas. Se resolvió dejando que `suggestBranchSuffix` use credenciales sin guardar.
- El token se pide enmascarado y nunca aparece en la salida; un token inválido nunca se presenta como «la clave no existe».
- La prueba de solo lectura contra mi Jira real validó el alta de `SCRUM`, `MPDD`, `SUP` y `TC`, los 3 tickets asignados, el token inválido, una URL `ftp://` y un sitio inexistente, y un `origin` real para el alta de un repositorio.
- Esa prueba destapó que `resolveDatabasePath` (de TK-02a) usa `win32.join`: en Linux/WSL crea un archivo con barras invertidas en el directorio actual. En Windows es correcto; queda anotado.
- **Revisión de Cursor:** sin hallazgos medios ni altos. Dos bajos: los tests de composición dejaban la base abierta (en Windows no se puede borrar un archivo abierto), que se resolvió con un `close()` idempotente en el Orquestador, y una coma que faltaba en `docs/009`.

##### **Resultados de Calidad Obtenidos (TK-03a)**

- Suite de pruebas: de 347 a 431 tests en verde (82 al cerrar el ticket, 84 tras la revisión de Cursor).
- `typecheck` y `lint` limpios; la TUI solo importa del Orquestador.
- Lo que no se pudo comprobar: la prueba interactiva con teclado real, la ruta real de la base y Git con rutas `C:\...`. Queda para Windows.

#### **Ollama AI Transformer: prompts, schemas y la prueba con el modelo real**

TK-02e convierte el texto de un ticket en la Fase 1 del documento llamando a Ollama local (`qwen2.5:3b`), con validación y corrección en código. Es el ticket con más riesgo técnico de la segunda entrega. Está en revisión en la PR de `feature/TK-02e`.

##### **Gobierno del Agente y del flujo de entrega (TK-02e)**

- Pregunté qué era Ajv antes de aprobar su instalación; el agente lo explicó (valida un JSON contra un JSON Schema, la misma fuente que se manda a Ollama) y con eso autoricé la dependencia y la escritura en `templates/`.
- Aprobé el contrato con tres decisiones de fondo: las reglas del posprocesado viven en `issue-types.json` (como dice `docs/002`), «descartar» un literal inventado significa descartar el elemento que lo contiene, y `presenteEnTicket` es opcional en `DocumentoFase1` para no romper los tests ya aprobados de TK-02d.
- Pedí dos commits separados (código y documentación) y esperé a que Cursor revisara antes de seguir.

##### **Decisiones de Arquitectura e Intervenciones (TK-02e)**

- Los prompts del spike de octubre no estaban en el repositorio; se redactaron de nuevo y se afinaron con el modelo real.
- **La prueba con Ollama real cambió un prompt.** Con la primera versión, en un bug cuyo ticket sí describía el recorrido y el síntoma, el modelo marcó todo como ausente: el documento quedaba sin valor. Tras dos iteraciones del prompt (qué cuenta como presente en cada campo), `pasosParaReproducir` y `comportamientoActual` salieron bien con las palabras del ticket. Un modelo de 3B es conservador: prefiere marcar «ausente» a arriesgar, que es el sesgo correcto para no inventar.
- Una limitación aceptada y declarada: la historia de usuario (`como/quiero/para`) solo se rellena si el ticket la trae completa; si no, se marca entera como ausente.
- Un problema de infraestructura de las pruebas: un test del timeout a mitad de streaming hacía fallar el proceso de Vitest (código 1) aunque todos los tests pasaran, por una aserción interna de `undici` al combinarse con msw. Se comprobó que no era del código del transformer y ese único caso usa el `fetch` inyectable.
- **Revisión de Cursor:** un hallazgo bajo, real: la última línea del streaming se descartaba si no terminaba en salto de línea (mis tests siempre lo incluían y no lo veían), con lo que una respuesta correcta caía a fallback. Se corrigió con test en rojo primero.
- `FallbackDeterminista` no informa la causa del fallo; registrarla en `ticket_logs.ollama_error` exigiría ampliar el contrato de TK-02a, y quedó fuera.

##### **Resultados de Calidad Obtenidos (TK-02e)**

- Suite de pruebas: de 431 a 508 tests en verde (77 de este ticket, 74 al implementar y 3 tras la revisión de Cursor).
- Cobertura de `src/services/ollama/`: 98 % de sentencias y 92,5 % de ramas (umbral 80 %).
- Con `qwen2.5:3b` real en WSL (solo CPU): 14 a 56 s por ticket, contra los 30 a 105 s del spike. Un timeout corto corta la generación a mitad, y un puerto sin Ollama o un modelo no instalado caen a fallback al instante.
- Lo que no se hizo: medir en un PC real del equipo (8 GB con IDEs abiertos), que sigue siendo el riesgo principal del producto.


#### **Orquestador de punta a punta: `startTicket` y la reutilización de la Fase 1 (TK-02f y TK-02h)**

TK-02f es el flujo completo de `devflow start` del lado del servicio (Jira → Git → carpeta → Ollama → documento → `ticket_logs`). Era demasiado grande para un solo ticket y **el 2026-11-06 lo dividí en TK-02f (el flujo) y TK-02h (reutilización y reproceso de la Fase 1)**, para que cada PR fuera revisable. Los dos se revisaron con Cursor y se fusionaron en `feature/entrega-2-ANR`.

##### **Gobierno del Agente y del flujo de entrega (TK-02f y TK-02h)**

- Autoricé de forma expresa los dos cambios mínimos a tests ya aprobados: una línea (`fetchTicket: vi.fn()`) en el doble de Jira de TK-02g, y una línea (`readFase1: async () => ok(null)`) en cada uno de los tres dobles del gestor de archivos de TK-02f. Cada uno quedó anotado en «Decisiones y desvíos».
- Aprobé los contratos con 12 puntos ambiguos o asumidos en TK-02f y 9 en TK-02h, por ejemplo: `TicketOrchestrator` recibe un cuarto parámetro opcional de dependencias (no cambia el constructor que ya usan los tests), y el orden de escritura en TK-02h es documento primero y `fase1.json` después, para que un fallo al escribir no destruya la Fase 1 anterior.
- La prueba real se hizo con mi Jira de pruebas solo en lectura, Ollama real y **repositorios temporales con su propio `origin` local**, nunca los míos; el token no se imprimió.

##### **Decisiones de Arquitectura e Intervenciones (TK-02f y TK-02h)**

- Dos casos de «repositorio inexistente»: un `repositoryId` que no existe corta antes de llamar a Jira y no registra fila; que la **ruta** deje de ser un repositorio Git es un corte de Git y registra `branch_status = 'error'`.
- `TicketRunSummary.jiraFetchStatus` admite `null` (se cortó antes de consultar a Jira) para no afirmar un `ok` que no ocurrió.
- Sin fase roja real en E2 de TK-02f: el flujo completo ya estaba al escribir E1. Se dijo y se comprobó con tres mutaciones temporales del código (todas revertidas). Lo mismo en E3 de TK-02h: dos mutaciones.
- **Cursor, TK-02f** (1 medio y 3 bajos, todos reales, corregidos con test en rojo primero): un `--base ""` (vacío es falsy) se saltaba **todo Git** y la fila quedaba con `branch_status = null`; ahora cuenta como ausente. Además, `onStep` no cerraba tres pasos, un `CambiosPendientes` tardío no se registraba como `pending_changes` y `docs/006` no reflejaba el `null`.
- **Cursor, TK-02h** (1 bajo): el TSDoc público seguía describiendo el comportamiento de TK-02f. Solo cambiaron comentarios.
- La prueba real de TK-02f dejó una observación: con Ollama marcando todo como ausente, «Criterios de aceptación» quedaba **vacío**. Se anotó sin tocar `templates/` y dio lugar a TK-02i.

##### **Resultados de Calidad Obtenidos (TK-02f y TK-02h)**

- Suite de pruebas: de 508 a 551 tests en verde al implementar TK-02f (558 tras la revisión de Cursor) y a 580 con TK-02h (22 de este ticket: 18 unitarios y 4 de integración).
- Cobertura de `start-ticket.ts`: 100 % de sentencias y 97 % de ramas (umbral 80 %).
- Prueba de integración `tests/integration/ticket-flow.e2e.test.ts` (7 casos en TK-02f, 11 con TK-02h) con Git, carpetas y SQLite reales, y Jira y Ollama simulados con msw.
- Con `qwen2.5:3b` real en WSL (solo CPU): `SCRUM-2` tardó 49 s la primera vez; con el segundo repositorio, **1,3 s con `ollama = reused`**, sin llamar al modelo. Un reproceso con Ollama caído conserva el documento y `fase1.json` intactos.
- Lo que no se comprobó: Git con rutas `C:\...` en Windows. Queda para el Hito 3.

#### **`devflow start`: la TUI en tres tickets (TK-03b1, TK-03b2 y TK-03b3)**

TK-03b era el comando `devflow start` completo. **El 2026-11-12 lo dividí en TK-03b1 (validación y selección de ticket y repositorio, PR #13), TK-03b2 (carga manual y confirmación, PR #14) y TK-03b3 (progreso y pantallas de resultado, PR #15)**: cuatro prompts, un spinner y todas las pantallas eran demasiado para una sola revisión. Los tres se revisaron con Cursor en su PR hacia `feature/entrega-2-ANR`.

##### **Gobierno del Agente y del flujo de entrega (TK-03b1, TK-03b2 y TK-03b3)**

- Cada ticket siguió el flujo completo: contrato aprobado por mí antes del código, commit, TDD escenario por escenario con mi validación, `/05-verificar-y-revisar`, documentación de seguimiento y PR que armé y fusioné yo.
- **Autoricé de forma expresa un test aprobado modificado por ticket**, todos en `tests/unit/tui/cli.test.ts`: el de TK-03a (TK-03b1), el de TK-03b1 (TK-03b2) y el de TK-03b2 (TK-03b3). Cada vez era un test que dejaba de ser cierto porque un gancho provisional se reemplazaba; cada uno consta en «Decisiones y desvíos».
- Los ganchos de `onStep` y `ask` fueron **provisionales** entre TK-03b1 y TK-03b3, así que `npm start -- start` real no funcionó hasta fusionar los tres.

##### **Decisiones de Arquitectura e Intervenciones (TK-03b1, TK-03b2 y TK-03b3)**

- **Spinner sin dependencias** (opción B que elegí): unas 30 líneas con `setInterval` y secuencias ANSI, una línea por evento sin TTY o con `TERM=dumb`, y marcos ASCII (`| / - \`) para cualquier consola de Windows. No se tocó `package.json`.
- **Carga manual con «¿Es un bug?»:** el prompt devuelve `isBug` y `createAskCallback` lo traduce a `issueType: "Bug"`, así el adaptador de inquirer no contiene reglas. El tipo se **recorta**, no se normaliza.
- **Los bloqueos se muestran lanzando un error con la pantalla** (encabezado por tipo más el mensaje del Orquestador): sale por stderr con código 1 y los tests aprobados de TK-03b1 no cambian. `fallback-view.ts` se descartó: los avisos viven en `summary-view.ts`.
- `HandlerDeps` ganó campos opcionales (`getStartOrchestrator`, `startPrompts`, `askPrompts`, `progress`) para no tocar los tests de `createHandlers` ya aprobados.
- **Cursor, TK-03b1** (1 medio): `startTicket` terminaba **en silencio y con código 0** ante una épica, un error de Jira o un corte de Git, aunque el Orquestador ya había escrito la fila en `ticket_logs`. Se corrigió. También, tras la revisión de Cursor de la PR #12 (la división de TK-03b), se alineó en `docs/006` la regex del ID de TK-03b1 con el criterio del Orquestador (`^[A-Za-z][A-Za-z0-9_]*-\d+$`): el texto del ticket solo aceptaba mayúsculas, y el código ya admitía minúsculas y claves de una sola letra.
- **Cursor, TK-03b2** (1 bajo): una carga manual sin marcar como bug mostraba `Ticket: SCRUM-5 ()`; se corrigió con RED real.
- **Cursor, TK-03b3** (1 bajo): la etiqueta «Creando la carpeta y el documento» afirmaba algo que aún no ocurría (el evento llega al crear la carpeta, antes de esperar a Ollama); ahora dice «Creando la carpeta de evidencias». El evento propio del documento quedó como mejora (issue #36).
- Los casos que salieron en verde a la primera se comprobaron con mutaciones temporales, siempre revertidas; no se simuló una fase roja.

##### **Resultados de Calidad Obtenidos (TK-03b1, TK-03b2 y TK-03b3)**

- Suite de pruebas en verde en cada PR. Tests que aportó cada ticket, como la diferencia entre los totales de los commits de fusión de cada PR (se corrió Vitest sobre cada commit): TK-03b1 aportó 53 (633 en total al fusionar la PR #13), TK-03b2 aportó 24 (657, PR #14) y TK-03b3 aportó 41 (698, PR #15). La PR #12, la división de TK-03b, fue solo de documentación: la suite seguía en 580. La cifra de cierre del Hito 2 es 707 (ver TK-02i).
- `typecheck` y `lint` limpios; la TUI solo importa del Orquestador.
- Lo que no se pudo comprobar: el spinner, las marcas `✔ ⚠ ✖` y los prompts de `devflow start` en una terminal real. Solo se probaron con tests y un Orquestador simulado. Queda para la prueba en Windows (issue #20).

#### **Plantillas: «No especificado en el ticket.» en los criterios vacíos (TK-02i)**

TK-02i nació de la observación de la prueba real de TK-02f: una sección «Criterios de aceptación» vacía sin explicación. Se revisó en la PR #16.

##### **Gobierno del Agente y del flujo de entrega (TK-02i)**

- Autoricé de forma expresa tocar `templates/documents/historia.md.hbs` y `templates/documents/bug.md.hbs`, que el contrato no permite tocar solo.

##### **Decisiones de Arquitectura e Intervenciones (TK-02i)**

- **Solo los criterios de aceptación.** Casos de uso, preguntas abiertas y «Cómo reproducir» siguen sin aviso, porque `docs/006` limita el ticket; extenderlo sería otro ticket (issue #37, que necesita autorización para `templates/`).
- El literal vive en las plantillas (no pueden importar la constante) y un test las compara con `NO_ESPECIFICADO` de `src/services/ollama/postprocess.ts` para detectar que se desalinean.
- E3 es una prueba de regresión sin fase roja; se comprobó con tres mutaciones temporales de las plantillas, todas revertidas.

##### **Resultados de Calidad Obtenidos (TK-02i)**

- Suite de pruebas: **707 tests en verde** al cierre del Hito 2 (de 580 tras TK-02h), con `typecheck` y `lint` limpios. TK-02i aportó 9 tests (707 en total al fusionar la PR #16, frente a 698 tras TK-03b3), medidos como la diferencia entre los totales de los commits de fusión.
- Con TK-02i el Hito 2 queda cerrado en código. Falta la prueba en Windows (Hito 3).
