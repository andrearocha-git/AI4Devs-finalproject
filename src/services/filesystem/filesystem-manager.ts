import { fileURLToPath } from "node:url";
import { isAbsolute, join, relative, sep } from "node:path";
import Handlebars from "handlebars";
import { errorCode, LocalFileStorage } from "../../database/local-file-storage.js";
import type { StepResult } from "../../shared/errors/result.types.js";
import type { DocumentoFase1, DocumentoFase1Fallback } from "../../shared/types/documento-fase1.types.js";
import type { TipoTicket } from "../../shared/types/ticket-context.types.js";

/** Configuración del {@link FileSystemManager}: de dónde cuelgan los tickets y cómo se llama la subcarpeta de evidencias. */
export interface FileSystemManagerConfig {
  /** Carpeta raíz de los tickets, fuera de cualquier repositorio Git (`ResolvedAppConfig.ticketsRootPath`). */
  ticketsRootPath: string;
  /** Nombre de la subcarpeta de evidencias de cada ticket y repositorio (`ResolvedAppConfig.adjuntosDirName`). */
  adjuntosDirName: string;
}

/** Datos del encabezado del documento; el que falte queda en blanco. */
export interface EncabezadoDocumento {
  ticketId?: string;
  titulo?: string;
  /** URL del ticket en Jira; sin ella el ID se escribe sin enlace. */
  jiraUrl?: string;
  /** Nombre de la desarrolladora (por ejemplo, el de su usuario de Jira). */
  desarrollador?: string;
  /** Fecha de generación ya formateada (`DD/MM/AAAA`). */
  fecha?: string;
  /** Clave del proyecto de Jira. */
  proyecto?: string;
}

/** Tipo de plantilla del documento; es el mismo `TipoTicket` que usan el resolvedor y Ollama. */
export type TipoDocumento = TipoTicket;

/** Motor de plantillas propio (no el global) con el helper `inc` para numerar desde 1. */
const handlebars = Handlebars.create();
handlebars.registerHelper("inc", (index: number) => index + 1);

/** Carpeta de las plantillas versionadas, relativa a este módulo (igual que `issue-types.json`). */
const TEMPLATES_DIR = fileURLToPath(new URL("../../../templates/documents/", import.meta.url));

/** Marcador que abre el bloque de Fase 1 del documento. */
const FASE1_INICIO = "<!-- DEVFLOW:FASE1:INICIO -->";
/** Marcador que cierra el bloque de Fase 1 del documento. */
const FASE1_FIN = "<!-- DEVFLOW:FASE1:FIN -->";

/** Códigos de error de Node que significan «el sistema no me deja escribir aquí». */
const PERMISSION_CODES = new Set(["EACCES", "EPERM", "EROFS"]);

/**
 * Gestor de archivos del ticket (ADR-004.1): crea las carpetas bajo la raíz de tickets, nunca dentro de un repositorio Git.
 *
 * No interactúa con Git. Delega todo acceso a disco en {@link LocalFileStorage}.
 */
export class FileSystemManager {
  /**
   * @param config Raíz de tickets y nombre de la subcarpeta de evidencias.
   * @param storage Acceso a disco; por defecto el real.
   */
  constructor(
    private readonly config: FileSystemManagerConfig,
    private readonly storage: LocalFileStorage = new LocalFileStorage(),
  ) {}

  /**
   * Crea `<raíz>/<ID>/<repositorio>/<adjuntos>/`; sin repositorio (clave sin repositorios) crea solo `<raíz>/<ID>/`. Es idempotente: no
   * borra ni modifica lo que ya haya.
   *
   * @param input.ticketId ID del ticket; se usa como nombre de carpeta, así que no puede contener separadores ni ser `.` o `..`. El
   *   `adjuntosDirName` de la configuración está sujeto a la misma regla.
   * @param input.repositoryName Nombre de la carpeta del repositorio, con las mismas reglas; omitido, no se crea subcarpeta de repositorio.
   * @returns `Ok({ folderPath, documentPath })`, con `documentPath` = `<folderPath>/<ID>.md` (el archivo no se crea aquí);
   *   `ErrorBloqueante('ErrorInesperado')` si un segmento (o el `adjuntosDirName`) no es válido (no se crea nada) o el disco falla por otro motivo;
   *   `ErrorBloqueante('PermisosInsuficientes')` si el sistema no permite crear una carpeta, con la ruta que falló y lo que se alcanzó a crear.
   */
  async createTicketWorkspace(input: {
    ticketId: string;
    repositoryName?: string;
  }): Promise<StepResult<{ folderPath: string; documentPath: string }>> {
    const { ticketId, repositoryName } = input;
    for (const segment of repositoryName === undefined ? [ticketId] : [ticketId, repositoryName]) {
      if (!isSafeSegment(segment)) return invalidSegment(segment);
    }
    if (repositoryName !== undefined && !isSafeSegment(this.config.adjuntosDirName)) return invalidSegment(this.config.adjuntosDirName);

    const ticketFolder = join(this.config.ticketsRootPath, ticketId);
    const folderPath = repositoryName === undefined ? ticketFolder : join(ticketFolder, repositoryName);
    const toCreate = repositoryName === undefined ? [ticketFolder] : [ticketFolder, folderPath, join(folderPath, this.config.adjuntosDirName)];

    const created: string[] = [];
    for (const path of toCreate) {
      try {
        await this.storage.ensureDir(path);
        created.push(path);
      } catch (error) {
        const reached = created.length === 0 ? "No se alcanzó a crear nada." : `Se alcanzó a crear: ${created.join(", ")}.`;
        if (PERMISSION_CODES.has(errorCode(error) ?? "")) {
          return { kind: "ErrorBloqueante", subtype: "PermisosInsuficientes", message: `Sin permisos para crear «${path}». ${reached}` };
        }
        return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `No se pudo crear «${path}». ${reached}` };
      }
    }
    return { kind: "Ok", value: { folderPath, documentPath: join(folderPath, `${ticketId}.md`) } };
  }

  /**
   * Escribe el documento Markdown del ticket: encabezado, Fase 1 entre `<!-- DEVFLOW:FASE1:INICIO -->` y `<!-- DEVFLOW:FASE1:FIN -->` y
   * la Fase 2 vacía de la plantilla del tipo (`templates/documents/`), que la IA no toca.
   *
   * Si el documento ya existe y `regenerateFase1Only` es `false`, no lo toca (nunca pisa lo que la desarrolladora completó) y devuelve `Ok`.
   * Con `regenerateFase1Only: true` reemplaza únicamente el texto entre los marcadores de Fase 1 y deja byte a byte igual el resto
   * (encabezado y Fase 2); si el documento aún no existe, lo crea completo.
   *
   * @param input.documentPath Ruta del documento (la que devuelve `createTicketWorkspace`); se crean las carpetas que falten. Debe colgar
   *   de la raíz de tickets: nunca se escribe fuera de ella.
   * @param input.tipo Plantilla a usar: `bug` o `historia`.
   * @param input.fase1 La Fase 1 estructurada, o `{ rawText }` del fallback: el bloque lleva `⚠️ Generado sin Ollama` y el texto crudo.
   * @param input.repo Nombre del repositorio, para el encabezado.
   * @param input.rama Rama de trabajo, para el encabezado.
   * @param input.encabezado Datos del encabezado; lo que falte queda en blanco.
   * @param input.regenerateFase1Only `true` para reprocesar solo la Fase 1 de un documento existente.
   * @returns `Ok({ documentPath })`; `ErrorBloqueante('PermisosInsuficientes')` si el sistema no deja escribir;
   *   `ErrorBloqueante('ErrorInesperado')` si `documentPath` queda fuera de la raíz de tickets, falta la plantilla, el disco falla por otro motivo o, al regenerar, el documento existente
   *   no tiene los marcadores de Fase 1 (en ese caso no se modifica).
   */
  async writeDocument(input: {
    documentPath: string;
    tipo: TipoDocumento;
    fase1: DocumentoFase1 | DocumentoFase1Fallback;
    repo?: string;
    rama?: string;
    encabezado?: EncabezadoDocumento;
    regenerateFase1Only: boolean;
  }): Promise<StepResult<{ documentPath: string }>> {
    const { documentPath } = input;
    if (!this.isUnderRoot(documentPath)) {
      return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `El documento «${documentPath}» queda fuera de la carpeta de tickets.` };
    }
    try {
      const exists = await this.storage.exists(documentPath);
      if (exists && !input.regenerateFase1Only) return { kind: "Ok", value: { documentPath } };
      const template = await this.storage.read(join(TEMPLATES_DIR, `${input.tipo}.md.hbs`));
      const document = handlebars.compile(template, { noEscape: true })({
        ...neutralizeMarkers(input.encabezado),
        repo: neutralizeMarkers(input.repo),
        rama: neutralizeMarkers(input.rama),
        ...neutralizeMarkers(input.fase1),
      });
      if (!exists) {
        await this.storage.write(documentPath, document);
        return { kind: "Ok", value: { documentPath } };
      }
      const current = await this.storage.read(documentPath);
      const replaced = replaceFase1Block(current, document);
      if (replaced === null) {
        return {
          kind: "ErrorBloqueante",
          subtype: "ErrorInesperado",
          message: `El documento «${documentPath}» no tiene los marcadores de Fase 1; no se modificó.`,
        };
      }
      await this.storage.write(documentPath, replaced);
      return { kind: "Ok", value: { documentPath } };
    } catch (error) {
      return diskFailure(error, documentPath);
    }
  }

  /**
   * Guarda la Fase 1 del ticket en `<raíz>/<ID>/.devflow/fase1.json` para reutilizarla al ejecutar el mismo ticket con otro repositorio.
   * Sobrescribe la anterior.
   *
   * @param ticketId ID del ticket (mismas reglas de nombre de carpeta que `createTicketWorkspace`).
   * @param fase1 Fase 1 a guardar.
   * @returns `Ok`; `ErrorBloqueante('PermisosInsuficientes')` o `ErrorBloqueante('ErrorInesperado')` (ID no válido o fallo de disco).
   */
  async saveFase1(ticketId: string, fase1: DocumentoFase1): Promise<StepResult<void>> {
    if (!isSafeSegment(ticketId)) return invalidSegment(ticketId);
    const path = this.fase1Path(ticketId);
    try {
      await this.storage.write(path, JSON.stringify(fase1, null, 2));
      return { kind: "Ok", value: undefined };
    } catch (error) {
      return diskFailure(error, path);
    }
  }

  /**
   * Lee la Fase 1 guardada del ticket.
   *
   * @param ticketId ID del ticket.
   * @returns `Ok(DocumentoFase1)`; `Ok(null)` si el ticket aún no tiene `fase1.json` (no crea nada);
   *   `ErrorBloqueante('ErrorInesperado')` si el ID no es válido, el JSON está corrupto o no tiene la forma de `DocumentoFase1`;
   *   `ErrorBloqueante('PermisosInsuficientes')` si el sistema no deja leerlo.
   *   Decidir si una Fase 1 con `generatedByOllama: false` se reutiliza le toca al Orquestador.
   */
  async readFase1(ticketId: string): Promise<StepResult<DocumentoFase1 | null>> {
    if (!isSafeSegment(ticketId)) return invalidSegment(ticketId);
    const path = this.fase1Path(ticketId);
    try {
      if (!(await this.storage.exists(path))) return { kind: "Ok", value: null };
      const parsed: unknown = JSON.parse(await this.storage.read(path));
      if (!isDocumentoFase1(parsed)) {
        return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `«${path}» no tiene la forma de una Fase 1 válida.` };
      }
      return { kind: "Ok", value: parsed };
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `«${path}» no es un JSON válido.` };
      }
      return diskFailure(error, path, "leer");
    }
  }

  /** `true` si la ruta cuelga de la raíz de tickets (no es la propia raíz, ni una hermana con el mismo prefijo, ni sale con `..`). */
  private isUnderRoot(path: string): boolean {
    const rel = relative(this.config.ticketsRootPath, path);
    return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
  }

  private fase1Path(ticketId: string): string {
    return join(this.config.ticketsRootPath, ticketId, ".devflow", "fase1.json");
  }
}

function invalidSegment(segment: string): StepResult<never> {
  return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `Nombre de carpeta no válido: «${segment}».` };
}

/**
 * Sustituye en `current` el texto entre los marcadores de Fase 1 por el que tiene `rendered` (el documento completo recién renderizado).
 * Devuelve `null` si alguno de los dos no tiene los marcadores en orden.
 */
function replaceFase1Block(current: string, rendered: string): string | null {
  const next = fase1Span(rendered);
  const old = fase1Span(current);
  if (next === null || old === null) return null;
  return current.slice(0, old.start) + rendered.slice(next.start, next.end) + current.slice(old.end);
}

/** Posición del texto entre los marcadores de Fase 1 (sin ellos), o `null` si falta alguno o están al revés. */
function fase1Span(document: string): { start: number; end: number } | null {
  const open = document.indexOf(FASE1_INICIO);
  const close = document.indexOf(FASE1_FIN);
  if (open === -1 || close === -1 || close < open) return null;
  return { start: open + FASE1_INICIO.length, end: close };
}

/**
 * Escapa, en todos los textos del valor, los marcadores de Fase 1 (`<!-- DEVFLOW:FASE1:INICIO -->` / `FIN`) para que los únicos que
 * haya en el documento sean los de la plantilla. Sin esto, un texto pegado de otro documento (por ejemplo en la descripción de Jira)
 * cortaría el bloque al regenerar. El marcador sigue siendo legible, solo deja de ser un comentario HTML.
 */
function neutralizeMarkers<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/<!--(\s*DEVFLOW:FASE1:(?:INICIO|FIN)\s*)-->/g, "&lt;!--$1--&gt;") as T;
  }
  if (Array.isArray(value)) return value.map((item) => neutralizeMarkers(item)) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, neutralizeMarkers(item)])) as T;
  }
  return value;
}

/** `true` si el valor tiene la forma mínima de un {@link DocumentoFase1}. */
function isDocumentoFase1(value: unknown): value is DocumentoFase1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.resumen === "string" &&
    Array.isArray(v.escenarios) &&
    Array.isArray(v.preguntasAbiertas) &&
    typeof v.generatedByOllama === "boolean" &&
    typeof v.promptVersion === "string"
  );
}

/** Traduce un error de disco al contrato: permisos → `PermisosInsuficientes`; cualquier otro → `ErrorInesperado`. */
function diskFailure(error: unknown, path: string, action: "leer" | "escribir" = "escribir"): StepResult<never> {
  if (PERMISSION_CODES.has(errorCode(error) ?? "")) {
    return { kind: "ErrorBloqueante", subtype: "PermisosInsuficientes", message: `Sin permisos para ${action} «${path}».` };
  }
  return { kind: "ErrorBloqueante", subtype: "ErrorInesperado", message: `No se pudo ${action} «${path}».` };
}

/** `true` si el texto sirve como nombre de una sola carpeta: no vacío, ni `.` ni `..`, sin separadores de ruta. */
function isSafeSegment(segment: string): boolean {
  return segment !== "" && segment !== "." && segment !== ".." && !/[\\/]/.test(segment);
}
