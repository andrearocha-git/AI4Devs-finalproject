import { readFileSync } from "node:fs";
import type { StepResult } from "../../shared/errors/result.types.js";

/** Tratamiento que recibe un tipo de issue que sí tiene plantilla. */
export interface IssueTypeResolution {
  tipo: "bug" | "historia";
  /** Tipo de rama; el Orquestador lo convierte en prefijo con `app_config`. */
  branchType: "feature" | "bugfix";
  /** Versión del prompt y schema del tipo (se registra en `ticket_logs.prompt_version`). */
  promptVersion: string;
}

interface IssueTypesTemplate {
  blockedTypes: string[];
  types: {
    bug: { names: string[]; branchType: "bugfix"; promptVersion: string };
    historia: { branchType: "feature"; promptVersion: string };
  };
}

const template = JSON.parse(
  readFileSync(new URL("../../../templates/issue-types.json", import.meta.url), "utf8"),
) as IssueTypesTemplate;

/** Minúsculas, sin acentos y sin espacios sobrantes: Jira devuelve `Epic` o `Épica` según el idioma del sitio. */
function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

const blocked = new Set(template.blockedTypes.map(normalize));
const bugNames = new Set(template.types.bug.names.map(normalize));

/**
 * Resuelve el tratamiento de un tipo de issue de Jira según `templates/issue-types.json`.
 *
 * @param issueType Nombre del tipo tal como lo devuelve Jira; se compara sin distinguir mayúsculas ni acentos.
 * @returns `Ok` con el tipo de plantilla (`bug` para Bug/Error/Defecto, `historia` para cualquier otro),
 * su `branchType` y `promptVersion`; o `ErrorBloqueante('TipoIssueBloqueado')` para épicas, que no tienen
 * plantilla (sin rama, carpeta ni documento).
 */
export function resolveIssueType(issueType: string): StepResult<IssueTypeResolution> {
  const name = normalize(issueType);
  if (blocked.has(name)) {
    return {
      kind: "ErrorBloqueante",
      subtype: "TipoIssueBloqueado",
      message: `Los tickets de tipo «${issueType.trim()}» no tienen plantilla: elige una historia, tarea o bug.`,
    };
  }
  const tipo = bugNames.has(name) ? "bug" : "historia";
  const { branchType, promptVersion } = template.types[tipo];
  return { kind: "Ok", value: { tipo, branchType, promptVersion } };
}
