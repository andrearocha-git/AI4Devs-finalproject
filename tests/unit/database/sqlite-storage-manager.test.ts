import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { TicketLogEntry } from "../../../src/shared/types/config.types.js";
import { SQLiteStorageManager } from "../../../src/database/sqlite-storage-manager.js";

const schemaSql = readFileSync(
  new URL("../../../src/database/schema.sql", import.meta.url),
  "utf-8",
);

function newMigrated(): SQLiteStorageManager {
  const manager = new SQLiteStorageManager(":memory:");
  manager.migrate();
  return manager;
}

function tableNames(manager: SQLiteStorageManager): string[] {
  const rows = manager.db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function schemaObjects(manager: SQLiteStorageManager): unknown[] {
  return manager.db
    .prepare("SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")
    .all();
}

describe("E1 — esquema y migraciones", () => {
  it("crea las 4 tablas y foreign_key_check no reporta violaciones", () => {
    const manager = newMigrated();
    expect(tableNames(manager)).toEqual(["app_config", "jira_projects", "repositories", "ticket_logs"]);
    expect(manager.db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("aplicar las migraciones dos veces no falla ni duplica nada", () => {
    const manager = newMigrated();
    expect(() => manager.migrate()).not.toThrow();
    expect(tableNames(manager)).toHaveLength(4);
  });

  it("el esquema de la migración coincide con schema.sql", () => {
    const fromMigration = newMigrated();
    const fromSchema = new SQLiteStorageManager(":memory:");
    fromSchema.db.exec(schemaSql);
    expect(schemaObjects(fromMigration)).toEqual(schemaObjects(fromSchema));
  });

  describe("los CHECK rechazan valores fuera de dominio", () => {
    function insertLog(manager: SQLiteStorageManager, overrides: Record<string, string | null>): void {
      manager.db.exec("INSERT INTO jira_projects (id, jira_project_key, jira_project_name) VALUES (1, 'SCRUM', 'Mi Team')");
      const row: Record<string, string | number | null> = {
        ticket_id: "SCRUM-1",
        jira_project_id: 1,
        issue_type: "Historia",
        branch_type: "feature",
        branch_status: "created",
        jira_fetch_status: "ok",
        ollama_status: "ok",
        started_at: "2026-01-01T00:00:00Z",
        ...overrides,
      };
      const cols = Object.keys(row);
      manager.db
        .prepare(`INSERT INTO ticket_logs (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
        .run(...Object.values(row));
    }

    it("acepta valores válidos, incluido ollama_status = 'reused'", () => {
      expect(() => insertLog(newMigrated(), { ollama_status: "reused" })).not.toThrow();
    });

    it.each([
      ["branch_status", "otro"],
      ["ollama_status", "otro"],
      ["jira_fetch_status", "otro"],
      ["branch_type", "otro"],
    ])("rechaza %s inválido", (column, value) => {
      expect(() => insertLog(newMigrated(), { [column]: value })).toThrow(/CHECK constraint failed/);
    });
  });

  it("activa foreign_keys en la conexión", () => {
    const manager = newMigrated();
    expect(manager.db.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
  });

  it("habilita el modo WAL en una base de archivo", () => {
    const dir = mkdtempSync(join(tmpdir(), "devflow-"));
    const manager = new SQLiteStorageManager(join(dir, "devflow.db"));
    try {
      expect(manager.db.prepare("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" });
    } finally {
      manager.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("E2 — configuración, proyectos y repositorios", () => {
  it("getAppConfig devuelve null con la tabla vacía, sin lanzar", () => {
    const manager = newMigrated();
    expect(manager.getAppConfig()).toBeNull();
  });

  it("upsertJiraProject con la misma clave actualiza la fila (mismo id)", () => {
    const manager = newMigrated();
    const first = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
    const second = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Nuevo nombre" });

    expect(second.id).toBe(first.id);
    expect(second.jiraProjectName).toBe("Nuevo nombre");
    expect(manager.db.prepare("SELECT COUNT(*) AS n FROM jira_projects").get()).toEqual({ n: 1 });
  });

  it("upsertRepository con el mismo (jiraProjectId, name) actualiza la fila (mismo id)", () => {
    const manager = newMigrated();
    const project = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
    const first = manager.upsertRepository({ jiraProjectId: project.id, name: "backend", repoLocalPath: "C:\\repos\\a" });
    const second = manager.upsertRepository({
      jiraProjectId: project.id,
      name: "backend",
      repoLocalPath: "C:\\repos\\b",
      defaultBaseBranch: "develop",
    });

    expect(first.defaultBaseBranch).toBe("main");
    expect(second.id).toBe(first.id);
    expect(second.repoLocalPath).toBe("C:\\repos\\b");
    expect(second.defaultBaseBranch).toBe("develop");
    expect(manager.db.prepare("SELECT COUNT(*) AS n FROM repositories").get()).toEqual({ n: 1 });
  });

  it("removeJiraProject elimina también sus repositorios (ON DELETE CASCADE)", () => {
    const manager = newMigrated();
    const project = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
    manager.upsertRepository({ jiraProjectId: project.id, name: "backend", repoLocalPath: "C:\\repos\\a" });
    manager.upsertRepository({ jiraProjectId: project.id, name: "frontend", repoLocalPath: "C:\\repos\\b" });

    manager.removeJiraProject("SCRUM");

    expect(manager.db.prepare("SELECT COUNT(*) AS n FROM jira_projects").get()).toEqual({ n: 0 });
    expect(manager.db.prepare("SELECT COUNT(*) AS n FROM repositories").get()).toEqual({ n: 0 });
  });
});

describe("E3 — historial de tickets con upsert", () => {
  function setup(): { manager: SQLiteStorageManager; projectId: number; repositoryId: number } {
    const manager = newMigrated();
    const project = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });
    const repo = manager.upsertRepository({ jiraProjectId: project.id, name: "backend", repoLocalPath: "C:\\repos\\a" });
    return { manager, projectId: project.id, repositoryId: repo.id };
  }

  function entry(projectId: number, repositoryId: number | null, overrides: Partial<TicketLogEntry> = {}): TicketLogEntry {
    return {
      ticketId: "SCRUM-1",
      jiraProjectId: projectId,
      repositoryId,
      issueType: "Historia",
      branchType: "feature",
      branchName: "features/SCRUM-1-AROCHA",
      baseBranch: "main",
      branchStatus: "created",
      jiraFetchStatus: "ok",
      ollamaStatus: "ok",
      folderPath: "C:\\tickets\\SCRUM-1",
      documentPath: "C:\\tickets\\SCRUM-1\\backend\\SCRUM-1.md",
      startedAt: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  function rows(manager: SQLiteStorageManager): Record<string, unknown>[] {
    return manager.db.prepare("SELECT * FROM ticket_logs ORDER BY id").all();
  }

  it("repetir (ticketId, repositoryId) actualiza la misma fila", () => {
    const { manager, projectId, repositoryId } = setup();
    manager.upsertTicketLog(entry(projectId, repositoryId));
    manager.upsertTicketLog(entry(projectId, repositoryId, { ollamaStatus: "reused", finishedAt: "2026-01-01T00:01:00Z" }));

    const all = rows(manager);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ollama_status: "reused", finished_at: "2026-01-01T00:01:00Z" });
  });

  it("con repositoryId = null y el mismo ticketId actualiza en lugar de duplicar", () => {
    const { manager, projectId } = setup();
    const doc = { branchName: null, baseBranch: null, branchStatus: null, folderPath: "C:\\tickets\\SCRUM-1" } as const;
    manager.upsertTicketLog(entry(projectId, null, doc));
    manager.upsertTicketLog(entry(projectId, null, { ...doc, ollamaStatus: "fallback_deterministic" }));

    const all = rows(manager);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ repository_id: null, ollama_status: "fallback_deterministic" });
  });

  it("acepta una ejecución cortada en Git y su reejecución actualiza esa misma fila", () => {
    const { manager, projectId, repositoryId } = setup();
    manager.upsertTicketLog(
      entry(projectId, repositoryId, {
        branchStatus: "pending_changes",
        folderPath: null,
        documentPath: null,
        ollamaStatus: null,
      }),
    );
    const cut = rows(manager);
    expect(cut).toHaveLength(1);
    expect(cut[0]).toMatchObject({ branch_status: "pending_changes", folder_path: null, document_path: null, ollama_status: null });

    manager.upsertTicketLog(entry(projectId, repositoryId));

    const rerun = rows(manager);
    expect(rerun).toHaveLength(1);
    expect(rerun[0]?.id).toBe(cut[0]?.id);
    expect(rerun[0]).toMatchObject({ branch_status: "created", ollama_status: "ok" });
    expect(rerun[0]?.folder_path).not.toBeNull();
  });
});

describe("Tarea 4 — lecturas y operaciones restantes del ticket", () => {
  const baseConfig = {
    jiraBaseUrl: "https://example.atlassian.net",
    jiraEmail: "dev@example.com",
    jiraApiToken: "token",
    branchUserSuffix: "AROCHA",
    ticketsRootPath: "C:\\tickets",
  };

  it("upsertAppConfig inserta la fila única con los valores por defecto", () => {
    const manager = newMigrated();
    manager.upsertAppConfig(baseConfig);

    expect(manager.getAppConfig()).toMatchObject({
      id: 1,
      ...baseConfig,
      ollamaModel: "qwen2.5:3b",
      ollamaTimeoutSeconds: 120,
      branchPrefixFeature: "features",
      branchPrefixBugfix: "bugs",
      adjuntosDirName: "adjuntos",
    });
  });

  it("upsertAppConfig parcial actualiza solo los campos indicados, sin duplicar la fila", () => {
    const manager = newMigrated();
    manager.upsertAppConfig(baseConfig);
    manager.upsertAppConfig({ ollamaTimeoutSeconds: 300 });

    expect(manager.getAppConfig()).toMatchObject({ ...baseConfig, ollamaTimeoutSeconds: 300 });
    expect(manager.db.prepare("SELECT COUNT(*) AS n FROM app_config").get()).toEqual({ n: 1 });
  });

  it("getJiraProject devuelve el proyecto por clave y null si no existe", () => {
    const manager = newMigrated();
    const saved = manager.upsertJiraProject({ jiraProjectKey: "SCRUM", jiraProjectName: "Mi Team" });

    expect(manager.getJiraProject("SCRUM")).toEqual(saved);
    expect(manager.getJiraProject("NOPE")).toBeNull();
  });

  it("listJiraProjects devuelve todos los proyectos ordenados por clave", () => {
    const manager = newMigrated();
    manager.upsertJiraProject({ jiraProjectKey: "ZETA", jiraProjectName: "Z" });
    manager.upsertJiraProject({ jiraProjectKey: "ALFA", jiraProjectName: "A" });

    expect(manager.listJiraProjects().map((p) => p.jiraProjectKey)).toEqual(["ALFA", "ZETA"]);
  });

  it("listRepositories lista solo los del proyecto y removeRepository borra uno", () => {
    const manager = newMigrated();
    const a = manager.upsertJiraProject({ jiraProjectKey: "ALFA", jiraProjectName: "A" });
    const b = manager.upsertJiraProject({ jiraProjectKey: "BETA", jiraProjectName: "B" });
    const backend = manager.upsertRepository({ jiraProjectId: a.id, name: "backend", repoLocalPath: "C:\\a" });
    manager.upsertRepository({ jiraProjectId: a.id, name: "frontend", repoLocalPath: "C:\\b" });
    manager.upsertRepository({ jiraProjectId: b.id, name: "otro", repoLocalPath: "C:\\c" });

    expect(manager.listRepositories(a.id).map((r) => r.name)).toEqual(["backend", "frontend"]);

    manager.removeRepository(backend.id);

    expect(manager.listRepositories(a.id).map((r) => r.name)).toEqual(["frontend"]);
    expect(manager.listRepositories(b.id)).toHaveLength(1);
  });
});
