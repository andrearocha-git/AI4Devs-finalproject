const LETTER_OR_DIGIT = "\\p{L}\\p{N}";
/** Un `_` de cursiva: pegado al principio de una palabra o al final; el de `snake_case` (palabra a ambos lados) no cuenta. */
const ITALIC_MARK = new RegExp(
  `(?<![${LETTER_OR_DIGIT}_])_(?=[${LETTER_OR_DIGIT}])|(?<=[${LETTER_OR_DIGIT}.,;:!?)"])_(?![${LETTER_OR_DIGIT}_])`,
  "gu",
);

/** Quita los `*` de negrita (y de viñeta anidada) salvo los que están rodeados de espacios, como la multiplicación de `2 * 3`. */
function stripBold(line: string): string {
  return line.replace(/\*+/g, (run, offset: number, whole: string) => {
    const before = whole[offset - 1];
    const after = whole[offset + run.length];
    const spaceBefore = before === undefined || /\s/.test(before);
    const spaceAfter = after === undefined || /\s/.test(after);
    return spaceBefore && spaceAfter ? run : "";
  });
}

/**
 * Limpia de forma determinista el formato wiki que la API v2 de Jira devuelve en las descripciones, para que el modelo lea texto
 * limpio: quita `*negrita*`, `_cursiva_`, el prefijo `hN.` de los encabezados y los enlaces `[texto|url]`
 * (queda el texto), y convierte las viñetas (`*`, `**`, `#`) en líneas que empiezan con `- `.
 *
 * Lo que no es wiki (números, textos entre comillas, `snake_case`, `2 * 3`) queda igual, porque el posprocesado compara esos
 * literales con el ticket. Tablas, `{code}`, `{panel}` y `{{monoespaciado}}` no se tocan (este último, para no reexpandir
 * marcadores del ticket). No modifica el original: devuelve una copia.
 *
 * @param text Descripción tal como llega de Jira (o escrita a mano).
 * @returns El mismo texto sin las marcas wiki; un texto sin wiki vuelve idéntico.
 */
export function stripJiraWiki(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const withoutBlockMarks = line.replace(/^[ \t]*[*#]+[ \t]+/, "- ").replace(/^h[1-6]\.[ \t]+/, "");
      return stripBold(withoutBlockMarks)
        .replace(/\[([^\]|\n]+)\|[^\]\n]+\]/g, "$1")
        .replace(ITALIC_MARK, "");
    })
    .join("\n");
}
