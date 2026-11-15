import type { PostprocessRules } from "../orchestrator/issue-type-resolver.js";
import type { DocumentoFase1, EscenarioGherkin } from "../../shared/types/documento-fase1.types.js";
import { parseGherkinScenarios } from "./gherkin.js";
import { stripJiraWiki } from "./jira-wiki.js";
import type { ContextoTicket } from "../../shared/types/ticket-context.types.js";

/** Lo que devuelve el modelo, ya validado contra el schema: la Fase 1 sin los campos que agrega el transformer. */
export type ModelDocument = Omit<DocumentoFase1, "generatedByOllama" | "promptVersion">;

/** Texto con el que se sobrescribe un dato que el ticket no trae. */
export const NO_ESPECIFICADO = "No especificado en el ticket.";

/** Campos que son listas de objetos (no de textos): ausentes quedan vacíos, no con un elemento «No especificado». */
const OBJECT_LIST_FIELDS = new Set(["escenarios"]);

const NUMBER = /\d+(?:[.,]\d+)*/g;
const QUOTED = [
  /"([^"\n]+)"/g,
  /«([^»\n]+)»/g,
  /“([^”\n]+)”/g,
  // La comilla simple no cuenta como tal dentro de una palabra (d'Or, it's).
  /(?<![\p{L}\p{N}])'([^'\n]+)'(?![\p{L}\p{N}])/gu,
];

const normalizeNumber = (token: string): string => token.replace(",", ".");

/** Números y textos entre comillas que contiene un texto. */
function literalsOf(text: string): { numbers: string[]; quoted: string[] } {
  return {
    numbers: (text.match(NUMBER) ?? []).map(normalizeNumber),
    quoted: QUOTED.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => (m[1] ?? "").trim().toLowerCase())),
  };
}

/** Junta todos los textos de un valor (texto, lista u objeto) para revisarlos como uno solo. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("\n");
  if (value !== null && typeof value === "object") return Object.values(value).map(textOf).join("\n");
  return "";
}

/** «Como X, quiero Y, para Z» en una sola línea; el `para` termina en el primer punto o al final de la línea. */
const HISTORIA_USUARIO = /\bComo\s+(.+?),?\s+quiero\s+(.+?),?\s+para\s+(.+?)\s*(?:\.|$)/im;

type HistoriaUsuario = NonNullable<DocumentoFase1["historiaUsuario"]>;

/** La historia de usuario que el ticket dice de forma explícita (en la descripción sin wiki, o en el título), o `null` si no la trae. */
function findHistoriaUsuario(ticket: ContextoTicket): HistoriaUsuario | null {
  for (const text of [stripJiraWiki(ticket.description), ticket.title]) {
    const match = HISTORIA_USUARIO.exec(text);
    if (match) return { como: (match[1] ?? "").trim(), quiero: (match[2] ?? "").trim(), para: (match[3] ?? "").trim() };
  }
  return null;
}

/** Título sin tildes, signos ni número inicial, para comparar el de un escenario del modelo con el del ticket. */
const normalizeTitle = (title: string): string =>
  title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^\d+/, "");

const isBlank = (value: string): boolean => value.trim() === "";
const hasBlank = (e: EscenarioGherkin): boolean => isBlank(e.given) || isBlank(e.when) || isBlank(e.then);

/**
 * Completa con lo que el ticket dice (escenarios Dado / Cuando / Entonces) los `given`, `when` y `then` que el modelo dejó vacíos, y
 * descarta el escenario que sigue sin ninguno de los tres. `rescued` es `true` si completó algo desde el ticket. Empareja por título (uno contiene al otro) o, si no, por posición cuando el
 * modelo devolvió tantos escenarios como trae el ticket. No pisa lo que el modelo ya devolvió.
 */
function rescueEscenarios(escenarios: EscenarioGherkin[], ticket: ContextoTicket): { escenarios: EscenarioGherkin[]; rescued: boolean } {
  if (!escenarios.some(hasBlank)) return { escenarios, rescued: false };
  const fromTicket = parseGherkinScenarios(stripJiraWiki(ticket.description));
  const byPosition = fromTicket.length === escenarios.length;
  let rescued = false;
  const completed = escenarios
    .map((escenario, index) => {
      if (!hasBlank(escenario)) return escenario;
      const key = normalizeTitle(escenario.titulo);
      const match =
        fromTicket.find((candidate) => {
          const other = normalizeTitle(candidate.titulo);
          return key !== "" && other !== "" && (other.includes(key) || key.includes(other));
        }) ?? (byPosition ? fromTicket[index] : undefined);
      if (match === undefined) return escenario;
      rescued = true;
      return {
        titulo: escenario.titulo,
        given: isBlank(escenario.given) ? match.given : escenario.given,
        when: isBlank(escenario.when) ? match.when : escenario.when,
        then: isBlank(escenario.then) ? match.then : escenario.then,
      };
    })
    .filter((escenario) => !(isBlank(escenario.given) && isBlank(escenario.when) && isBlank(escenario.then)));
  return { escenarios: completed, rescued };
}

/** Valor de un campo ausente según su forma: texto, lista de textos, lista de objetos u objeto de textos. */
function absentValue(field: string, current: unknown): unknown {
  if (Array.isArray(current)) {
    const isObjectList = OBJECT_LIST_FIELDS.has(field) || current.some((item) => item !== null && typeof item === "object");
    return isObjectList ? [] : [NO_ESPECIFICADO];
  }
  if (current !== null && typeof current === "object") {
    return Object.fromEntries(Object.keys(current).map((key) => [key, NO_ESPECIFICADO]));
  }
  return NO_ESPECIFICADO;
}

/**
 * Posprocesado determinista de la Fase 1 que devolvió el modelo: lo que el LLM pudo inventar se corrige en código.
 *
 * 1. `verificarLiterales` (solo los campos de la regla, los bugs): un número o un texto entre comillas que no aparece en el
 *    título ni en la descripción del ticket hace descartar el **elemento** de la lista (paso, escenario completo) que lo contiene;
 *    en un campo de texto, o si se descartan todos los elementos, el campo pasa a ausente. Los números se comparan enteros
 *    («3» no está en «30», «2,5» es «2.5») y los textos sin distinguir mayúsculas.
 * 2. Rescate de la historia de usuario (GH-44): si el ticket trae «Como … quiero … para …», se completan con ese texto las partes que
 *    el modelo dejó vacías (no se pisa lo que ya devolvió) y la historia se marca presente, aunque el modelo la diera por ausente.
 *    Si el ticket no la trae, no se rescata nada: lo que el modelo haya inventado cae en `siFalta`.
 * 3. Rescate de los escenarios (GH-44): los `given`, `when` y `then` vacíos se completan con los Dado / Cuando / Entonces del ticket
 *    y el escenario que queda sin ninguno se descarta; si no queda ninguno, `escenarios` pasa a ausente, y si se completó alguno desde el
 *    ticket, `escenarios` se marca presente (aunque el modelo lo diera por ausente), como la historia.
 * 4. `siFalta`: todo campo que `presenteEnTicket` marca como ausente se sobrescribe con «No especificado en el ticket.»
 *    (una lista de objetos como los escenarios queda vacía) y se agrega su pregunta abierta, una sola vez.
 *
 * @param document Respuesta del modelo ya validada contra el schema; no se modifica.
 * @param ticket Ticket de origen: es la referencia de lo que sí está dicho.
 * @param rules Reglas del tipo (`postprocessRulesFor`).
 * @returns Una copia corregida, que sigue cumpliendo el schema del tipo.
 */
export function postprocess(document: ModelDocument, ticket: ContextoTicket, rules: PostprocessRules): ModelDocument {
  const doc = structuredClone(document) as ModelDocument & Record<string, unknown>;
  const ticketText = `${ticket.title}\n${ticket.description}`;
  const known = literalsOf(ticketText);
  const knownNumbers = new Set(known.numbers);
  const lowerTicket = ticketText.toLowerCase();
  const isInvented = (value: unknown): boolean => {
    const { numbers, quoted } = literalsOf(textOf(value));
    return numbers.some((n) => !knownNumbers.has(n)) || quoted.some((q) => !lowerTicket.includes(q));
  };

  const presente: Record<string, boolean> = { ...doc.presenteEnTicket };
  if (doc.escenarios.length > 0) {
    const { escenarios, rescued } = rescueEscenarios(doc.escenarios, ticket);
    doc.escenarios = escenarios;
    if (escenarios.length === 0) presente.escenarios = false;
    else if (rescued) presente.escenarios = true;
  }
  for (const field of rules.verificarLiterales ?? []) {
    const value = doc[field];
    if (Array.isArray(value) && value.length > 0) {
      const kept = value.filter((item) => !isInvented(item));
      if (kept.length === 0) presente[field] = false;
      else doc[field] = kept;
    } else if (typeof value === "string" && isInvented(value)) {
      presente[field] = false;
    }
  }
  const historia = doc.historiaUsuario;
  const found = "historiaUsuario" in rules.siFalta && historia !== undefined ? findHistoriaUsuario(ticket) : null;
  if (historia !== undefined && found !== null) {
    doc.historiaUsuario = {
      como: historia.como.trim() || found.como,
      quiero: historia.quiero.trim() || found.quiero,
      para: historia.para.trim() || found.para,
    };
    presente.historiaUsuario = true;
  }
  doc.presenteEnTicket = presente;

  for (const [field, question] of Object.entries(rules.siFalta)) {
    if (presente[field] !== false) continue;
    doc[field] = absentValue(field, doc[field]);
    if (!doc.preguntasAbiertas.includes(question)) doc.preguntasAbiertas.push(question);
  }
  return doc;
}
