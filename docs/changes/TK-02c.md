# Change: TK-02c — Git Manager

- **Estado:** Aprobado
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
- **Then** parado en la base ejecuta `git pull --ff-only origin <base>` y parado en otra rama ejecuta `git fetch origin <base>:<base>`; después ejecuta `git switch -c <rama> <base>` exactamente una vez y devuelve `Ok({ branchName, baseBranch, alreadyExisted: false })`; la rama nueva contiene el commit nuevo de la base; el spy no registra `commit`, `add` ni `push` y la base configurada del repositorio no cambia (se usa el `baseBranch` recibido, sea el de `--base` o el configurado)

### E3 — `createBranch`: reutilizar rama existente y cortes antes de crear (cubre: CA1 pendientes, rama existente y pull fallido, DoD-b)

- **Given** repositorios temporales con cambios pendientes, con la rama del ticket solo en local, con la rama solo en `origin`, con la ruta inexistente y con un `origin` inalcanzable (ruta eliminada o historial divergente en la base)
- **When** se llama a `createBranch` con cada uno
- **Then** cambios pendientes → `ErrorBloqueante('CambiosPendientes')` con la lista de archivos, sin pull ni creación; ruta inexistente → `ErrorBloqueante('RepositorioNoEncontrado')`; rama en local → `Ok({ alreadyExisted: true })` sin ningún comando de escritura y sin cambio de la rama actual; rama solo en `origin` → `ErrorBloqueante('RamaExistenteEnRemoto')` sin `pull`, `fetch`, `switch` ni creación (el árbol pudo cambiar tras la confirmación); `origin` inalcanzable o base divergente → `ErrorBloqueante('PullFallido')` con el motivo de Git en `message` y sin crear la rama; y en ninguno de los casos se ejecuta `commit`, `add` ni `push`

## Trazabilidad

| Escenario | Criterios cubiertos | Test | Estado |
|---|---|---|---|
| E1 | CA1 (`inspectRepository`), `validateRepository`, DoD-b | _pendiente_ | Pendiente |
| E2 | CA1 (pull/fetch, caso feliz), DoD-a | _pendiente_ | Pendiente |
| E3 | CA1 (pendientes, rama existente, pull fallido), DoD-b | _pendiente_ | Pendiente |

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

- [ ] 1. E1 — RED: tests de `inspectRepository` y `validateRepository` con repositorios temporales y spy; GREEN: `GitManager` con runner inyectable y los dos métodos de solo lectura
- [ ] 2. E2 — RED: tests de `createBranch` con pull y con fetch y verificación de la rama creada; GREEN: actualización de la base y `git switch -c`
- [ ] 3. E3 — RED: tests de pendientes, repo inexistente, rama en local, rama solo en remoto y pull fallido; GREEN: las guardas previas a la creación
- [ ] 4. Verificar la cobertura (umbral del 80 % de `src/services/**`) con `npm run test:coverage`
- [ ] 5. Refactor, TSDoc en español de los exports públicos, `npm run typecheck`, `npm run lint` y `npm test` en verde

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
