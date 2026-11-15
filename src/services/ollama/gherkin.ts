import type { EscenarioGherkin } from "../../shared/types/documento-fase1.types.js";

type Campo = "given" | "when" | "then";

const KEYWORDS: Record<string, Campo | "y"> = {
  dado: "given",
  given: "given",
  cuando: "when",
  when: "when",
  entonces: "then",
  then: "then",
  y: "y",
  and: "y",
  pero: "y",
  but: "y",
};
const LINE = /^(dado|given|cuando|when|entonces|then|y|and|pero|but)\b[:,]?\s+(.+)$/i;

/**
 * Extrae de un texto (la descripción del ticket ya sin formato wiki) los escenarios escritos como *Dado / Cuando / Entonces* o
 * *Given / When / Then*, uno por línea y con o sin viñeta. Un escenario empieza en su `Dado` y toma como título la última línea
 * anterior que no es una palabra clave (sin el número inicial, p. ej. «1. Registro exitoso»). `Y` / `And` / `Pero` / `But` continúan
 * el campo anterior, y el `que` que sigue a `Dado` se quita. Un `Cuando` o `Entonces` sin `Dado` previo se ignora.
 *
 * @param text Texto del ticket sin marcas wiki.
 * @returns Los escenarios encontrados, en orden; `[]` si el texto no trae ninguno.
 */
export function parseGherkinScenarios(text: string): EscenarioGherkin[] {
  const scenarios: EscenarioGherkin[] = [];
  let title = "";
  let current: EscenarioGherkin | undefined;
  let last: Campo | undefined;
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/^-\s+/, "");
    if (line === "") continue;
    const match = LINE.exec(line);
    const keyword = KEYWORDS[(match?.[1] ?? "").toLowerCase()];
    if (match === null || keyword === undefined) {
      title = line;
      continue;
    }
    const body = (match[2] ?? "").trim();
    if (keyword === "given") {
      current = { titulo: title.replace(/^\d+[.)]\s*/, ""), given: body.replace(/^que\s+/i, ""), when: "", then: "" };
      scenarios.push(current);
      last = "given";
    } else if (current !== undefined && keyword === "y") {
      if (last !== undefined) current[last] = `${current[last]} y ${body}`;
    } else if (current !== undefined && keyword !== "y") {
      current[keyword] = body;
      last = keyword;
    }
  }
  return scenarios;
}
