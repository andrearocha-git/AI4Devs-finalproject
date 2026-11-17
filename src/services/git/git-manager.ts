import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { StepResult } from "../../shared/errors/result.types.js";

/** Resultado de un comando Git: nunca lanza por un código de salida distinto de cero, lo informa en `exitCode`. */
export interface GitCommandResult {
  /** Código de salida de Git; `0` es éxito. `-1` indica que Git no llegó a terminar (ruta inexistente, `git` no disponible o timeout). */
  exitCode: number;
  /** Salida estándar del comando, sin recortar. */
  stdout: string;
  /** Salida de error de Git; si no llegó a terminar, el motivo (por ejemplo «Tiempo de espera agotado»). */
  stderr: string;
}

/**
 * Ejecutor de comandos Git inyectable: permite espiar qué subcomandos se ejecutan (garantía de «nunca commit, add ni push»).
 *
 * @param cwd Carpeta donde se ejecuta el comando.
 * @param args Argumentos de `git`, uno por elemento (sin la palabra `git`).
 * @returns El resultado del comando; un código de salida distinto de cero es un resultado, no una excepción.
 */
export type GitRunner = (cwd: string, args: string[]) => Promise<GitCommandResult>;

/** Opciones del runner de Git. */
export interface GitRunnerOptions {
  /** Tiempo máximo por comando, en milisegundos; al vencer se corta el proceso. Por defecto 120 000 (2 min). */
  timeoutMs?: number;
  /** Tamaño máximo de la salida de un comando, en bytes; al superarlo se corta el proceso. Por defecto 10 MiB. */
  maxBufferBytes?: number;
}

/**
 * Crea el runner por defecto: ejecuta `git` sin shell (el nombre de rama no puede inyectar comandos), sin prompts interactivos de
 * credenciales y con un timeout, para que un remoto colgado o un helper de credenciales no dejen la herramienta esperando para siempre.
 *
 * @param options.timeoutMs Tiempo máximo por comando; ver {@link GitRunnerOptions}.
 * @returns Un `GitRunner`. Ante un código de salida distinto de cero, una ruta inexistente o un timeout devuelve `exitCode` distinto
 *   de cero (`-1` si Git no llegó a terminar) y el motivo en `stderr`; nunca lanza.
 */
export function createGitRunner(options: GitRunnerOptions = {}): GitRunner {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxBuffer = options.maxBufferBytes ?? 10 * 1024 * 1024;
  return (cwd, args) =>
    new Promise((resolve) => {
      execFile(
        "git",
        args,
        { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, encoding: "utf8", maxBuffer, timeout: timeoutMs },
        (error, stdout, stderr) => {
          if (!error) return resolve({ exitCode: 0, stdout, stderr });
          if (error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
            return resolve({ exitCode: -1, stdout, stderr: `La salida de «git ${args[0] ?? ""}» fue demasiado larga (más de ${maxBuffer} bytes) y se cortó.` });
          }
          if (error.killed) {
            const seconds = timeoutMs / 1000;
            return resolve({ exitCode: -1, stdout, stderr: `Tiempo de espera agotado (${seconds} s) ejecutando «git ${args[0] ?? ""}».` });
          }
          const exitCode = typeof error.code === "number" ? error.code : -1;
          resolve({ exitCode, stdout, stderr: stderr || error.message });
        },
      );
    });
}

/** Runner por defecto de {@link GitManager}: `git` real con el timeout por defecto. */
export const runGitCommand: GitRunner = createGitRunner();

/** `git ls-remote --exit-code` termina con este código cuando ninguna referencia coincide. */
const LS_REMOTE_NO_MATCH = 2;

/** Marcadores de `.git` que Git deja mientras una operación sigue abierta, con el nombre que se le muestra al usuario. */
const OPERATIONS_IN_PROGRESS: ReadonlyArray<readonly [gitPath: string, name: string]> = [
  ["rebase-merge", "rebase"],
  ["rebase-apply", "rebase"],
  ["REBASE_HEAD", "rebase"],
  ["MERGE_HEAD", "merge"],
  ["CHERRY_PICK_HEAD", "cherry-pick"],
  ["REVERT_HEAD", "revert"],
];

/** Quita el usuario y la contraseña (`https://usuario:token@host` → `https://host`) de las URLs que Git repite en sus errores. */
function redactCredentials(text: string): string {
  return text.replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^/\s@]+@/gi, "$1");
}

/** Argumentos para consultar si `origin` tiene la rama; la referencia completa evita coincidencias por sufijo. */
function lsRemoteHeads(branch: string): string[] {
  return ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${branch}`];
}

/**
 * Gestor de Git (ADR-007.1): inspecciona un repositorio en modo solo lectura y, tras la confirmación del usuario, actualiza la base y crea la rama del ticket.
 *
 * Nunca ejecuta `commit`, `add` ni `push`; publicar la rama queda del lado del usuario.
 */
export class GitManager {
  /** @param runner Ejecutor de comandos Git; por defecto el `git` real. Los tests inyectan un spy sobre él. */
  constructor(private readonly runner: GitRunner = runGitCommand) {}

  /**
   * Verifica, al dar de alta un repositorio, que sea un repositorio Git con remoto `origin` y que la rama base exista en ese remoto.
   *
   * No escribe nada. Consulta el remoto con `git ls-remote`.
   *
   * @param input.repoLocalPath Ruta local del repositorio.
   * @param input.baseBranch Rama base que debe existir en `origin`.
   * @returns `Ok` si todo está; `ErrorBloqueante('RepositorioNoEncontrado')` cuyo `message` dice qué falta (repositorio, `origin` o rama base);
   *   `ErrorBloqueante('ErrorInesperado')` si el nombre de la rama base no es válido o el remoto no se pudo consultar (sin red, credenciales, timeout).
   */
  async validateRepository(input: { repoLocalPath: string; baseBranch: string }): Promise<StepResult<void>> {
    const { repoLocalPath, baseBranch } = input;
    if (!(await this.isRepository(repoLocalPath))) return notARepository(repoLocalPath);
    const invalid = await this.firstInvalidBranchName(repoLocalPath, [baseBranch]);
    if (invalid !== null) return invalidBranchName(invalid);

    const origin = await this.runner(repoLocalPath, ["remote", "get-url", "origin"]);
    if (origin.exitCode !== 0) {
      return blocked("RepositorioNoEncontrado", `El repositorio ${repoLocalPath} no tiene un remoto «origin» configurado.`);
    }

    const base = await this.runner(repoLocalPath, lsRemoteHeads(baseBranch));
    if (base.exitCode === LS_REMOTE_NO_MATCH) {
      return blocked("RepositorioNoEncontrado", `La rama base «${baseBranch}» no existe en el remoto «origin» de ${repoLocalPath}.`);
    }
    if (base.exitCode !== 0) {
      return blocked("ErrorInesperado", `No se pudo consultar el remoto «origin» de ${repoLocalPath}: ${redactCredentials(base.stderr.trim())}`);
    }
    return { kind: "Ok", value: undefined };
  }

  /**
   * Inspección de solo lectura que el Orquestador ejecuta antes de pedir la confirmación: repositorio, cambios pendientes y rama del ticket.
   *
   * No hace `fetch`, `pull`, `switch` ni escribe nada. Si `origin` no responde, decide solo con la rama local.
   *
   * @param input.repoLocalPath Ruta local del repositorio.
   * @param input.branchName Rama del ticket (`<prefijo>/<ID>-<SUFIJO>`).
   * @returns `Ok({ branchAlreadyExists })` (`true` solo si la rama existe en local);
   *   `ErrorBloqueante('RepositorioNoEncontrado')`; `ErrorBloqueante('CambiosPendientes')` con la lista de archivos en `message`;
   *   `ErrorBloqueante('RamaExistenteEnRemoto')` si la rama no está en local pero sí en `origin`;
   *   `ErrorBloqueante('ErrorInesperado')` si el nombre de la rama no es válido.
   */
  async inspectRepository(input: { repoLocalPath: string; branchName: string }): Promise<StepResult<{ branchAlreadyExists: boolean }>> {
    const checked = await this.checkRepository(input.repoLocalPath, input.branchName, [input.branchName]);
    if (checked.kind !== "Ok") return checked;
    return { kind: "Ok", value: { branchAlreadyExists: checked.value.existsLocally } };
  }

  /**
   * Actualiza la rama base y crea la rama del ticket a partir de ella. Se ejecuta después de la confirmación del usuario.
   *
   * Repite la verificación de `inspectRepository` (el árbol pudo cambiar mientras el usuario confirmaba). Si la rama ya existe en local
   * no hace nada más. Si no está parado en la base (otra rama o HEAD desacoplado) ejecuta `git switch <base>`; el árbol está limpio, así que no pierde nada.
   * Luego `git pull --no-rebase --ff-only origin <base>` (`--no-rebase` anula `pull.rebase` y `branch.<base>.rebase`: la base nunca se reescribe).
   * Por último `git switch -c <rama> <base>`, que deja el repositorio parado en la rama nueva. Si el pull o la creación de la rama fallan, el repositorio queda parado en la base y el mensaje lo dice. La base debe existir en local o como `origin/<base>` ya traída: `git switch` no consulta la red, y la app no hace `fetch`. Nunca ejecuta `commit`, `add` ni `push`.
   *
   * @param input.repoLocalPath Ruta local del repositorio.
   * @param input.branchName Rama del ticket; debe ser un nombre de rama válido para Git (no puede empezar por «-» ni «+»).
   * @param input.baseBranch Rama base (la configurada o la del override `--base`), con las mismas reglas de nombre; no se modifica la configuración.
   * @returns `Ok` con la rama creada, o con `alreadyExisted: true` (sin escribir nada ni cambiar de rama) si ya existía en local; los mismos `ErrorBloqueante` de `inspectRepository`;
   *   `ErrorBloqueante('PullFallido')` con el motivo de Git si la base no se pudo actualizar (nunca se ramifica desde una base vieja);
   *   `ErrorBloqueante('ErrorInesperado')` si un nombre de rama no es válido, no se puede leer la rama actual o `git switch` falla (por ejemplo, la base solo existe en el remoto y nunca se trajo: el mensaje pide ejecutar `git fetch origin`).
   *   Los mensajes de error no incluyen usuario ni token de las URLs del remoto.
   */
  async createBranch(input: {
    repoLocalPath: string;
    branchName: string;
    baseBranch: string;
  }): Promise<StepResult<{ branchName: string; baseBranch: string; alreadyExisted: boolean }>> {
    const { repoLocalPath, branchName, baseBranch } = input;
    const checked = await this.checkRepository(repoLocalPath, branchName, [branchName, baseBranch]);
    if (checked.kind !== "Ok") return checked;
    if (checked.value.existsLocally) return { kind: "Ok", value: { branchName, baseBranch, alreadyExisted: true } };

    // Flujo congelado (ADR-007.1, regla de CLAUDE.md): es el manual de la desarrolladora — ir a la base, pull, crear la rama. No añadir
    // ni reordenar comandos ni reintroducir `fetch`; lo fija el test «Contrato del flujo». Cambiarlo requiere su autorización expresa.
    const current = await this.runner(repoLocalPath, ["branch", "--show-current"]);
    if (current.exitCode !== 0) {
      return blocked("ErrorInesperado", `No se pudo leer la rama actual de ${repoLocalPath}: ${redactCredentials(current.stderr.trim())}`);
    }
    const previousBranch = current.stdout.trim();
    const switchedToBase = previousBranch !== baseBranch;
    if (switchedToBase) {
      const moved = await this.runner(repoLocalPath, ["switch", baseBranch]);
      if (moved.exitCode !== 0) {
        return blocked(
          "ErrorInesperado",
          `No se pudo cambiar a la rama base «${baseBranch}». Si solo existe en el remoto y tu repositorio aún no la ha traído, ejecuta «git fetch origin» y vuelve a intentar. Git: ${redactCredentials(moved.stderr.trim())}`,
        );
      }
    }
    // Si hubo que moverse a la base y algo falla después, el repositorio queda en ella: el mensaje lo dice para que no sorprenda.
    const movedNote = switchedToBase
      ? ` El repositorio quedó en la rama base «${baseBranch}»${previousBranch === "" ? "" : ` (estabas en «${previousBranch}»)`}.`
      : "";
    const update = await this.runner(repoLocalPath, ["pull", "--no-rebase", "--ff-only", "origin", baseBranch]);
    if (update.exitCode !== 0) {
      return blocked("PullFallido", `No se pudo actualizar la rama base «${baseBranch}» desde «origin»: ${redactCredentials(update.stderr.trim())}${movedNote}`);
    }

    const created = await this.runner(repoLocalPath, ["switch", "-c", branchName, baseBranch]);
    if (created.exitCode !== 0) {
      return blocked(
        "ErrorInesperado",
        `No se pudo crear la rama «${branchName}» desde «${baseBranch}»: ${redactCredentials(created.stderr.trim())}${movedNote}`,
      );
    }
    return { kind: "Ok", value: { branchName, baseBranch, alreadyExisted: false } };
  }

  /** Verificación común de `inspectRepository` y `createBranch`: repositorio, cambios pendientes y dónde existe la rama. */
  private async checkRepository(
    repoLocalPath: string,
    branchName: string,
    namesToValidate: string[],
  ): Promise<StepResult<{ existsLocally: boolean }>> {
    if (!(await this.isRepository(repoLocalPath))) return notARepository(repoLocalPath);
    const invalid = await this.firstInvalidBranchName(repoLocalPath, namesToValidate);
    if (invalid !== null) return invalidBranchName(invalid);

    const status = await this.runner(repoLocalPath, ["status", "--porcelain"]);
    if (status.exitCode !== 0) {
      return blocked("ErrorInesperado", `No se pudo leer el estado de ${repoLocalPath}: ${redactCredentials(status.stderr.trim())}`);
    }
    if (status.stdout.trim() !== "") {
      return blocked(
        "CambiosPendientes",
        `El repositorio ${repoLocalPath} tiene cambios pendientes; resuélvelos y vuelve a ejecutar:\n${status.stdout.trimEnd()}`,
      );
    }

    const inProgress = await this.operationInProgress(repoLocalPath);
    if (inProgress !== null) {
      return blocked(
        "CambiosPendientes",
        `El repositorio ${repoLocalPath} tiene un ${inProgress} en curso; termínalo o cancélalo y vuelve a ejecutar.`,
      );
    }

    const local = await this.runner(repoLocalPath, ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`]);
    if (local.exitCode === 0) return { kind: "Ok", value: { existsLocally: true } };

    const remote = await this.runner(repoLocalPath, lsRemoteHeads(branchName));
    if (remote.exitCode === 0) {
      return blocked(
        "RamaExistenteEnRemoto",
        `La rama «${branchName}» ya existe en el remoto «origin» pero no en tu repositorio local. Verifícala y, si quieres usarla, configúrala de forma manual.`,
      );
    }
    return { kind: "Ok", value: { existsLocally: false } };
  }

  /**
   * Devuelve el primer nombre que no sea un nombre de rama válido, o `null` si todos lo son. Se valida antes de armar el patrón de
   * `ls-remote`: `git check-ref-format --branch` rechaza `:`, `*`, `?`, espacios y `@{-1}` (se compara la
   * salida con el nombre para que no se expanda), y se descartan además `-` (opción de Git), `+` y `refs/` al inicio: la app solo trabaja con
   * ramas locales, y un nombre `refs/tags/…` apuntaría a un tag.
   */
  private async firstInvalidBranchName(repoLocalPath: string, names: string[]): Promise<string | null> {
    for (const name of names) {
      if (name === "" || name.startsWith("-") || name.startsWith("+") || name.startsWith("refs/")) return name;
      const result = await this.runner(repoLocalPath, ["check-ref-format", "--branch", name]);
      if (result.exitCode !== 0 || result.stdout.trim() !== name) return name;
    }
    return null;
  }

  /**
   * Nombre de la operación de Git abierta (`rebase`, `merge`, `cherry-pick` o `revert`), o `null` si no hay ninguna. `git status --porcelain`
   * sale vacío con un rebase parado en `edit`, así que se miran los marcadores de `.git` (que pueden vivir fuera de la carpeta en
   * worktrees, de ahí `--git-path`).
   */
  private async operationInProgress(repoLocalPath: string): Promise<string | null> {
    const paths = await this.runner(repoLocalPath, ["rev-parse", ...OPERATIONS_IN_PROGRESS.flatMap(([gitPath]) => ["--git-path", gitPath])]);
    if (paths.exitCode !== 0) return null;
    const resolved = paths.stdout.split("\n").map((line) => line.trim());
    const found = OPERATIONS_IN_PROGRESS.find((_, index) => resolved[index] && existsSync(resolve(repoLocalPath, resolved[index])));
    return found ? found[1] : null;
  }

  /** `true` solo si la ruta es la raíz de un repositorio: una subcarpeta tiene un prefijo no vacío respecto de la raíz. */
  private async isRepository(repoLocalPath: string): Promise<boolean> {
    const result = await this.runner(repoLocalPath, ["rev-parse", "--is-inside-work-tree", "--show-prefix"]);
    const [insideWorkTree, prefix = ""] = result.stdout.split("\n").map((line) => line.trim());
    return result.exitCode === 0 && insideWorkTree === "true" && prefix === "";
  }
}

function blocked(
  subtype: "RepositorioNoEncontrado" | "CambiosPendientes" | "RamaExistenteEnRemoto" | "PullFallido" | "ErrorInesperado",
  message: string,
) {
  return { kind: "ErrorBloqueante", subtype, message } as const;
}

function invalidBranchName(name: string) {
  return blocked("ErrorInesperado", `Nombre de rama no válido: «${name}».`);
}

function notARepository(repoLocalPath: string) {
  return blocked("RepositorioNoEncontrado", `No se encontró un repositorio Git en ${repoLocalPath}.`);
}
