import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createGitRunner, GitManager, runGitCommand, type GitRunner } from "../../../../src/services/git/git-manager.js";

const BRANCH = "features/SCRUM-1-AROCHA";
/** Lista blanca de subcomandos: solo lectura (inspección y alta). */
const READ_ONLY = ["rev-parse", "status", "branch", "remote", "ls-remote", "check-ref-format"];
/** Lista blanca de `createBranch`: la lectura más la actualización de la base y la creación de la rama. */
const CAN_WRITE = [...READ_ONLY, "pull", "switch"];

/**
 * Aísla a Git de la configuración del desarrollador que corre los tests (`pull.rebase`, alias, hooks…): HOME y XDG apuntan a una carpeta
 * temporal con un `.gitconfig` vacío. Se hace sobre `process.env` porque el runner real también lo hereda. `GIT_CONFIG_GLOBAL` solo
 * lo respeta Git ≥ 2.32; con HOME/XDG el aislamiento vale también para versiones anteriores.
 */
const savedEnv = { ...process.env };
let isolatedHome = "";

beforeAll(() => {
  isolatedHome = mkdtempSync(join(tmpdir(), "devflow-git-home-"));
  writeFileSync(join(isolatedHome, ".gitconfig"), "");
  Object.assign(process.env, {
    HOME: isolatedHome,
    XDG_CONFIG_HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    GIT_CONFIG_GLOBAL: join(isolatedHome, ".gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  });
});

afterAll(() => {
  for (const key of ["HOME", "XDG_CONFIG_HOME", "USERPROFILE", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT"]) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  rmSync(isolatedHome, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], {
    cwd,
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
  // Un test puede dejar `pull.rebase` y similares en el .gitconfig aislado; el siguiente debe empezar limpio.
  writeFileSync(join(isolatedHome, ".gitconfig"), "");
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

  it.each(["--all", "+main", "feat:x", "feat*", "feat?", "@{-1}", "con espacio", ""])(
    "nombre de rama no válido «%s» → ErrorBloqueante('ErrorInesperado') sin consultar el remoto",
    async (branchName) => {
      const { repo } = createEnv();
      const { runner, calls } = spyRunner();

      const result = await new GitManager(runner).inspectRepository({ repoLocalPath: repo, branchName });

      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
      expect(subcommands(calls)).not.toContain("ls-remote");
    },
  );
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

  it.each(["+main", "ma:in", "ma*in"])("nombre de rama base no válido «%s» → ErrorInesperado sin consultar el remoto", async (baseBranch) => {
    const { repo } = createEnv();
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).validateRepository({ repoLocalPath: repo, baseBranch });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(subcommands(calls)).not.toContain("ls-remote");
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

describe("E2 — createBranch con rama nueva: actualización de la base y creación (TK-02c CA1 pull y caso feliz, DoD-a)", () => {
  it("parado en la base: git pull --no-rebase --ff-only origin <base>, luego git switch -c una sola vez", async () => {
    const env = createEnv();
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: false } });
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "main"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "-c", BRANCH, "main"]]);
    expect(git(env.repo, "branch", "--show-current").trim()).toBe(BRANCH);
    expect(git(env.repo, "ls-tree", "--name-only", BRANCH)).toContain("de-origin.txt");
    expect(outsideAllowList(calls, CAN_WRITE)).toEqual([]);
  });

  it("parado en otra rama: git switch <base>, luego git pull (sin fetch) y la rama nueva parte de la base actualizada", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: false } });
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "main"], ["switch", "-c", BRANCH, "main"]]);
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "main"]);
    expect(subcommands(calls)).not.toContain("fetch");
    expect(git(env.repo, "ls-tree", "--name-only", BRANCH)).toContain("de-origin.txt");
    expect(git(env.repo, "ls-tree", "--name-only", "main")).toContain("de-origin.txt");
    expect(outsideAllowList(calls, CAN_WRITE)).toEqual([]);
  });

  it("rama base distinta de la configurada (--base): crea la rama desde ella aunque no exista en local (con origin/<base> ya traída)", async () => {
    const env = createEnv();
    git(env.repo, "branch", "develop");
    git(env.repo, "push", "origin", "develop");
    git(env.repo, "branch", "-D", "develop");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "develop" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "develop", alreadyExisted: false } });
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "develop"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "develop"], ["switch", "-c", BRANCH, "develop"]]);
    expect(subcommands(calls)).not.toContain("fetch");
  });

  it.each([
    { branchName: "-x", baseBranch: "main" },
    { branchName: BRANCH, baseBranch: "+main" },
    { branchName: BRANCH, baseBranch: "ma:in" },
    { branchName: "feat*", baseBranch: "main" },
  ])("nombre de rama o base no válido ($branchName sobre $baseBranch) → ErrorInesperado sin fetch ni switch", async (input) => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, ...input });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
  });

  it("HEAD desacoplado cuenta como «otra rama»: git switch <base>, git pull y rama nueva desde la base actualizada", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "--detach");
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toEqual({ kind: "Ok", value: { branchName: BRANCH, baseBranch: "main", alreadyExisted: false } });
    expect(calls).toContainEqual(["switch", "main"]);
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "main"]);
    expect(subcommands(calls)).not.toContain("fetch");
    expect(git(env.repo, "ls-tree", "--name-only", BRANCH)).toContain("de-origin.txt");
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

  it("origin inalcanzable parado en otra rama → ErrorBloqueante('PullFallido') (pull fallido tras pasar a la base) y sin crear la rama", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    rmSync(env.origin, { recursive: true, force: true });
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "main"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "main"]]);
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

  it.each([
    { caso: "el rebase se aplicaría sin conflicto", archivo: "de-origin.txt" },
    { caso: "el rebase dejaría un conflicto", archivo: "README.md" },
  ])(
    "base divergente con pull.rebase=true ($caso) → PullFallido: no reescribe el commit local ni deja un rebase a medias",
    async ({ archivo }) => {
      const env = createEnv();
      git(env.repo, "config", "--global", "pull.rebase", "true");
      git(env.repo, "config", "branch.main.rebase", "true");
      writeFileSync(join(env.repo, archivo === "README.md" ? "README.md" : "local.txt"), "solo local\n");
      git(env.repo, "add", "-A");
      git(env.repo, "commit", "-m", "commit local");
      const headBefore = git(env.repo, "rev-parse", "HEAD").trim();
      publishCommitToOrigin(env, "main", archivo);
      const { runner, calls } = spyRunner();

      const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
      expect(subcommands(calls)).not.toContain("switch");
      expect(git(env.repo, "rev-parse", "HEAD").trim()).toBe(headBefore);
      expect(git(env.repo, "branch", "--show-current").trim()).toBe("main");
      expect(git(env.repo, "status", "--porcelain").trim()).toBe("");
      expect(git(env.repo, "branch", "--list", BRANCH).trim()).toBe("");
    },
  );

  it("base divergente parado en otra rama → PullFallido (pull que no es fast-forward) y sin crear la rama", async () => {
    const env = createEnv();
    writeFileSync(join(env.repo, "local.txt"), "solo local\n");
    git(env.repo, "add", "local.txt");
    git(env.repo, "commit", "-m", "commit local");
    const mainBefore = git(env.repo, "rev-parse", "main").trim();
    git(env.repo, "checkout", "-b", "otra");
    publishCommitToOrigin(env, "main", "de-origin.txt");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    expect(calls).toContainEqual(["pull", "--no-rebase", "--ff-only", "origin", "main"]);
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "main"]]);
    expect(git(env.repo, "rev-parse", "main").trim()).toBe(mainBefore);
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

describe("runGitCommand: timeout (revisión de la PR #3)", () => {
  it("un comando que no termina se corta al vencer el timeout y se informa como fallo, no como espera infinita", async () => {
    const env = createEnv();
    const runner = createGitRunner({ timeoutMs: 200 });

    // `hash-object --stdin` espera la entrada estándar, que nunca se cierra.
    const result = await runner(env.repo, ["hash-object", "--stdin"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/tiempo de espera/i);
  });

  it("un comando que termina a tiempo no se ve afectado", async () => {
    const env = createEnv();

    const result = await createGitRunner({ timeoutMs: 10_000 })(env.repo, ["rev-parse", "--is-inside-work-tree"]);

    expect(result).toMatchObject({ exitCode: 0, stdout: "true\n" });
  });
});

describe("Revisión de la PR #3 (2.ª pasada): sin tags ni refs completas, operaciones en curso y tokens en los mensajes", () => {
  const TOKEN = "ghp_s3cr3t";

  it.each([
    { branchName: "refs/tags/v1", baseBranch: "main" },
    { branchName: BRANCH, baseBranch: "refs/tags/v1" },
    { branchName: BRANCH, baseBranch: "refs/heads/main" },
  ])("nombre que empieza por refs/ ($branchName sobre $baseBranch) → ErrorInesperado sin tocar tags ni ramas", async (input) => {
    const env = createEnv();
    git(env.repo, "tag", "v1");
    git(env.repo, "push", "origin", "v1");
    git(env.repo, "checkout", "-b", "otra");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, ...input });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
    expect(git(env.repo, "tag", "--list").trim()).toBe("v1");
    expect(git(env.repo, "branch", "--show-current").trim()).toBe("otra");
  });

  it("validateRepository y inspectRepository también rechazan nombres que empiezan por refs/", async () => {
    const env = createEnv();
    const manager = new GitManager();

    expect(await manager.validateRepository({ repoLocalPath: env.repo, baseBranch: "refs/heads/main" })).toMatchObject({
      kind: "ErrorBloqueante",
      subtype: "ErrorInesperado",
    });
    expect(await manager.inspectRepository({ repoLocalPath: env.repo, branchName: "refs/tags/v1" })).toMatchObject({
      kind: "ErrorBloqueante",
      subtype: "ErrorInesperado",
    });
  });

  /** Deja un rebase interactivo parado en `edit`: índice limpio, `git status --porcelain` vacío y HEAD desacoplado. */
  function startRebaseStoppedAtEdit(env: TestEnv): void {
    writeFileSync(join(env.repo, "a.txt"), "a\n");
    git(env.repo, "add", "a.txt");
    git(env.repo, "commit", "-m", "a");
    git(env.repo, "-c", "sequence.editor=sed -i s/^pick/edit/", "rebase", "-i", "HEAD~1");
    expect(git(env.repo, "status", "--porcelain").trim()).toBe("");
  }

  it.each(["inspectRepository", "createBranch"] as const)(
    "rebase en curso con el índice limpio (%s) → CambiosPendientes que lo menciona, sin fetch, pull ni switch",
    async (method) => {
      const env = createEnv();
      startRebaseStoppedAtEdit(env);
      const headBefore = git(env.repo, "rev-parse", "HEAD").trim();
      const { runner, calls } = spyRunner();
      const manager = new GitManager(runner);

      const result =
        method === "inspectRepository"
          ? await manager.inspectRepository({ repoLocalPath: env.repo, branchName: BRANCH })
          : await manager.createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "CambiosPendientes" });
      if (result.kind !== "ErrorBloqueante") return;
      expect(result.message).toMatch(/rebase/i);
      expect(outsideAllowList(calls, READ_ONLY)).toEqual([]);
      expect(git(env.repo, "rev-parse", "HEAD").trim()).toBe(headBefore);
    },
  );

  it("cherry-pick, revert y merge en curso (marcadores de .git) también cortan con CambiosPendientes", async () => {
    for (const marker of ["CHERRY_PICK_HEAD", "REVERT_HEAD", "MERGE_HEAD"]) {
      const env = createEnv();
      writeFileSync(join(env.repo, ".git", marker), git(env.repo, "rev-parse", "HEAD"));

      const result = await new GitManager().inspectRepository({ repoLocalPath: env.repo, branchName: BRANCH });

      expect(result, marker).toMatchObject({ kind: "ErrorBloqueante", subtype: "CambiosPendientes" });
    }
  });

  it("PullFallido no repite el token de un origin con credenciales en la URL", async () => {
    const env = createEnv();
    git(env.repo, "remote", "set-url", "origin", `http://usuario:${TOKEN}@127.0.0.1:1/repo.git`);

    const result = await new GitManager().createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).not.toContain(TOKEN);
  });

  it("los errores de validateRepository, git switch y git status no repiten el token de la URL", async () => {
    const leak = `fatal: unable to access 'https://usuario:${TOKEN}@github.com/o/r.git/': Could not resolve host`;
    const failing = (subcommand: string): GitRunner => async (cwd, args) => {
      const real = await runGitCommand(cwd, args);
      return args[0] === subcommand && !(subcommand === "switch" && args[1] !== "-c") ? { exitCode: 128, stdout: "", stderr: leak } : real;
    };
    const env = createEnv();

    const validate = await new GitManager(failing("ls-remote")).validateRepository({ repoLocalPath: env.repo, baseBranch: "main" });
    const create = await new GitManager(failing("switch")).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });
    const status = await new GitManager(failing("status")).inspectRepository({ repoLocalPath: env.repo, branchName: BRANCH });

    for (const result of [validate, create, status]) {
      expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
      if (result.kind !== "ErrorBloqueante") return;
      expect(result.message).not.toContain(TOKEN);
      expect(result.message).toContain("github.com");
    }
  });
});

describe("3.ª pasada de la revisión de la PR #3: base sin traer, errores del runner y mensajes", () => {
  /** Crea `branch` en `origin` desde otro clon: el repositorio bajo prueba no la conoce (ni local ni `origin/<branch>`). */
  function createRemoteOnlyBranch(env: TestEnv, branch: string): void {
    const other = join(env.root, "otro-clon-remota");
    git(env.root, "clone", env.origin, other);
    git(other, "checkout", "main");
    git(other, "checkout", "-b", branch);
    git(other, "push", "origin", branch);
  }

  it("base que solo existe en origin y nunca se trajo → ErrorInesperado que pide traerla, sin pull ni rama nueva", async () => {
    const env = createEnv();
    createRemoteOnlyBranch(env, "develop");
    git(env.repo, "checkout", "-b", "otra");
    const { runner, calls } = spyRunner();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "develop" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toContain("develop");
    expect(result.message).toMatch(/git fetch/);
    expect(subcommands(calls)).not.toContain("pull");
    expect(calls.filter((args) => args[0] === "switch")).toEqual([["switch", "develop"]]);
    expect(git(env.repo, "branch", "--show-current").trim()).toBe("otra");
    expect(git(env.repo, "branch", "--list", BRANCH).trim()).toBe("");
  });

  it("si git branch --show-current falla → ErrorInesperado, sin switch ni pull", async () => {
    const env = createEnv();
    const failing: GitRunner = async (cwd, args) =>
      args[0] === "branch" ? { exitCode: 128, stdout: "", stderr: "fatal: no se puede leer HEAD" } : runGitCommand(cwd, args);
    const { runner, calls } = (() => {
      const recorded: string[][] = [];
      return { runner: ((cwd, args) => (recorded.push(args), failing(cwd, args))) as GitRunner, calls: recorded };
    })();

    const result = await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    expect(subcommands(calls)).not.toContain("switch");
    expect(subcommands(calls)).not.toContain("pull");
  });

  it("PullFallido tras venir de otra rama dice en qué rama quedó el repositorio y de cuál venía", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    rmSync(env.origin, { recursive: true, force: true });

    const result = await new GitManager().createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toContain("«otra»");
    expect(result.message).toMatch(/qued[óo] en la rama base «main»/);
  });

  it("PullFallido estando ya en la base no menciona ningún cambio de rama", async () => {
    const env = createEnv();
    rmSync(env.origin, { recursive: true, force: true });

    const result = await new GitManager().createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "PullFallido" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).not.toMatch(/qued[óo]/);
  });

  it("validateRepository con origin inalcanzable → ErrorInesperado con el motivo, no RepositorioNoEncontrado", async () => {
    const env = createEnv();
    rmSync(env.origin, { recursive: true, force: true });

    const result = await new GitManager().validateRepository({ repoLocalPath: env.repo, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
  });

  it("runner: una salida que supera maxBuffer se informa como tal, no como «tiempo de espera»", async () => {
    const env = createEnv();
    const runner = createGitRunner({ maxBufferBytes: 5 });

    const result = await runner(env.repo, ["log", "--oneline"]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/demasiado larga|buffer/i);
    expect(result.stderr).not.toMatch(/tiempo de espera/i);
  });
});

describe("Contrato del flujo: secuencia exacta de comandos Git de createBranch (regla de CLAUDE.md, ADR-007.1)", () => {
  /**
   * Fija el flujo manual de la desarrolladora: `git status`, ir a la base, `git pull`, `git checkout -b`. Si este test falla porque
   * alguien añadió, quitó o reordenó un comando, no se «arregla» el test: el cambio de flujo necesita autorización expresa y debe
   * anotarse en «Decisiones y desvíos» de docs/changes/TK-02c.md.
   */
  const BEFORE_UPDATE = [
    ["rev-parse", "--is-inside-work-tree", "--show-prefix"],
    ["check-ref-format", "--branch", BRANCH],
    ["check-ref-format", "--branch", "main"],
    ["status", "--porcelain"],
    [
      "rev-parse",
      "--git-path", "rebase-merge",
      "--git-path", "rebase-apply",
      "--git-path", "REBASE_HEAD",
      "--git-path", "MERGE_HEAD",
      "--git-path", "CHERRY_PICK_HEAD",
      "--git-path", "REVERT_HEAD",
    ],
    ["rev-parse", "--verify", "--quiet", `refs/heads/${BRANCH}`],
    ["ls-remote", "--exit-code", "--heads", "origin", `refs/heads/${BRANCH}`],
    ["branch", "--show-current"],
  ];
  const PULL = ["pull", "--no-rebase", "--ff-only", "origin", "main"];
  const CREATE = ["switch", "-c", BRANCH, "main"];

  it("parado en la base: comprobaciones, pull y switch -c, en ese orden y nada más", async () => {
    const env = createEnv();
    const { runner, calls } = spyRunner();

    await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(calls).toEqual([...BEFORE_UPDATE, PULL, CREATE]);
  });

  it("parado en otra rama: las mismas comprobaciones, switch a la base, pull y switch -c, en ese orden y nada más", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");
    const { runner, calls } = spyRunner();

    await new GitManager(runner).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(calls).toEqual([...BEFORE_UPDATE, ["switch", "main"], PULL, CREATE]);
  });
});

describe("Cierre de TK-02c: mensaje de git switch -c fallido tras un pull correcto", () => {
  /** Runner real que hace fallar `git switch -c` (la creación de la rama) con un `fatal:` simulado. */
  const failingCreate: GitRunner = async (cwd, args) =>
    args[0] === "switch" && args[1] === "-c" ? { exitCode: 128, stdout: "", stderr: "fatal: no se pudo crear la rama" } : runGitCommand(cwd, args);

  it("venía de otra rama: ErrorInesperado que dice que el repositorio quedó en la base y de cuál venía", async () => {
    const env = createEnv();
    git(env.repo, "checkout", "-b", "otra");

    const result = await new GitManager(failingCreate).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).toContain("fatal: no se pudo crear la rama");
    expect(result.message).toContain("«otra»");
    expect(result.message).toMatch(/qued[óo] en la rama base «main»/);
    expect(git(env.repo, "branch", "--show-current").trim()).toBe("main");
  });

  it("ya estaba en la base: el mensaje no menciona ningún cambio de rama", async () => {
    const env = createEnv();

    const result = await new GitManager(failingCreate).createBranch({ repoLocalPath: env.repo, branchName: BRANCH, baseBranch: "main" });

    expect(result).toMatchObject({ kind: "ErrorBloqueante", subtype: "ErrorInesperado" });
    if (result.kind !== "ErrorBloqueante") return;
    expect(result.message).not.toMatch(/qued[óo]/);
  });
});
