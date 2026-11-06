import type { PostprocessRules } from "../orchestrator/issue-type-resolver.js";
import type { DocumentoFase1 } from "../../shared/types/documento-fase1.types.js";
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
 * 2. `siFalta`: todo campo que `presenteEnTicket` marca como ausente se sobrescribe con «No especificado en el ticket.»
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
  doc.presenteEnTicket = presente;

  for (const [field, question] of Object.entries(rules.siFalta)) {
    if (presente[field] !== false) continue;
    doc[field] = absentValue(field, doc[field]);
    if (!doc.preguntasAbiertas.includes(question)) doc.preguntasAbiertas.push(question);
  }
  return doc;
}
