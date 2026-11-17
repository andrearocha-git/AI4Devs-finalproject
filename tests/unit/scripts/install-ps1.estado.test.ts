import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { installScriptIn, makeTempDir, runner, runPs, toPs } from "./ps-helper.js";

// GH-55 · E2 — El estado del clon decide si instalar, no hacer nada, actualizar o detenerse. Cada caso arma un `origin` local
// y un clon con Git real; el instalador completo solo se ejecuta en los casos que no necesitan `npm` (al día y detenerse).

type Situacion = "lockModificado" | "alDia" | "conNovedades" | "cambiosLocales" | "soloSinSeguimiento" | "divergido" | "localAdelantado" | "sinCompilar";

let dir = "";
let script = "";
let contador = 0;

beforeAll(() => {
  if (runner === null) return;
  dir = makeTempDir("devflow-install-e2-");
  script = installScriptIn(dir);
});

afterAll(() => {
  if (dir !== "") rmSync(dir, { recursive: true, force: true });
});

interface Escenario {
  origin: string;
  clon: string;
}

/** Crea un `origin` con un commit, lo clona y deja el clon en la situación pedida (con un `dist/` de mentira, salvo en `sinCompilar`). */
function armar(situacion: Situacion): Escenario {
  contador += 1;
  const base = join(dir, `caso-${contador}`);
  const origin = toPs(join(base, "origin.git"));
  const trabajo = toPs(join(base, "trabajo"));
  const clon = toPs(join(base, "clon"));
  const g = "git -c user.name=prueba -c user.email=prueba@example.com";
  const commitEnTrabajo = `Set-Content -Path '${trabajo}\\nuevo.txt' -Value 'x'; ${g} -C '${trabajo}' add . ; ${g} -C '${trabajo}' commit -q -m novedad; git -C '${trabajo}' push -q origin main`;
  const commitEnClon = `Set-Content -Path '${clon}\\local.txt' -Value 'x'; ${g} -C '${clon}' add . ; ${g} -C '${clon}' commit -q -m local`;
  const extra: Record<Situacion, string> = {
    alDia: "",
    lockModificado: `Add-Content -Path '${clon}\\package-lock.json' -Value 'ruido de npm'`,
    conNovedades: commitEnTrabajo,
    cambiosLocales: `Add-Content -Path '${clon}\\base.txt' -Value 'cambio'`,
    soloSinSeguimiento: `Set-Content -Path '${clon}\\sin-seguimiento.txt' -Value 'x'`,
    divergido: `${commitEnTrabajo}; ${commitEnClon}`,
    localAdelantado: commitEnClon,
    sinCompilar: "",
  };
  // `dist/` no está en Git, así que el stub no cuenta como cambio local; el instalador lo usa para saber si el clon se compiló.
  const conDist = situacion === "sinCompilar" ? "" : `New-Item -ItemType Directory -Force -Path '${clon}\\dist\\tui' | Out-Null; Set-Content -Path '${clon}\\dist\\tui\\cli.js' -Value 'x'`;
  const out = runPs(
    [
      `$ErrorActionPreference = 'Continue'`,
      `git init -q --bare '${origin}'`,
      `git -C '${origin}' symbolic-ref HEAD refs/heads/main`,
      `git init -q -b main '${trabajo}'`,
      `Set-Content -Path '${trabajo}\\base.txt' -Value 'base'`,
      `Set-Content -Path '${trabajo}\\package-lock.json' -Value '{}'`,
      `${g} -C '${trabajo}' add .`,
      `${g} -C '${trabajo}' commit -q -m base`,
      `git -C '${trabajo}' remote add origin '${origin}'`,
      `git -C '${trabajo}' push -q origin main`,
      `git clone -q '${origin}' '${clon}'`,
      extra[situacion],
      conDist,
      "exit 0",
    ].join("; "),
  );
  expect(out.status, out.stderr).toBe(0);
  return { origin, clon };
}

function estadoDe(carpeta: string): string {
  const out = runPs(`. '${script}'; Get-EstadoInstalacion -Carpeta '${carpeta}'`);
  expect(out.status, out.stderr).toBe(0);
  return out.stdout.trim();
}

function instalador(e: Escenario): { status: number | null; stdout: string } {
  const out = runPs(`& '${script}' -Carpeta '${e.clon}' -Repositorio '${e.origin}' -Rama main; exit $LASTEXITCODE`);
  return { status: out.status, stdout: out.stdout };
}

function cabeza(clon: string): string {
  return runPs(`git -C '${clon}' rev-parse HEAD`).stdout.trim();
}

describe.skipIf(runner === null)("GH-55 · E2 — el estado del clon decide qué hace el instalador", { timeout: 60_000 }, () => {
  it("(a) sin carpeta, o con una carpeta vacía, decide instalar", () => {
    expect(estadoDe(toPs(join(dir, "no-existe")))).toBe("NoInstalado");
    const vacia = makeTempDir("devflow-vacia-");
    try {
      expect(estadoDe(toPs(vacia))).toBe("NoInstalado");
    } finally {
      rmSync(vacia, { recursive: true, force: true });
    }
  });

  it("(b) un clon al día no cambia nada, aunque tenga commits locales sin publicar o archivos sin seguimiento", () => {
    for (const situacion of ["alDia", "localAdelantado", "soloSinSeguimiento"] as const) {
      const e = armar(situacion);
      expect(estadoDe(e.clon), situacion).toBe("AlDia");
    }
    const e = armar("alDia");
    const antes = cabeza(e.clon);
    const out = instalador(e);
    expect(out.status).toBe(0);
    expect(cabeza(e.clon)).toBe(antes);
  });

  it("(c) un clon con commits nuevos en origin y sin cambios locales decide actualizar", () => {
    expect(estadoDe(armar("conNovedades").clon)).toBe("ConNovedades");
  });

  it("(d) con cambios locales sin guardar se detiene, lo explica y deja el clon intacto", () => {
    const e = armar("cambiosLocales");
    expect(estadoDe(e.clon)).toBe("CambiosLocales");
    const antes = cabeza(e.clon);
    const out = instalador(e);
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain("locales");
    expect(cabeza(e.clon)).toBe(antes);
    expect(readFileSync(join(dir, `caso-${contador}`, "clon", "base.txt"), "utf8")).toContain("cambio");
  });

  it("(e) con la rama local divergida de origin se detiene, lo explica y deja la historia intacta", () => {
    const e = armar("divergido");
    expect(estadoDe(e.clon)).toBe("Divergido");
    const antes = cabeza(e.clon);
    const out = instalador(e);
    expect(out.status).not.toBe(0);
    expect(out.stdout).toContain("diverg");
    expect(cabeza(e.clon)).toBe(antes);
  });
});

describe.skipIf(runner === null)("GH-55 · E2 — tras npm install el clon no queda sucio por el package-lock.json", { timeout: 60_000 }, () => {
  const restaurar = (clon: string): void => {
    const out = runPs(`. '${script}'; Restore-LockfileTrasNpm -Carpeta '${clon}'`);
    expect(out.status, out.stderr).toBe(0);
  };

  it("restaura el package-lock.json que npm reescribió y el clon vuelve a estar al día", () => {
    const e = armar("lockModificado");
    expect(estadoDe(e.clon)).toBe("CambiosLocales");
    restaurar(e.clon);
    expect(estadoDe(e.clon)).toBe("AlDia");
  });

  it("no toca otros cambios locales", () => {
    const e = armar("lockModificado");
    runPs(`Add-Content -Path '${e.clon}\\base.txt' -Value 'cambio'`);
    restaurar(e.clon);
    expect(estadoDe(e.clon)).toBe("CambiosLocales");
    expect(readFileSync(join(dir, `caso-${contador}`, "clon", "base.txt"), "utf8")).toContain("cambio");
  });

  it("si el repositorio no tiene package-lock.json no falla", () => {
    const e = armar("alDia");
    const g = "git -c user.name=prueba -c user.email=prueba@example.com";
    runPs(`${g} -C '${e.clon}' rm -q package-lock.json; ${g} -C '${e.clon}' commit -q -m sinlock`);
    restaurar(e.clon);
  });
});

describe.skipIf(runner === null)("GH-55 · E2 — un clon al día pero sin compilar se completa en vez de darse por bueno", { timeout: 60_000 }, () => {
  it("limpio, al día y sin dist/ (una compilación o un npm link que fallaron) decide compilar y enlazar", () => {
    expect(estadoDe(armar("sinCompilar").clon)).toBe("SinCompilar");
  });

  it("Clear-Dist borra dist/ y el clon pasa a SinCompilar, para que una actualización fallida se reintente", () => {
    const e = armar("alDia");
    expect(estadoDe(e.clon)).toBe("AlDia");
    const out = runPs(`. '${script}'; Clear-Dist -Carpeta '${e.clon}'`);
    expect(out.status, out.stderr).toBe(0);
    expect(estadoDe(e.clon)).toBe("SinCompilar");
  });
});
