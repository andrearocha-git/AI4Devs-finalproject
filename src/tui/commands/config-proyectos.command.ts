import type { TicketOrchestrator } from "../../services/orchestrator/ticket-orchestrator.js";
import type { StepResult } from "../../shared/errors/result.types.js";
import type { Repository } from "../../shared/types/config.types.js";
import { describeFailure } from "../failure-message.js";
import type { ProjectPrompts } from "../prompts/project-config.prompt.js";
import { required } from "../validators.js";

/** Lo que `devflow config proyectos` necesita del Orquestador. */
export type ProjectsOrchestrator = Pick<
  TicketOrchestrator,
  | "listProjects"
  | "addProject"
  | "removeProject"
  | "listRepositories"
  | "addRepository"
  | "updateRepository"
  | "removeRepository"
>;

/** Dependencias de {@link runConfigProyectos}, inyectables para probarlo sin terminal. */
export interface ProjectsDeps {
  orchestrator: ProjectsOrchestrator;
  prompts: ProjectPrompts;
  /** Escribe una línea de salida (en la CLI, `console.log`). */
  out: (line: string) => void;
}

type Action = "list" | "addProject" | "addRepo" | "editRepo" | "removeRepo" | "removeProject" | "exit";

/** Datos de un repositorio mientras el usuario los escribe; se conservan si hay que corregirlos. */
interface RepositoryDraft {
  name: string;
  repoLocalPath: string;
  defaultBaseBranch: string;
}

const NO_PROJECTS = "No hay claves de proyecto. Usa «Agregar clave de proyecto» para empezar.";

/**
 * `devflow config proyectos`: menú interactivo para listar, agregar, editar y quitar claves de proyecto y repositorios.
 *
 * El menú se repite hasta elegir «Salir». Todo pasa por el Orquestador: el alta de una clave se valida contra Jira y la
 * de un repositorio contra Git, y los fallos se explican sin tecnicismos (un token inválido nunca se presenta como una
 * clave inexistente). Quitar algo pide confirmación; si el Orquestador se niega por el historial, se muestra su mensaje
 * y el menú continúa. Los errores inesperados (y Ctrl+C) no se capturan aquí: los resuelve el programa.
 *
 * @param deps Orquestador, prompts y salida.
 */
export async function runConfigProyectos(deps: ProjectsDeps): Promise<void> {
  for (;;) {
    const action = await deps.prompts.select<Action>("¿Qué quieres hacer?", [
      { name: "Listar claves y repositorios", value: "list" },
      { name: "Agregar clave de proyecto", value: "addProject" },
      { name: "Agregar repositorio", value: "addRepo" },
      { name: "Editar repositorio", value: "editRepo" },
      { name: "Quitar repositorio", value: "removeRepo" },
      { name: "Quitar clave de proyecto", value: "removeProject" },
      { name: "Salir", value: "exit" },
    ]);
    if (action === "exit") return;
    if (action === "list") listAll(deps);
    else if (action === "addProject") await addProject(deps);
    else if (action === "addRepo") await addRepository(deps);
    else if (action === "editRepo") await editRepository(deps);
    else if (action === "removeRepo") await removeRepository(deps);
    else await removeProject(deps);
  }
}

function listAll({ orchestrator, out }: ProjectsDeps): void {
  const projects = orchestrator.listProjects();
  if (projects.length === 0) return out(NO_PROJECTS);
  for (const project of projects) {
    out(`${project.jiraProjectKey} — ${project.jiraProjectName}`);
    const repos = orchestrator.listRepositories(project.jiraProjectKey);
    if (repos.kind !== "Ok") out(`  ${describeFailure(repos)}`);
    else if (repos.value.length === 0) out("  (sin repositorios)");
    else for (const repo of repos.value) out(`  • ${repo.name} → ${repo.repoLocalPath} (base: ${repo.defaultBaseBranch})`);
  }
}

async function addProject({ orchestrator, prompts, out }: ProjectsDeps): Promise<void> {
  const typed = await prompts.input("Clave del proyecto de Jira (p. ej. SCRUM)", { validate: required("La clave") });
  const result = await orchestrator.addProject(typed.trim());
  if (result.kind === "Ok") out(`Clave ${result.value.jiraProjectKey} (${result.value.jiraProjectName}) lista para usarse.`);
  else out(describeFailure(result, `La clave ${typed.trim().toUpperCase()} no existe en Jira.`));
}

/** Pide elegir una clave de entre las dadas de alta; `null` (con aviso) si no hay ninguna. */
async function pickProject({ orchestrator, prompts, out }: ProjectsDeps): Promise<string | null> {
  const projects = orchestrator.listProjects();
  if (projects.length === 0) {
    out(NO_PROJECTS);
    return null;
  }
  return prompts.select(
    "¿En qué clave de proyecto?",
    projects.map((p) => ({ name: `${p.jiraProjectKey} — ${p.jiraProjectName}`, value: p.jiraProjectKey })),
  );
}

/** Pide elegir un repositorio de la clave; `null` (con aviso) si no se puede listar o no tiene ninguno. */
async function pickRepository(deps: ProjectsDeps, key: string): Promise<Repository | null> {
  const repos = deps.orchestrator.listRepositories(key);
  if (repos.kind !== "Ok") {
    deps.out(describeFailure(repos));
    return null;
  }
  if (repos.value.length === 0) {
    deps.out(`${key} está sin repositorios.`);
    return null;
  }
  return deps.prompts.select(
    "¿Qué repositorio?",
    repos.value.map((r) => ({ name: `${r.name} → ${r.repoLocalPath} (base: ${r.defaultBaseBranch})`, value: r })),
  );
}

async function askRepository(prompts: ProjectPrompts, draft: RepositoryDraft, editName: boolean): Promise<RepositoryDraft> {
  const withDefault = (value: string) => (value === "" ? {} : { default: value });
  const name = editName
    ? (await prompts.input("Nombre del repositorio (p. ej. backend)", { ...withDefault(draft.name), validate: required("El nombre") })).trim()
    : draft.name;
  const repoLocalPath = (
    await prompts.input("Ruta local del repositorio", { ...withDefault(draft.repoLocalPath), validate: required("La ruta") })
  ).trim();
  const defaultBaseBranch = (
    await prompts.input("Rama base", { ...withDefault(draft.defaultBaseBranch), validate: required("La rama base") })
  ).trim();
  return { name, repoLocalPath, defaultBaseBranch };
}

/**
 * Pide los datos de un repositorio y los guarda; si el Orquestador los rechaza, muestra el motivo y pregunta si corregir,
 * repitiendo los prompts con lo ya escrito como valor por defecto.
 */
async function collectAndSave(
  deps: ProjectsDeps,
  initial: RepositoryDraft,
  editName: boolean,
  save: (draft: RepositoryDraft) => Promise<StepResult<Repository>>,
  done: (draft: RepositoryDraft) => string,
): Promise<void> {
  let draft = initial;
  for (;;) {
    draft = await askRepository(deps.prompts, draft, editName);
    const result = await save(draft);
    if (result.kind === "Ok") return deps.out(done(draft));
    deps.out(describeFailure(result));
    if (!(await deps.prompts.confirm("¿Quieres corregir los datos?", true))) return;
  }
}

async function addRepository(deps: ProjectsDeps): Promise<void> {
  const key = await pickProject(deps);
  if (key === null) return;
  await collectAndSave(
    deps,
    { name: "", repoLocalPath: "", defaultBaseBranch: "main" },
    true,
    (draft) => deps.orchestrator.addRepository({ jiraProjectKey: key, ...draft }),
    (draft) => `Repositorio ${draft.name} agregado a ${key}.`,
  );
}

async function editRepository(deps: ProjectsDeps): Promise<void> {
  const key = await pickProject(deps);
  if (key === null) return;
  const repo = await pickRepository(deps, key);
  if (repo === null) return;
  await collectAndSave(
    deps,
    { name: repo.name, repoLocalPath: repo.repoLocalPath, defaultBaseBranch: repo.defaultBaseBranch },
    false,
    (draft) => deps.orchestrator.updateRepository({ jiraProjectKey: key, ...draft }),
    (draft) => `Repositorio ${draft.name} actualizado.`,
  );
}

/** Ejecuta un borrado; si el Orquestador se niega (historial), muestra su mensaje claro y no lanza. */
function tryRemove(out: (line: string) => void, remove: () => void, done: string): void {
  try {
    remove();
    out(done);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    out(error.message);
  }
}

async function removeRepository(deps: ProjectsDeps): Promise<void> {
  const key = await pickProject(deps);
  if (key === null) return;
  const repo = await pickRepository(deps, key);
  if (repo === null) return;
  if (!(await deps.prompts.confirm(`¿Quitar el repositorio ${repo.name} de ${key}?`))) return deps.out("No se quitó nada.");
  tryRemove(deps.out, () => deps.orchestrator.removeRepository(repo.id), `Repositorio ${repo.name} quitado de ${key}.`);
}

async function removeProject(deps: ProjectsDeps): Promise<void> {
  const key = await pickProject(deps);
  if (key === null) return;
  if (!(await deps.prompts.confirm(`¿Quitar la clave ${key} y todos sus repositorios?`))) return deps.out("No se quitó nada.");
  tryRemove(deps.out, () => deps.orchestrator.removeProject(key), `Clave ${key} quitada.`);
}
