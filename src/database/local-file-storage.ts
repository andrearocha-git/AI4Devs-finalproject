import * as fsPromises from "node:fs/promises";
import { dirname } from "node:path";

/** Operaciones de disco que usa {@link LocalFileStorage}; por defecto `node:fs/promises`. Los tests inyectan variantes que fallan. */
export type FileOps = Pick<typeof fsPromises, "mkdir" | "writeFile" | "readFile" | "access">;

/**
 * Acceso a disco sin conocimiento del dominio del ticket (Storage Layer): crea carpetas y lee o escribe archivos de texto.
 *
 * No captura errores: los de Node (`EACCES`, `ENOENT`…) se propagan con su `code` para que quien lo usa los clasifique.
 */
export class LocalFileStorage {
  /** @param ops Operaciones de disco; por defecto las reales de `node:fs/promises`. */
  constructor(private readonly ops: FileOps = fsPromises) {}

  /**
   * Crea la carpeta (y las que falten por encima). No falla si ya existe y no toca su contenido.
   *
   * @param path Ruta de la carpeta.
   * @throws El error de Node si el disco lo impide (permisos, disco lleno…).
   */
  async ensureDir(path: string): Promise<void> {
    await this.ops.mkdir(path, { recursive: true });
  }

  /**
   * Escribe un archivo de texto UTF-8, creando antes la carpeta que lo contiene. Sobrescribe si ya existe.
   *
   * @param path Ruta del archivo.
   * @param content Contenido a escribir.
   * @throws El error de Node si el disco lo impide.
   */
  async write(path: string, content: string): Promise<void> {
    await this.ensureDir(dirname(path));
    await this.ops.writeFile(path, content, "utf8");
  }

  /**
   * Lee un archivo de texto UTF-8.
   *
   * @param path Ruta del archivo.
   * @returns El contenido del archivo.
   * @throws El error de Node si no existe o no se puede leer (`code === 'ENOENT'` si no existe).
   */
  async read(path: string): Promise<string> {
    return this.ops.readFile(path, "utf8");
  }

  /**
   * Indica si existe un archivo o carpeta.
   *
   * @param path Ruta a comprobar.
   * @returns `true` si existe; `false` si no existe. Cualquier otro error (por ejemplo, permisos) se propaga.
   * @throws El error de Node distinto de `ENOENT`.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.ops.access(path);
      return true;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return false;
      throw error;
    }
  }
}

/** Código de error de Node (`EACCES`, `ENOENT`…) de un valor capturado, o `undefined` si no tiene. */
export function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}
