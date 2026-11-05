import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createOrchestrator } from "../../../../src/services/orchestrator/create-orchestrator.js";

const BASE_URL = "https://equipo.atlassian.net";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "devflow-compose-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("E1 — createOrchestrator (raíz de composición)", () => {
  it("crea la carpeta de la base, la migra y devuelve un Orquestador funcional en una base nueva", () => {
    const databasePath = join(dir, "DevFlowCLI", "devflow.db");

    const orchestrator = createOrchestrator({ databasePath });

    expect(existsSync(databasePath)).toBe(true);
    expect(orchestrator.getConfig()).toBeNull();
    expect(orchestrator.listProjects()).toEqual([]);
  });

  it("reabrir una base existente conserva lo guardado (migraciones idempotentes)", () => {
    const databasePath = join(dir, "devflow.db");
    createOrchestrator({ databasePath }).saveConfig({
      jiraBaseUrl: BASE_URL,
      jiraEmail: "dev@example.com",
      jiraApiToken: "token",
      branchUserSuffix: "AROCHA",
      ticketsRootPath: "/tickets",
    });

    const reopened = createOrchestrator({ databasePath });

    expect(reopened.getConfig()).toMatchObject({ jiraEmail: "dev@example.com", branchUserSuffix: "AROCHA" });
  });

  it("el cliente de Jira se arma con la configuración guardada (URL, email, token y timeout)", async () => {
    const orchestrator = createOrchestrator({ databasePath: join(dir, "devflow.db") });
    orchestrator.saveConfig({
      jiraBaseUrl: BASE_URL,
      jiraEmail: "dev@example.com",
      jiraApiToken: "token-secreto",
      branchUserSuffix: "AROCHA",
      ticketsRootPath: "/tickets",
    });
    const requests: Request[] = [];
    server.use(
      http.get(`${BASE_URL}/rest/api/2/project/:key`, ({ request }) => {
        requests.push(request);
        return HttpResponse.json({ key: "SCRUM", name: "Scrum Board" });
      }),
    );

    const result = await orchestrator.addProject("scrum");

    expect(result.kind).toBe("Ok");
    expect(requests).toHaveLength(1);
    const expected = `Basic ${Buffer.from("dev@example.com:token-secreto").toString("base64")}`;
    expect(requests[0]?.headers.get("authorization")).toBe(expected);
    expect(orchestrator.listProjects().map((p) => p.jiraProjectKey)).toEqual(["SCRUM"]);
  });
});
