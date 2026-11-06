import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SQLiteStorageManager } from "../../src/database/sqlite-storage-manager.js";
import { createOrchestrator } from "../../src/services/orchestrator/create-orchestrator.js";
import type { TicketOrchestrator } from "../../src/services/orchestrator/ticket-orchestrator.js";
import type { AskCallback, TicketRunSummary } from "../../src/shared/types/ticket-run.types.js";

// Flujo completo de `startTicket` con todo real salvo Jira y Ollama (simulados con msw): `createOrchestrator` con SQLite en un archivo,
// Git sobre repositorios temporales con un `origin` local, y carpetas temporales de tickets.

const JIRA = "https://equipo.atlassian.net";
const OLLAMA = "http://localhost:11434";
const BRANCH = "bugs/SCRUM-2-AROCHA";

const server = setupServer();

/** Aísla a Git de la configuración de quien corre los tests (igual que los tests de `GitManager`). */
const savedEnv = { ...process.env };
let isolatedHome = "";
const ISOLATED = ["HOME", "XDG_CONFIG_HOME", "USERPROFILE", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT"];

beforeAll(() => {
  isolatedHome = mkdtempSync(join(tmpdir(), "devflow-e2e-home-"));
  writeFileSync(join(isolatedHome, ".gitconfig"), "");
  Object.assign(process.env, {
    HOME: isolatedHome,
    XDG_CONFIG_HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    GIT_CONFIG_GLOBAL: join(isolatedHome, ".gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
  });
  server.listen({ onUnhandledFrame: "error" });
});

afterAll(() => {
  server.close();
  for (const key of ISOLATED) {
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

/** Un `origin` bare local y un clon parado en `main`, con un commit inicial ya publicado. */
function createRepo(base: string, name: string): string {
  const origin = join(base, `${name}-origin.git`);
  const repo = join(base, name);
  git(base, "init", "--bare", origin);
  git(base, "clone", origin, repo);
  git(repo, "checkout", "-b", "main");
  writeFileSync(join(repo, "README.md"), "inicial\n");
  git(repo, "add", "README.md");
  git(repo, "commit", "-m", "inicial");
  git(repo, "push", "-u", "origin", "main");
  return repo;
}

/** Respuesta del modelo para un bug: cumple el schema, con `entorno` y `comportamientoEsperado` marcados como ausentes. */
const BUG_FASE1 = {
  presenteEnTicket: { pasosParaReproducir: true, comportamientoEsperado: false, comportamientoActual: true, entorno: false, escenarios: true },
  resumen: "El botón Aceptar desaparece al borrar el importe.",
  pasosParaReproducir: ["Borrar el importe."],
  comportamientoEsperado: "",
  comportamientoActual: "El botón Aceptar desaparece.",
  entorno: "",
  escenarios: [{ titulo: "Botón visible", given: "un importe cargado", when: "se borra el importe", then: "el botón Aceptar sigue visible" }],
  preguntasAbiertas: [],
};

function ndjson(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const half = Math.floor(text.length / 2);
  const lines = [{ response: text.slice(0, half), done: false }, { response: text.slice(half), done: true }];
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines.map((l) => JSON.stringify(l)).join("\n") + "\n"));
      controller.close();
    },
  });
}

/** Simula Jira (proyectos, ticket y `/myself`) y Ollama (la Fase 1 de un bug, o un error HTTP). */
function simulate(options: { ollama: "ok" | "caido" } = { ollama: "ok" }): void {
  server.use(
    http.get(`${JIRA}/rest/api/2/project/:key`, ({ params }) => HttpResponse.json({ key: params.key, name: `Proyecto ${String(params.key)}` })),
    http.get(`${JIRA}/rest/api/2/myself`, () => HttpResponse.json({ displayName: "Andrea Rocha" })),
    http.get(`${JIRA}/rest/api/2/issue/:id`, ({ params }) =>
      HttpResponse.json({
        id: "1",
        key: params.id,
        fields: { summary: "El botón Aceptar desaparece", description: "Al borrar el importe desaparece el botón Aceptar", issuetype: { name: "Error" } },
      }),
    ),
    http.post(`${OLLAMA}/api/generate`, () =>
      options.ollama === "ok"
        ? new HttpResponse(ndjson(JSON.stringify(BUG_FASE1)), { headers: { "Content-Type": "application/x-ndjson" } })
        : HttpResponse.json({ error: "model not found" }, { status: 404 }),
    ),
  );
}

interface World {
  dir: string;
  tickets: string;
  dbPath: string;
  repo: string;
  orchestrator: TicketOrchestrator;
  repositoryId: number;
  /** Respuestas dadas a `ask` y confirmaciones recibidas. */
  confirmations: Array<{ branchAlreadyExists: boolean }>;
  start: (ticketId: string, extra?: { repositoryId?: number }) => Promise<TicketRunSummary>;
  rows: () => Array<Record<string, unknown>>;
}

const dirs: string[] = [];
const orchestrators: TicketOrchestrator[] = [];

/** Configura la herramienta como lo haría `devflow config` y `devflow config proyectos`: sin tocar la base directamente. */
async function setup(): Promise<World> {
  const dir = mkdtempSync(join(tmpdir(), "devflow-e2e-"));
  dirs.push(dir);
  const tickets = join(dir, "tickets");
  const dbPath = join(dir, "db", "devflow.db");
  const repo = createRepo(dir, "repo");
  simulate();

  const orchestrator = createOrchestrator({ databasePath: dbPath });
  orchestrators.push(orchestrator);
  orchestrator.saveConfig({
    jiraBaseUrl: JIRA,
    jiraEmail: "dev@example.com",
    jiraApiToken: "token",
    branchUserSuffix: "AROCHA",
    ticketsRootPath: tickets,
  });
  expect((await orchestrator.addProject("scrum")).kind).toBe("Ok");
  const added = await orchestrator.addRepository({ jiraProjectKey: "SCRUM", name: "repo", repoLocalPath: repo });
  if (added.kind !== "Ok") throw new Error(`alta del repositorio fallida: ${JSON.stringify(added)}`);

  const confirmations: World["confirmations"] = [];
  const ask = (async (request: { kind: string; summary?: { branchAlreadyExists: boolean } }) => {
    if (request.kind === "confirmActions") {
      confirmations.push({ branchAlreadyExists: request.summary!.branchAlreadyExists });
      return true;
    }
    return { title: "x", description: "y" };
  }) as unknown as AskCallback;

  return {
    dir,
    tickets,
    dbPath,
    repo,
    orchestrator,
    repositoryId: added.value.id,
    confirmations,
    start: (ticketId, extra = {}) =>
      orchestrator.startTicket({ ticketId, repositoryId: extra.repositoryId ?? added.value.id }, { onStep: () => {}, ask }),
    rows: () => {
      const reader = new SQLiteStorageManager(dbPath);
      try {
        return reader.db.prepare("SELECT * FROM ticket_logs ORDER BY id").all() as Array<Record<string, unknown>>;
      } finally {
        reader.close();
      }
    },
  };
}

afterEach(() => {
  server.resetHandlers();
  for (const orchestrator of orchestrators.splice(0)) orchestrator.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const withinRepo = (repo: string, path: string): boolean => !relative(repo, path).startsWith("..") && !relative(repo, path).split(sep).includes("..");

describe("startTicket de punta a punta (Git, carpetas y SQLite reales; Jira y Ollama simulados)", { timeout: 30_000 }, () => {
  let w: World;
  beforeEach(async () => {
    w = await setup();
  });

  it("camino feliz: crea la rama real, la carpeta y el documento fuera del repositorio, y registra la ejecución", async () => {
    const summary = await w.start("SCRUM-2");

    expect(summary).toMatchObject({ branchName: BRANCH, branchStatus: "created", ollamaStatus: "ok", jiraFetchStatus: "ok", promptVersion: "bug-v1" });
    expect(summary.blocked).toBeUndefined();

    // Git: el repositorio queda parado en la rama nueva, sin ningún archivo tocado ni commit nuevo.
    expect(git(w.repo, "branch", "--show-current").trim()).toBe(BRANCH);
    expect(git(w.repo, "status", "--porcelain").trim()).toBe("");
    expect(git(w.repo, "rev-list", "--count", "HEAD").trim()).toBe("1");

    // Archivos: fuera del repositorio, con la carpeta de adjuntos y el documento escrito.
    expect(withinRepo(w.repo, summary.folderPath!)).toBe(false);
    expect(existsSync(join(summary.folderPath!, "adjuntos"))).toBe(true);
    const document = readFileSync(summary.documentPath!, "utf8");
    expect(document).toContain("SCRUM-2");
    expect(document).toContain(BRANCH);
    expect(document).toContain("Andrea Rocha");
    expect(document).toContain("El botón Aceptar desaparece al borrar el importe.");
    // El posprocesado convirtió en «No especificado» lo que el modelo marcó como ausente.
    expect(document).toContain("No especificado en el ticket.");
    expect(existsSync(join(w.tickets, "SCRUM-2", ".devflow", "fase1.json"))).toBe(true);

    // SQLite: una sola fila con todo lo ocurrido.
    expect(w.rows()).toHaveLength(1);
    expect(w.rows()[0]).toMatchObject({
      ticket_id: "SCRUM-2",
      repository_id: w.repositoryId,
      branch_name: BRANCH,
      branch_status: "created",
      jira_fetch_status: "ok",
      ollama_status: "ok",
      prompt_version: "bug-v1",
      folder_path: summary.folderPath,
      document_path: summary.documentPath,
    });
    expect(w.confirmations).toEqual([{ branchAlreadyExists: false }]);
  });

  it("Ollama caído: la rama, la carpeta y el documento se crean igual, con el texto original sin redactar", async () => {
    simulate({ ollama: "caido" });

    const summary = await w.start("SCRUM-2");

    expect(summary).toMatchObject({ branchStatus: "created", ollamaStatus: "fallback_deterministic" });
    expect(git(w.repo, "branch", "--show-current").trim()).toBe(BRANCH);
    const document = readFileSync(summary.documentPath!, "utf8");
    expect(document).toContain("⚠️ Generado sin Ollama");
    expect(document).toContain("Al borrar el importe desaparece el botón Aceptar");
    expect(existsSync(join(w.tickets, "SCRUM-2", ".devflow", "fase1.json"))).toBe(false);
    expect(w.rows()[0]).toMatchObject({ ollama_status: "fallback_deterministic", prompt_version: "bug-v1" });
  });

  it("cambios pendientes reales: se detiene sin confirmar, lista los archivos y no crea nada", async () => {
    writeFileSync(join(w.repo, "notas.txt"), "sin commitear\n");

    const summary = await w.start("SCRUM-2");

    expect(summary.blocked).toMatchObject({ subtype: "CambiosPendientes" });
    expect(summary.blocked?.message).toContain("notas.txt");
    expect(summary).toMatchObject({ branchStatus: "pending_changes", folderPath: null, documentPath: null, ollamaStatus: null });
    expect(w.confirmations).toEqual([]);
    expect(git(w.repo, "branch", "--list", BRANCH).trim()).toBe("");
    expect(git(w.repo, "branch", "--show-current").trim()).toBe("main");
    expect(existsSync(join(w.tickets, "SCRUM-2"))).toBe(false);
    expect(w.rows()[0]).toMatchObject({ branch_status: "pending_changes", folder_path: null, document_path: null, ollama_status: null });
  });

  it("rama solo en origin: se detiene sin confirmar y no crea ni publica nada", async () => {
    git(w.repo, "branch", BRANCH);
    git(w.repo, "push", "origin", BRANCH);
    git(w.repo, "branch", "-D", BRANCH);

    const summary = await w.start("SCRUM-2");

    expect(summary.blocked).toMatchObject({ subtype: "RamaExistenteEnRemoto" });
    expect(w.confirmations).toEqual([]);
    expect(git(w.repo, "branch", "--show-current").trim()).toBe("main");
    expect(existsSync(join(w.tickets, "SCRUM-2"))).toBe(false);
    expect(w.rows()[0]).toMatchObject({ branch_status: "error" });
  });

  it("rama ya existente en local: se confirma usarla, no se duplica y el repositorio queda en la rama en la que estaba", async () => {
    git(w.repo, "branch", BRANCH);

    const summary = await w.start("SCRUM-2");

    expect(w.confirmations).toEqual([{ branchAlreadyExists: true }]);
    expect(summary).toMatchObject({ branchStatus: "already_existed", ollamaStatus: "ok" });
    expect(git(w.repo, "branch", "--show-current").trim()).toBe("main");
    expect(git(w.repo, "branch", "--list", BRANCH).trim()).not.toBe("");
    expect(existsSync(summary.documentPath!)).toBe(true);
    expect(w.rows()[0]).toMatchObject({ branch_status: "already_existed" });
  });

  it("una clave sin repositorios genera solo el documento: no toca ningún repositorio", async () => {
    expect((await w.orchestrator.addProject("OTRO")).kind).toBe("Ok");

    const summary = await w.orchestrator.startTicket({ ticketId: "OTRO-7" }, { onStep: () => {}, ask: (async () => true) as unknown as AskCallback });

    expect(summary).toMatchObject({ repositoryId: null, branchName: null, branchStatus: null, ollamaStatus: "ok" });
    expect(summary.documentPath).toBe(join(w.tickets, "OTRO-7", "OTRO-7.md"));
    expect(existsSync(summary.documentPath!)).toBe(true);
    expect(git(w.repo, "branch", "--show-current").trim()).toBe("main");
    expect(w.rows().find((row) => row.ticket_id === "OTRO-7")).toMatchObject({ repository_id: null, branch_name: null });
  });

  it("repetir el ticket con la misma rama no duplica la fila de ticket_logs", async () => {
    await w.start("SCRUM-2");
    git(w.repo, "switch", "main");

    await w.start("SCRUM-2");

    expect(w.rows()).toHaveLength(1);
    expect(w.rows()[0]).toMatchObject({ branch_status: "already_existed" });
  });
});
