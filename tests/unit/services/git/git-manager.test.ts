import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitManager, runGitCommand, type GitRunner } from "../../../../src/services/git/git-manager.js";

const BRANCH = "features/SCRUM-1-AROCHA";
/** Lista blanca de subcomandos: solo lectura (inspección y alta). */
const READ_ONLY = ["rev-parse", "status", "branch", "remote", "ls-remote"];
/** Lista blanca de `createBranch`: la lectura más la actualización de la base y la creación de la rama. */
const CAN_WRITE = [...READ_ONLY, "pull", "fetch", "switch"];

/** Entorno aislado: sin red, sin configuración global del desarrollador y sin prompts de credenciales. */
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" };

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

interface TestEnv {
  root: string;
  origin: string;
  repo: string;
}

const roots: string[] = [];

/** Crea un `origin` bare local y un clon `repo` parado en `main`, con un commit inicial ya publicado. */
function createEnv(): TestEnv {
  const root = mkdtempSync(join(tmpdir(), "devflow-git-"));
  roots.push(root);
  const origin = join(root, "origin.git");
  const repo = join(root, "repo");
  git(root, "init", "--bare", origin);
  git(root, "clone", origin, repo);
  git(repo, "checkout", "-b", "main");
  writeFileSync(join(repo, "README.md"), "inicial\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "inicial");
  git(repo, "push", "-u", "origin", "main");
  return { root, origin, repo };
}

/** Runner real envuelto con un spy que registra los argumentos de cada comando Git. */
function spyRunner(): { runner: GitRunner; calls: string[][] } {
  const calls: string[][] = [];
  const runner: GitRunner = (cwd, args) => {
    calls.push(args);
    return runGitCommand(cwd, args);
  };
  return { runner, calls };
}

function subcommands(calls: string[][]): string[] {
  return calls.map((args) => args[0] ?? "");
}

/** Subcomandos ejecutados que no están en la lista blanca (debe quedar vacío; detecta también comandos de escritura no previstos). */
function outsideAllowList(calls: string[][], allowed: string[]): string[] {
  return subcommands(calls).filter((c) => !allowed.includes(c));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("E1 — inspectRepository: solo lectura (TK-02c CA1 inspectRepository, DoD-b)", () => {
  it("repositorio limpio sin la rama en ninguna parte → Ok({ branchAlreadyExists: false })", async () => {
    const { repo } = createEnv();
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: false } });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("rama solo en local → Ok({ branchAlreadyExists: true }) sin cambiar de rama", async () => {
    const { repo } = createEnv();
    git(repo, "branch", BRANCH);
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: true } });
    expect(git(repo, "branch", "--show-current").trim()).toBe("main");
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("rama en local y también en origin → Ok({ branchAlreadyExists: true }) (gana la local)", async () => {
    const { repo } = createEnv();
    git(repo, "branch", BRANCH);
    git(repo, "push", "origin", BRANCH);

    const result = await new GitManager().inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: true } });
  });

  it("rama solo en origin → ErrorBloqueante('RamaExistenteEnRemoto') que nombra la rama", async () => {
    const { repo } = createEnv();
    git(repo, "branch", BRANCH);
    git(repo, "push", "origin", BRANCH);
    git(repo, "branch", "-D", BRANCH);
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("RamaExistenteEnRemoto");
    expect(result.message).toContain(BRANCH);
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("una rama de origin con el mismo final de nombre no cuenta como la rama del ticket", async () => {
    const { repo } = createEnv();
    git(repo, "branch", `otro/${BRANCH}`);
    git(repo, "push", "origin", `otro/${BRANCH}`);

    const result = await new GitManager().inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: false } });
  });

  it("cambios pendientes (modificado, en staging y sin trackear) → ErrorBloqueante('CambiosPendientes') con los archivos", async () => {
    const { repo } = createEnv();
    writeFileSync(join(repo, "README.md"), "modificado\n");
    writeFileSync(join(repo, "staged.txt"), "x\n");
    git(repo, "add", "staged.txt");
    writeFileSync(join(repo, "nuevo.txt"), "y\n");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("CambiosPendientes");
    expect(result.message).toContain("README.md");
    expect(result.message).toContain("staged.txt");
    expect(result.message).toContain("nuevo.txt");
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("los cambios pendientes se reportan antes de consultar el remoto", async () => {
    const { repo } = createEnv();
    writeFileSync(join(repo, "nuevo.txt"), "y\n");
    const { runner, calls } = spyRunner();

    await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(subcommands(calls)).not.toContain("ls-remote");
  });

  it("ruta inexistente → ErrorBloqueante('RepositorioNoEncontrado')", async () => {
    const { root } = createEnv();

    const result = await new GitManager().inspectRepository({ repoLocalPath: join(root, "no-existe"), branchName: BRANCH });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("carpeta que no es un repositorio Git → ErrorBloqueante('RepositorioNoEncontrado')", async () => {
    const { root } = createEnv();
    const plain = join(root, "carpeta-simple");
    mkdirSync(plain);

    const result = await new GitManager().inspectRepository({ repoLocalPath: plain, branchName: BRANCH });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("subcarpeta de un repositorio (no su raíz) → ErrorBloqueante('RepositorioNoEncontrado')", async () => {
    const { repo } = createEnv();
    const sub = join(repo, "src");
    mkdirSync(sub);

    const result = await new GitManager().inspectRepository({ repoLocalPath: sub, branchName: BRANCH });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("origin inalcanzable → no bloquea y decide solo con la rama local", async () => {
    const { repo, origin } = createEnv();
    rmSync(origin, { recursive: true, force: true });

    const result = await new GitManager().inspectRepository({ repoLocalPath: repo, branchName: BRANCH });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: false } });
  });

  it("una rama con nombre de opción no se interpreta como argumento de Git", async () => {
    const { repo } = createEnv();

    const result = await new GitManager().inspectRepository({ repoLocalPath: repo, branchName: "--all" });

    expect(result).toEqual({ kind: "Ok", value: { branchAlreadyExists: false } });
  });
});

describe("E1 — validateRepository: alta de un repositorio (TK-02c contrato validateRepository, DoD-b)", () => {
  it("repositorio con origin y rama base en el remoto → Ok", async () => {
    const { repo } = createEnv();

    const result = await new GitManager().validateRepository({ repoLocalPath: repo, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: undefined });
  });

  it("ruta inexistente o que no es un repositorio → RepositorioNoEncontrado", async () => {
    const { root } = createEnv();
    const plain = join(root, "carpeta-simple");
    mkdirSync(plain);

    const missing = await new GitManager().validateRepository({ repoLocalPath: join(root, "no-existe"), baseBranch: "main" });
    const notRepo = await new GitManager().validateRepository({ repoLocalPath: plain, baseBranch: "main" });

    expect(missing).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
    expect(notRepo).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("subcarpeta de un repositorio (no su raíz) → RepositorioNoEncontrado", async () => {
    const { repo } = createEnv();
    const sub = join(repo, "src");
    mkdirSync(sub);

    const result = await new GitManager().validateRepository({ repoLocalPath: sub, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("repositorio sin remoto origin → RepositorioNoEncontrado que menciona 'origin'", async () => {
    const { repo } = createEnv();
    git(repo, "remote", "remove", "origin");

    const result = await new GitManager().validateRepository({ repoLocalPath: repo, baseBranch: "main" });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("RepositorioNoEncontrado");
    expect(result.message).toContain("origin");
  });

  it("rama base inexistente en el remoto → RepositorioNoEncontrado que nombra la rama base", async () => {
    const { repo } = createEnv();

    const result = await new GitManager().validateRepository({ repoLocalPath: repo, baseBranch: "desarrollo" });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("RepositorioNoEncontrado");
    expect(result.message).toContain("desarrollo");
  });

  it("no ejecuta comandos de escritura", async () => {
    const { repo } = createEnv();
    const { runner, calls } = spyRunner();

    await new GitManager(runner).validateRepository({ repoLocalPath: repo, baseBranch: "main" });

    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });
});

/** Publica un commit nuevo en `branch` de `origin` desde un segundo clon, sin tocar el repositorio bajo prueba. */
function publishCommitToOrigin(env: TestEnv, branch: string, file: string): void {
  const other = join(env.root, `otro-clon-${file}`);
  git(env.root, "clone", env.origin, other);
  git(other, "checkout", branch);
  writeFileSync(join(other, file), "nuevo en origin\n");
  git(other, "add", file);
  git(other, "commit", "-m", `commit ${file}`);
  git(other, "push", "origin", branch);
}

describe("E2 — createBranch con rama nueva: actualización de la base y creación (TK-02c CA1 pull/fetch y caso feliz, DoD-a)", () => {
  it("parado en la base: git pull --ff-only origin <base>, luego git switch -c una sola vez", async () => {
    const env = createEnv();
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: false } });
    expect(calls).toContainEqual(["pull", "--ff-only", "origin", "main"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "-c", BRANCH, "main"]]);
    expect(git(env.repo, "branch", "--show-current").trim()).toBe(BRANCH);
    expect(git(env.repo, "ls-tree", "--name-only", BRANCH)).toContain("de-origin.txt");
    expect(outsideAllowList(calls, CAN_WRITE)).toEqual([]);
  });

  it("parado en otra rama: git fetch origin <base>:<base> (sin pull) y la rama nueva parte de la base actualizada", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: false } });
    expect(calls).toContainEqual(["fetch", "origin", "main:main"]);
    expect(subcommands(calls)).not.toContain("pull");
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "-c", BRANCH, "main"]]);
    expect(git(env.repo, "ls-tree", "--name-only", BRANCH)).toContain("de-origin.txt");
    expect(git(env.repo, "ls-tree", "--name-only", "main")).toContain("de-origin.txt");
    expect(outsideAllowList(calls, CAN_WRITE)).toEqual([]);
  });

  it("rama base distinta de la configurada (--base): crea la rama desde ella aunque no exista en local", async () => {
    const env = createEnv();
    git(env.repo, "branch", "develop");
    git(env.repo, "push", "origin", "develop");
    git(env.repo, "branch", "-D", "develop");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "develop" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "develop", alreadyExisted: false } });
    expect(calls).toContainEqual(["fetch", "origin", "develop:develop"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "-c", BRANCH, "develop"]]);
  });

  it("un nombre de rama que empieza por «-» se rechaza sin ejecutar switch", async () => {
    const env = createEnv();
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: "-x", baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(subcommands(calls)).not.toContain("switch");
  });
});

describe("E3 — createBranch: reutilizar rama existente y cortes antes de crear (TK-02c CA1 pendientes, rama existente y pull fallido, DoD-b)", () => {
  it("rama ya existente en local → Ok({ alreadyExisted: true }) sin comandos de escritura y sin cambiar de rama", async () => {
    const env = createEnv();
    git(env.repo, "branch", BRANCH);
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: true } });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
    expect(git(env.repo, "branch", "--show-current").trim()).toBe("main");
  });

  it("rama solo en origin → ErrorBloqueante('RamaExistenteEnRemoto') sin pull, fetch, switch ni creación", async () => {
    const env = createEnv();
    git(env.repo, "branch", BRANCH);
    git(env.repo, "push", "origin", BRANCH);
    git(env.repo, "branch", "-D", BRANCH);
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RamaExistenteEnRemoto" });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("cambios pendientes (aparecidos tras la inspección) → ErrorBloqueante('CambiosPendientes') con los archivos, sin pull ni creación", async () => {
    const env = createEnv();
    writeFileSync(join(env.repo, "README.md"), "modificado\n");
    writeFileSync(join(env.repo, "nuevo.txt"), "y\n");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("CambiosPendientes");
    expect(result.message).toContain("README.md");
    expect(result.message).toContain("nuevo.txt");
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("subcarpeta de un repositorio (no su raíz) → ErrorBloqueante('RepositorioNoEncontrado') sin comandos de escritura", async () => {
    const env = createEnv();
    const sub = join(env.repo, "src");
    mkdirSync(sub);
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: sub, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("ruta inexistente → ErrorBloqueante('RepositorioNoEncontrado')", async () => {
    const env = createEnv();

    const result = await new GitManager().createBranch({ repoLocalPath: join(env.root, "no-existe"), branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado" });
  });

  it("origin inalcanzable parado en la base → ErrorBloqueante('PullFallido') con el motivo de Git y sin crear la rama", async () => {
    const env = createEnv();
    rmSync(env.origin, { recursive: true, force: true });
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result.kind).toBe("ErrorBloqueante");
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.subtype).toBe("PullFallido");
    expect(result.message).toContain("main");
    expect(result.message.length).toBeGreaterThan("PullFallido".length);
    expect(subcommands(calls)).not.toContain("switch");
    expect(git(env.repo, "branch", "--list", BRANCH).trim()).toBe("");
  });

  it("origin inalcanzable parado en otra rama → ErrorBloqueante('PullFallido') (fetch fallido) y sin crear la rama", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    rmSync(env.origin, { recursive: true, force: true });
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    expect(calls).toContainEqual(["fetch", "origin", "main:main"]);
    expect(subcommands(calls)).not.toContain("switch");
  });

  it("base local divergente del remoto → ErrorBloqueante('PullFallido') y nunca se ramifica desde la base vieja", async () => {
    const env = createEnv();
    writeFileSync(join(env.repo, "local.txt"), "solo local\n");
    git(env.repo, "add", "local.txt");
    git(env.repo, "commit", "-m", "commit local");
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    expect(subcommands(calls)).not.toContain("switch");
    expect(git(env.repo, "branch", "--list", BRANCH).trim()).toBe("");
  });

  it("en ninguno de los caminos de E1, E2 ni E3 se ejecuta commit, add ni push", async () => {
    const env = createEnv();
    const { runner, calls } = spyRunner();
    const manager = new GitManager(runner);
    await manager.validateRepository({ repoLocalPath: env.repo, baseBranch: "main" });
    await manager.inspectRepository({ repoLocalPath: env.repo, branchName: BRANCH });
    await manager.createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });
    await manager.createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(outsideAllowList(calls, CAN_WRITE)).toEqual([]);
  });
});
