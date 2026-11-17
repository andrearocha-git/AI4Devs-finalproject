import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Ayuda para ejecutar `scripts/install.ps1` desde Vitest. En Windows usa Windows PowerShell; en Linux, `pwsh`; y en WSL,
// el `powershell.exe` de Windows, con las carpetas temporales del lado de Windows (Windows PowerShell y Git para Windows
// no manejan bien las rutas de Linux).

export interface PsResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface Runner {
  exe: string;
  /** `true` si es Windows PowerShell (rutas de Windows, aunque se lance desde WSL). */
  windows: boolean;
  /** Carpeta temporal accesible por el intérprete, vista desde el proceso de Node. */
  tmpRoot: string;
  /** Convierte una ruta del proceso de Node a la que entiende el intérprete. */
  toPs: (path: string) => string;
}

function exists(command: string): boolean {
  const finder = process.platform === "win32" ? "where" : "which";
  return spawnSync(finder, [command], { stdio: "ignore" }).status === 0;
}

function detect(): Runner | null {
  if (process.platform === "win32") {
    return { exe: "powershell.exe", windows: true, tmpRoot: tmpdir(), toPs: (p) => p };
  }
  if (exists("pwsh")) return { exe: "pwsh", windows: false, tmpRoot: tmpdir(), toPs: (p) => p };
  if (exists("powershell.exe") && exists("wslpath")) {
    const temp = spawnSync("powershell.exe", ["-NoProfile", "-Command", "$env:TEMP"], { encoding: "utf8" }).stdout.trim();
    const tmpRoot = spawnSync("wslpath", ["-u", temp], { encoding: "utf8" }).stdout.trim();
    const toPs = (p: string): string => spawnSync("wslpath", ["-w", p], { encoding: "utf8" }).stdout.trim();
    return { exe: "powershell.exe", windows: true, tmpRoot, toPs };
  }
  return null;
}

/** Intérprete de PowerShell disponible en esta máquina, o `null` si no hay ninguno (los tests se omiten). */
export const runner: Runner | null = detect();

/** Crea una carpeta temporal accesible por PowerShell y devuelve su ruta en el proceso de Node. */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(join(runner?.tmpRoot ?? tmpdir(), prefix));
}

/** Copia `scripts/install.ps1` a `dir` (una ruta UNC de WSL no se ejecuta bien) y devuelve su ruta para PowerShell. */
export function installScriptIn(dir: string): string {
  const copy = join(dir, "install.ps1");
  copyFileSync(join(process.cwd(), "scripts", "install.ps1"), copy);
  return runner?.toPs(copy) ?? copy;
}

/** Ejecuta `command` en PowerShell sin perfil y con la política de ejecución abierta solo para ese proceso. */
export function runPs(command: string): PsResult {
  if (runner === null) throw new Error("No hay PowerShell disponible");
  const result = spawnSync(runner.exe, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Convierte una ruta del proceso de Node a la que entiende PowerShell. */
export function toPs(path: string): string {
  return runner?.toPs(path) ?? path;
}
