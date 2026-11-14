import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// GH-17 · E1 — El build deja un paquete que el programa puede ejecutar. Compila `src/` a un directorio temporal con la misma
// configuración que `npm run build` y arma el diseño de una instalación (`dist/`, `templates/`, `package.json` y `node_modules`).

const ROOT = process.cwd();
const TSC = join(ROOT, "node_modules", "typescript", "lib", "tsc.js");
const BUILD_TIMEOUT_MS = 120_000;

let pkg = "";

beforeAll(() => {
  pkg = mkdtempSync(join(tmpdir(), "devflow-build-"));
  const dist = join(pkg, "dist");
  execFileSync(process.execPath, [TSC, "-p", "tsconfig.build.json", "--outDir", dist], { cwd: ROOT, stdio: "pipe" });
  execFileSync(process.execPath, [join(ROOT, "scripts", "copy-assets.mjs"), dist], { cwd: ROOT, stdio: "pipe" });
  cpSync(join(ROOT, "templates"), join(pkg, "templates"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(pkg, "package.json"));
  symlinkSync(join(ROOT, "node_modules"), join(pkg, "node_modules"), "junction");
}, BUILD_TIMEOUT_MS);

afterAll(() => {
  if (pkg !== "") rmSync(pkg, { recursive: true, force: true });
});

describe("GH-17 · E1 — el build deja un paquete que el programa puede ejecutar", () => {
  it("compila los .js y copia las migraciones SQL tal como están en src/database/migrations", () => {
    expect(existsSync(join(pkg, "dist", "tui", "cli.js"))).toBe(true);
    const copied = readdirSync(join(pkg, "dist", "database", "migrations")).sort();
    const source = readdirSync(join(ROOT, "src", "database", "migrations")).sort();
    expect(copied).toEqual(source);
    expect(copied.length).toBeGreaterThan(0);
  });

  it("el programa compilado arranca con --help y lista los comandos config y start", () => {
    const stdout = execFileSync(process.execPath, [join(pkg, "dist", "tui", "cli.js"), "--help"], { cwd: pkg, encoding: "utf8" });
    expect(stdout).toContain("config");
    expect(stdout).toContain("start");
  });

  it("el script `build` de package.json compila con tsconfig.build.json y copia los assets", () => {
    const { scripts } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(scripts.build).toContain("tsc -p tsconfig.build.json");
    expect(scripts.build).toContain("scripts/copy-assets.mjs");
  });
});

/** Lee `package.json` del repo y devuelve su entrada `bin`. */
const readBin = (): Record<string, string> =>
  (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { bin?: Record<string, string> }).bin ?? {};

/** Ejecuta el archivo indicado con Node y devuelve su salida estándar. */
const runNode = (file: string, ...args: string[]): string =>
  execFileSync(process.execPath, [file, ...args], { cwd: pkg, encoding: "utf8" });

describe("GH-17 · E2 — el comando instalado se llama devflow y arranca aunque se lance por un enlace simbólico", () => {
  it("package.json declara el bin `devflow` y apunta a un archivo que existe tras el build", () => {
    const bin = readBin();
    expect(Object.keys(bin)).toEqual(["devflow"]);
    expect(existsSync(join(pkg, bin.devflow ?? "no-existe"))).toBe(true);
  });

  // Windows crea los enlaces simbólicos solo con privilegios; allí `npm link` genera un .cmd que se comprueba a mano (issues #19 y #20).
  it.skipIf(process.platform === "win32")("lanzado por un enlace simbólico (como `npm link` en Linux y macOS) imprime la ayuda", () => {
    const linkDir = join(pkg, "link");
    mkdirSync(linkDir);
    const link = join(linkDir, "devflow");
    symlinkSync(join(pkg, readBin().devflow ?? "no-existe"), link);
    const stdout = runNode(link, "--help");
    expect(stdout).toContain("config");
    expect(stdout).toContain("start");
  });

  it("el comando que nombra el mensaje final de `devflow config` existe: el bin y el subcomando están registrados", () => {
    const source = readFileSync(join(ROOT, "src", "tui", "commands", "config.command.ts"), "utf8");
    const named = /Siguiente paso: (devflow [\w ]+?) para/.exec(source)?.[1];
    expect(named).toBeDefined();
    const [bin, command, subcommand] = (named ?? "").split(" ");
    expect(Object.keys(readBin())).toContain(bin);
    expect(runNode(join(pkg, "dist", "tui", "cli.js"), command ?? "", "--help")).toContain(subcommand ?? "");
  });
});
