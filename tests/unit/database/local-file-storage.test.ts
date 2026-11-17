import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fsPromises from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { errorCode, LocalFileStorage, type FileOps } from "../../../src/database/local-file-storage.js";

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "devflow-storage-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("LocalFileStorage (revisión de /05: cobertura de las ramas de error)", () => {
  it("exists: true si el archivo existe y false si no existe", async () => {
    const root = tempRoot();
    writeFileSync(join(root, "hay.txt"), "x");
    const storage = new LocalFileStorage();

    expect(await storage.exists(join(root, "hay.txt"))).toBe(true);
    expect(await storage.exists(join(root, "no-hay.txt"))).toBe(false);
  });

  it.each(["EACCES", "EPERM"])("exists: un error distinto de ENOENT (%s) se propaga, no se confunde con «no existe»", async (code) => {
    const ops: FileOps = {
      ...fsPromises,
      access: (async () => {
        throw Object.assign(new Error(code), { code });
      }) as FileOps["access"],
    };

    await expect(new LocalFileStorage(ops).exists("/cualquier/ruta")).rejects.toMatchObject({ code });
  });

  it("exists: un error sin código también se propaga", async () => {
    const ops: FileOps = {
      ...fsPromises,
      access: (async () => {
        throw new Error("sin código");
      }) as FileOps["access"],
    };

    await expect(new LocalFileStorage(ops).exists("/cualquier/ruta")).rejects.toThrow("sin código");
  });

  it("write crea las carpetas que faltan y read devuelve lo escrito", async () => {
    const root = tempRoot();
    const storage = new LocalFileStorage();
    const path = join(root, "a", "b", "archivo.txt");

    await storage.write(path, "contenido ñ");

    expect(await storage.read(path)).toBe("contenido ñ");
  });

  it("errorCode: devuelve el código de un error de Node y undefined para cualquier otro valor", () => {
    expect(errorCode(Object.assign(new Error("x"), { code: "ENOENT" }))).toBe("ENOENT");
    expect(errorCode(new Error("sin código"))).toBeUndefined();
    expect(errorCode("texto")).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode({ code: 42 })).toBeUndefined();
  });
});
