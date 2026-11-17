import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installScriptIn, makeTempDir, runner, runPs, toPs } from "./ps-helper.js";

// GH-55 · E1 — Los requisitos se comprueban antes de tocar nada.

interface Resultado {
  Bloqueantes: string[];
  Avisos: string[];
}

let dir = "";
let script = "";

beforeAll(() => {
  if (runner === null) return;
  dir = makeTempDir("devflow-install-e1-");
  script = installScriptIn(dir);
});

afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

function requisitos(args: string): Resultado {
  const out = runPs(`. '${script}'; Get-ResultadoRequisitos ${args} | ConvertTo-Json -Compress`);
  expect(out.status, out.stderr).toBe(0);
  const parsed = JSON.parse(out.stdout.trim()) as { Bloqueantes: string | string[] | null; Avisos: string | string[] | null };
  const lista = (v: string | string[] | null): string[] => (v === null ? [] : Array.isArray(v) ? v : [v]);
  return { Bloqueantes: lista(parsed.Bloqueantes), Avisos: lista(parsed.Avisos) };
}

describe.skipIf(runner === null)("GH-55 · E1 — los requisitos se comprueban antes de tocar nada", { timeout: 60_000 }, () => {
  it("con Node, Git y Ollama con el modelo no hay bloqueantes ni avisos", () => {
    const r = requisitos("-NodeVersion '24.22.2' -GitDisponible $true -OllamaModelos @('qwen2.5:3b')");
    expect(r).toEqual({ Bloqueantes: [], Avisos: [] });
  });

  it("acepta justo Node 22.13.0 y rechaza 22.12.0 diciendo qué versión hace falta", () => {
    expect(requisitos("-NodeVersion '22.13.0' -GitDisponible $true -OllamaModelos @('qwen2.5:3b')").Bloqueantes).toEqual([]);
    const r = requisitos("-NodeVersion '22.12.0' -GitDisponible $true -OllamaModelos @('qwen2.5:3b')");
    expect(r.Bloqueantes).toHaveLength(1);
    expect(r.Bloqueantes[0]).toContain("Node");
    expect(r.Bloqueantes[0]).toContain("22.13");
  });

  it("sin Node instalado es un bloqueante", () => {
    const r = requisitos("-NodeVersion $null -GitDisponible $true -OllamaModelos @('qwen2.5:3b')");
    expect(r.Bloqueantes).toHaveLength(1);
    expect(r.Bloqueantes[0]).toContain("Node");
  });

  it("sin Git es un bloqueante", () => {
    const r = requisitos("-NodeVersion '24.22.2' -GitDisponible $false -OllamaModelos @('qwen2.5:3b')");
    expect(r.Bloqueantes).toHaveLength(1);
    expect(r.Bloqueantes[0]).toContain("Git");
  });

  it("con Ollama apagado solo avisa y no bloquea", () => {
    const r = requisitos("-NodeVersion '24.22.2' -GitDisponible $true -OllamaModelos $null");
    expect(r.Bloqueantes).toEqual([]);
    expect(r.Avisos).toHaveLength(1);
    expect(r.Avisos[0]).toContain("Ollama");
  });

  it("con Ollama sin el modelo avisa con el comando para descargarlo y no bloquea", () => {
    const r = requisitos("-NodeVersion '24.22.2' -GitDisponible $true -OllamaModelos @('llama3:8b')");
    expect(r.Bloqueantes).toEqual([]);
    expect(r.Avisos).toHaveLength(1);
    expect(r.Avisos[0]).toContain("ollama pull qwen2.5:3b");
  });

  it.skipIf(runner?.windows !== true)("sin Node ni Git en el PATH termina con error, lo dice y no crea la carpeta de instalación", () => {
    const destino = join(dir, "app");
    const out = runPs(
      `$env:Path = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0;C:\\Windows\\System32'; ` +
        `& '${script}' -Carpeta '${toPs(destino)}'; exit $LASTEXITCODE`,
    );
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain("Node");
    expect(out.stdout).toContain("Git");
    expect(() => readFileSync(destino)).toThrow();
  });

  it.skipIf(runner?.windows !== true)("el script lleva la marca UTF-8 (BOM) que Windows PowerShell 5.1 necesita para leer las tildes", () => {
    const bytes = readFileSync(join(process.cwd(), "scripts", "install.ps1"));
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
