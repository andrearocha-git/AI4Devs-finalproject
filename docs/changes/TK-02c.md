# Change: TK-02c — Git Manager

- **Estado:** Implementado
- **Fuente:** `docs/006-tickets-de-trabajo.md` (TK-02c)
- **Depende de:** TK-02a
- **INVEST:** Cumple (I, S y T evaluadas). Nota sobre S: un solo criterio técnico que agrupa 3 métodos y ~6 ramas de decisión; se reparte en 3 escenarios y 5 tareas. Si crece al implementar, separar `validateRepository` (alta de repositorios) del resto.

## Propósito

Gestor de Git (ADR-007.1) que inspecciona un repositorio en modo solo lectura y detecta si la rama del ticket ya existe (en local, o en `origin` sin existir en local). Si existe en local la reutiliza sin tocar nada; si solo está en `origin` se detiene con un aviso para que el usuario la configure a mano; si no existe, actualiza la base y la crea. Devuelve siempre un `StepResult`.
Nunca ejecuta `commit`, `add` ni `push`, y nunca ramifica desde una base desactualizada.

## Criterios de aceptación de origen

- CA1 (original, CA3 del ticket): `GitManager` sobre repositorios Git temporales.
  - `inspectRepository` no ejecuta `fetch`, `pull`, `switch` ni escribe nada (verificable con spy sobre el runner) y devuelve `branchAlreadyExists`.
  - Repo inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`.
  - Cambios pendientes → `ErrorBloqueante('CambiosPendientes')` sin ejecutar pull ni creación.
  - Rama ya existente → `Ok({ alreadyExisted: true })` sin pull, creación ni cambio de rama (H-04). _(ampliado el 2026-11-03: si la rama solo existe en `origin`, se detiene con `ErrorBloqueante('RamaExistenteEnRemoto')`, ver «Decisiones y desvíos»)_
  - Parado en la base → `git pull --ff-only origin <base>`; parado en otra rama → `git fetch origin <base>:<base>`.
  - Pull fallido → `ErrorBloqueante('PullFallido')` sin crear la rama.
  - Caso feliz → crea la rama una sola vez con `git switch -c <rama> <base>`.
  - En ningún path se ejecuta `commit`, `add` ni `push` (spy sobre el runner).
- DoD-a: `GitManager` no ejecuta `commit`, `add` ni `push` en ningún path.
- DoD-b: al menos un test para `Ok` y para cada subtipo de `ErrorBloqueante` que produce.
- Contrato `validateRepository` (sin criterio numerado; se toma de su descripción): verifica repositorio Git, remoto `origin` y que la rama base exista en el remoto. _(asumido: se cubre en E1 con el mismo criterio de errores)_
- Contrato `createBranch`: repite la verificación y el `git status` por seguridad. _(cubierto en E3)_
- Regla de producto pedida por el desarrollador (2026-11-03, amplía CA5 de US-03): ver «Decisiones y desvíos». _(cubierta en E1 y E3)_

## Escenarios BDD

### E1 — Inspección de solo lectura y validación de alta (cubre: CA1 `inspectRepository`, contrato `validateRepository`, DoD-b)

- **Given** repositorios Git temporales con un `origin` local (bare): uno limpio, uno con cambios pendientes (modificado, en staging y sin trackear), uno con la rama del ticket solo en local, uno con la rama solo en `origin`, una ruta que no es un repositorio y uno sin `origin` o sin la rama base en el remoto; y un runner de comandos con spy
- **When** se llama a `inspectRepository` con cada uno, y a `validateRepository` con la rama base
- **Then** `inspectRepository` devuelve `Ok({ branchAlreadyExists })` (`true` solo si la rama existe en local, aunque también esté en `origin`; `false` si no existe en ninguna), `ErrorBloqueante('RamaExistenteEnRemoto')` con la rama y un aviso en `message` si existe solo en `origin`, `ErrorBloqueante('RepositorioNoEncontrado')` para la ruta inexistente o que no es un repo, y `ErrorBloqueante('CambiosPendientes')` con la lista de archivos en `message`; en ningún caso el spy registra `fetch`, `pull`, `switch`, `checkout`, `commit`, `add` ni `push`; `validateRepository` devuelve `Ok` solo si hay repositorio, `origin` y rama base en el remoto, y `ErrorBloqueante('RepositorioNoEncontrado')` con un mensaje que dice qué falta en los demás casos

### E2 — `createBranch` con rama nueva: actualización de la base y creación (cubre: CA1 pull/fetch y caso feliz, DoD-a)

- **Given** un repositorio temporal limpio con `origin` local cuya rama base tiene un commit nuevo que el clon aún no tiene, primero con el clon parado en la base y luego parado en otra rama
- **When** se llama a `createBranch` con `branchName` y `baseBranch`
- **Then** parado en la base ejecuta `git pull --no-rebase --ff-only origin <base>` y parado en otra rama ejecuta `git fetch origin <base>:<base>`; después ejecuta `git switch -c <rama> <base>` exactamente una vez y devuelve `Ok({ branchName, baseBranch, alreadyExisted: false })`; la rama nueva contiene el commit nuevo de la base; el spy no registra `commit`, `add` ni `push` y la base configurada del repositorio no cambia (se usa el `baseBranch` recibido, sea el de `--base` o el configurado)

### E3 — `createBranch`: reutilizar rama existente y cortes antes de crear (cubre: CA1 pendientes, rama existente y pull fallido, DoD-b)

- **Given** repositorios temporales con cambios pendientes, con la rama del ticket solo en local, con la rama solo en `origin`, con la ruta inexistente y con un `origin` inalcanzable (ruta eliminada o historial divergente en la base)
- **When** se llama a `createBranch` con cada uno
- **Then** cambios pendientes → `ErrorBloqueante('CambiosPendientes')` con la lista de archivos, sin pull ni creación; ruta inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`; rama en local → `Ok({ alreadyExisted: true })` sin ningún comando de escritura y sin cambio de la rama actual; rama solo en `origin` → `ErrorBloqueante('RamaExistenteEnRemoto')` sin `pull`, `fetch`, `switch` ni creación (el árbol pudo cambiar tras la confirmación); `origin` inalcanzable o base divergente → `ErrorBloqueante('PullFallido')` con el motivo de Git en `message` y sin crear la rama; y en ninguno de los casos se ejecuta `commit`, `add` ni `push`

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1 (`inspectRepository`), `validateRepository`, DoD-b | `tests/unit/services/git/git-manager.test.ts` › «E1 — inspectRepository: solo lectura» (19 casos) y «E1 — validateRepository: alta de un repositorio» (9 casos) | Hecho |
| E2 | CA1 (pull/fetch, caso feliz), DoD-a | `tests/unit/services/git/git-manager.test.ts` › «E2 — createBranch con rama nueva» (8 casos: pull parado en la base, fetch parado en otra rama, base distinta con `--base` sin copia local, 4 nombres de rama o base no válidos y HEAD desacoplado) | Hecho |
| E3 | CA1 (pendientes, rama existente, pull fallido), DoD-b | `tests/unit/services/git/git-manager.test.ts` › «E3 — createBranch: reutilizar rama existente y cortes antes de crear» (12 casos: rama en local, rama solo en origin, cambios pendientes, ruta inexistente, subcarpeta de un repositorio, `PullFallido` con origin inalcanzable parado en la base y en otra rama, base divergente con `pull.rebase` (rebase sin conflicto y con conflicto) y con fetch no fast-forward parado en otra rama, y ningún `commit`/`add`/`push` en ningún camino) | Hecho |

## Prerrequisitos

- `git` instalado en la máquina que corre los tests (los tests crean repositorios temporales con `git init` y un `origin` bare local; sin red). Verificado en este entorno al implementar.
- `node:child_process` (`execFile`): disponible en Node ≥ 22.13, sin dependencias nuevas.
- Sin cambios en `eslint.config.js`: la regla de TK-02a ya impide que este módulo importe el storage manager.

## Archivos afectados

| Ruta | Acción |
|---|---|
| `src/services/git/git-manager.ts` | Crear (propuesta) |
| `tests/unit/services/git/git-manager.test.ts` | Crear (propuesta) |
| `src/shared/errors/result.types.ts` | Modificar (existente): añadir el subtipo `RamaExistenteEnRemoto` |

## Tareas

- [x] 1. E1 — RED: tests de `inspectRepository` y `validateRepository` con repositorios temporales y spy; GREEN: `GitManager` con runner inyectable y los dos métodos de solo lectura
- [x] 2. E2 — RED: tests de `createBranch` con pull y con fetch y verificación de la rama creada; GREEN: actualización de la base y `git switch -c`
- [x] 3. E3 — RED: tests de pendientes, repo inexistente, rama en local, rama solo en remoto y pull fallido; GREEN: las guardas previas a la creación
- [x] 4. Verificar la cobertura (umbral del 80 % de `src/services/**`) con `npm run test:coverage`
- [x] 5. Refactor, TSDoc en español de los exports públicos, `npm run typecheck`, `npm run lint` y `npm test` en verde

## Decisiones y desvíos

Propuestas por confirmar al aprobar el contrato:

- _(asumido)_ **Runner inyectable:** `GitManager` recibe por constructor un runner `(cwd: string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>` (tipo exportado desde `git-manager.ts`). El valor por defecto usa `execFile("git", args, { cwd })` sin shell (sin inyección por nombre de rama) y nunca lanza por un código de salida distinto de cero. Los tests lo envuelven con un spy sobre el runner real, no lo reemplazan. Con un solo archivo en el ticket, el tipo y el runner por defecto viven en `git-manager.ts`.
- _(asumido)_ **«Repositorio no existe»:** la ruta no existe, o `git rev-parse --is-inside-work-tree` falla. `RepositorioNoEncontrado` también cubre `validateRepository` sin `origin` o sin la rama base en el remoto (se comprueba con `git remote get-url origin` y `git ls-remote --exit-code --heads origin <base>`); el `message` distingue el caso, porque el conjunto de subtipos no tiene otro adecuado.
- **Rama «ya existe»** _(decidido por el desarrollador, 2026-11-03; sustituye a las propuestas anteriores de traer la rama remota)_:
  1. Si la rama existe en **local** (`git rev-parse --verify --quiet refs/heads/<rama>`): `branchAlreadyExists = true`. No hay cambios que hacer: la app avisa que la rama existe y **consulta si se usa la misma**. `createBranch` devuelve `alreadyExisted: true` sin ejecutar nada de escritura.
  2. Si no está en local, se consulta el remoto (`git ls-remote --exit-code --heads origin <rama>`). Si **ya existe en `origin`**, la app **no la trae ni la crea**: se detiene con `ErrorBloqueante('RamaExistenteEnRemoto')` y un aviso para que el usuario la verifique y, si quiere usarla, la configure a mano.
  3. Si no está en ninguna, `inspectRepository` devuelve `branchAlreadyExists = false` y `createBranch` actualiza la base y la crea con `git switch -c <rama> <base>`.
  - `ls-remote` solo lee y no modifica refs locales, así que `inspectRepository` sigue siendo de solo lectura (el spy permite `ls-remote`, no `fetch`). Las interfaces del ticket no cambian.
  - El caso 2 se detecta en `inspectRepository` (antes de la confirmación) y se repite en `createBranch`.
- **La rama no se crea en el remoto** _(decidido por el desarrollador, 2026-11-03)_: la app solo valida que la rama no exista en `origin` y la crea únicamente en local, desde la base actualizada. Publicarla (`push`) queda del lado del usuario; ADR-007.1 no cambia.
- _(asumido)_ **Subtipo nuevo `RamaExistenteEnRemoto`:** se añade a `ErrorBloqueanteSubtype` en `src/shared/errors/result.types.ts` (archivo de TK-02a, cambio de una línea); los subtipos actuales no describen este caso. Archivo añadido a «Archivos afectados».
- **La consulta al usuario («¿usas esa misma rama?») no es del `GitManager`:** el Orquestador la formula dentro de la confirmación única de H-03 cuando `branchAlreadyExists` es `true`, antes de llamar a `createBranch`. Si el usuario no acepta, el Orquestador cancela sin crear nada (TK-02f). Registrar la rama como la del ticket es de TK-02f (`ticket_logs`). _(asumido: no hay alternativa de elegir otro nombre de rama)_
- **Efecto en otros documentos (pendiente de autorizar):** reflejar el subtipo `RamaExistenteEnRemoto` y la consulta sobre la rama local en `docs/006` (TK-02c y TK-02f), `docs/009` §3.1 pasos 3 y 5, `docs/002` y `docs/005` US-03 CA5. Este contrato no los modifica.
- _(asumido)_ **`ls-remote` sin respuesta** (sin red, `origin` inalcanzable): `inspectRepository` no bloquea y decide solo con la rama local (`true` o `false`), porque la falla de red la reporta después `createBranch` como `PullFallido`.
- _(asumido)_ **«Parado en la base»:** `git branch --show-current` igual a `baseBranch`. HEAD desacoplado (cadena vacía) cuenta como «otra rama» y usa `git fetch origin <base>:<base>`.
- _(asumido)_ **Cambios pendientes:** `git status --porcelain` con salida no vacía; `message` incluye la lista de archivos tal como la devuelve Git (una línea por archivo).
- _(asumido)_ **`PullFallido`:** cualquier código de salida distinto de cero en `pull --ff-only` o `fetch origin <base>:<base>`; `message` lleva el `stderr` de Git para explicar el motivo (sin red, divergencia, credenciales).
- _(asumido)_ **Fallo inesperado de Git** al crear la rama (p. ej. `switch -c` falla tras actualizar la base): `ErrorBloqueante('ErrorInesperado')` con el `stderr` en el mensaje.
- _(asumido)_ **Sin comandos de escritura distintos de los permitidos:** la lista blanca de subcomandos del runner es `rev-parse`, `status`, `branch`, `remote`, `ls-remote`, `pull`, `fetch` y `switch`; los tests verifican con el spy que nada fuera de esa lista (en particular `commit`, `add` y `push`) se ejecuta.

Registro de la implementación de E1 (2026-11-04):

- **Runner por defecto:** se llama `runGitCommand` (export público, además del tipo `GitRunner`); ante una ruta inexistente devuelve `exitCode: -1` en lugar de lanzar, y fija `GIT_TERMINAL_PROMPT=0` para que Git nunca espere credenciales.
- **Tests con Git 2.25:** `git init -b` no existe en esa versión; los repositorios temporales usan `git checkout -b main`. La identidad de los commits de prueba se pasa con `-c user.name/user.email`.
- **Referencia completa en `ls-remote`:** se consulta `refs/heads/<rama>` y no el nombre suelto, porque `ls-remote` casa por sufijo y `otro/features/X` contaría como `features/X` (hay un test). Un nombre como `--all` se trata como nombre de rama, no como opción (hay un test).
- _(asumido, no previsto en el contrato)_ **`validateRepository` con remoto inalcanzable:** si `ls-remote` falla por un motivo distinto de «no existe la rama» (sin red, credenciales), devuelve `ErrorBloqueante('ErrorInesperado')` con el `stderr` de Git, no `RepositorioNoEncontrado`. `inspectRepository` sigue sin bloquear en ese caso, como acordado.
- **Pendiente para E2:** `createBranch` empleará `git switch -c <rama> <base>` con un nombre que podría empezar por `-`; lo trataré al escribir E2 (la rama se construye como `<prefijo>/<ID>-<SUFIJO>`, así que el riesgo es bajo).

Registro de la implementación de E2 (2026-11-04):

- **Nombre de rama o base que empieza por «-»:** `createBranch` los rechaza con `ErrorBloqueante('ErrorInesperado')` antes de ejecutar nada, porque `git switch -c` no admite `--` delante del nombre. Resuelve el punto que quedó pendiente en E1.
- **Base sin copia local:** parado en otra rama, `git fetch origin <base>:<base>` crea la base local si no existía (hay un test con `develop`).
- **Fallo de `git switch -c`:** `ErrorBloqueante('ErrorInesperado')` con el `stderr` de Git.
- **Rama ya existente en local:** `createBranch` todavía no devuelve `alreadyExisted: true` (intentaría crearla); es lo que cubre E3.

Registro de la implementación de E3 (2026-11-04):

- **Rama ya existente en local:** `createBranch` devuelve `Ok({ alreadyExisted: true })` justo después de la verificación, sin pull, fetch ni switch, y deja el repositorio en la rama en la que estaba.
- **Cobertura (tarea 4):** `git-manager.ts` marca 95,08 % en sentencias, 93,02 % en ramas, 100 % en funciones y 94,44 % en líneas (umbral del 80 %). Suite completa: 175 tests, typecheck y lint en verde. Las líneas sin cubrir son tres ramas de `ErrorInesperado` difíciles de provocar con Git real: `validateRepository` con remoto inalcanzable, fallo de `git switch -c` y fallo de `git status`.

Ajustes tras `/05-verificar-y-revisar` (2026-11-04, aprobados por el desarrollador, aplicados con TDD):

- **Solo la raíz de un repositorio es un repositorio:** `isRepository` usa `git rev-parse --is-inside-work-tree --show-prefix` y exige prefijo vacío; una subcarpeta de un repositorio da `RepositorioNoEncontrado` en `inspectRepository`, `validateRepository` y `createBranch` (un test en cada uno). Antes se aceptaba cualquier subcarpeta.
- **Lista blanca de subcomandos real:** los tests ya no buscan comandos prohibidos sino que comprueban con el spy que todo subcomando ejecutado está en una lista blanca: `rev-parse`, `status`, `branch`, `remote` y `ls-remote` para inspección y alta, más `pull`, `fetch` y `switch` en `createBranch` (así, cualquier comando de escritura no previsto, además de `commit`, `add` y `push`, haría fallar el test). Cumple lo asumido en el contrato.
- **Cobertura y suite tras los ajustes:** `git-manager.ts` 95,23 % en sentencias y 93,33 % en ramas; 178 tests en total, typecheck y lint en verde.

Corrección tras la revisión de la PR #3 (2026-11-04, hallazgo de gravedad alta de Cursor, aprobada por el desarrollador, aplicada con TDD):

- **`git pull` respetaba `pull.rebase` y `branch.<base>.rebase`:** con historial divergente y esa configuración (global o del repositorio), `git pull --ff-only origin <base>` reescribía el commit local con un rebase y `createBranch` ramificaba desde una base que lo incluía, contra ADR-007.1; si el rebase tenía conflicto, el repositorio quedaba a mitad de un rebase. Ahora el pull es `git pull --no-rebase --ff-only origin <base>`, que anula ambas opciones: una base divergente da `PullFallido` y no se toca la historia ni el working tree. Un test lo reproduce (RED) con `pull.rebase=true` y `branch.main.rebase=true`. El camino de `fetch origin <base>:<base>` no pasa por `pull` y no se ve afectado.
- **Test aprobado modificado con autorización del desarrollador:** la aserción de E2 «parado en la base» pasó de `["pull", "--ff-only", "origin", "main"]` a `["pull", "--no-rebase", "--ff-only", "origin", "main"]`, porque el comando cambió.
- **Documentación pendiente:** el comando se cita sin `--no-rebase` en ADR-007.1, `docs/002`, `docs/006`, `docs/009` y `CLAUDE.md`; falta sincronizarlo.

Segunda tanda de la revisión de la PR #3 (2026-11-04, hallazgos de gravedad media y baja de Cursor, aprobados por el desarrollador, aplicados con TDD):

- **Aislamiento de la configuración de Git en los tests (media):** los tests fijan `HOME`, `XDG_CONFIG_HOME`, `USERPROFILE`, `GIT_CONFIG_GLOBAL` y `GIT_CONFIG_NOSYSTEM` sobre `process.env` (con un `.gitconfig` vacío en una carpeta temporal), de modo que tanto el helper `git()` como el runner real ignoran la configuración del desarrollador. `GIT_CONFIG_GLOBAL` solo lo respeta Git ≥ 2.32; con HOME/XDG el aislamiento vale también para Git 2.25. El test de base divergente se parametrizó con las dos variantes pedidas (rebase que terminaría en 0 y rebase con conflicto), con `pull.rebase=true` en la configuración global y `branch.main.rebase=true` en la del repositorio. Se comprobó que ambas variantes fallan al quitar `--no-rebase`.
- **Validación de nombres de rama (baja):** `inspectRepository`, `validateRepository` y `createBranch` validan la rama (y la base) con `git check-ref-format --branch` —comparando su salida con el nombre para que `@{-1}` no se expanda— y rechazan además los que empiezan por `-` o `+` (con `+main`, `git fetch origin +main:+main` forzaba el refspec y creaba una rama llamada `+main`). Un nombre inválido da `ErrorBloqueante('ErrorInesperado')` antes de armar el patrón de `ls-remote` o el refspec de `fetch`; se valida después de comprobar el repositorio y antes de `git status`. La lista blanca de los tests incorpora `check-ref-format`. Cambia un test aprobado: «una rama con nombre de opción no se interpreta como argumento de Git» esperaba `Ok({ branchAlreadyExists: false })` para `--all` y ahora espera `ErrorInesperado` (autorizado por el desarrollador al pasar el hallazgo).
- **Timeout del runner (baja):** `createGitRunner({ timeoutMs })` (por defecto 120 000 ms, elegido sin que el ticket lo fije) corta el proceso al vencer y devuelve `exitCode: -1` con «Tiempo de espera agotado»; `runGitCommand` pasa a ser `createGitRunner()`. Por la vía normal queda como `PullFallido` (pull o fetch), `ErrorInesperado` (status o switch) o, en `ls-remote`, como «sin respuesta» (no bloquea la inspección). Tests (describe «runGitCommand: timeout», 2 casos, fuera de E1-E3): un comando que espera stdin se corta, y uno rápido no se ve afectado.
- **Casos que faltaban (baja):** HEAD desacoplado usa `fetch origin <base>:<base>` sin `pull`, y una base divergente parado en otra rama da `PullFallido` por fetch no fast-forward sin tocar la base local.
- **Backlog (baja):** `docs/LIDR/backlog-2da-entrega.md` pasa de 9 a 10 criterios de US-03, e incorpora la fila de CA10.
