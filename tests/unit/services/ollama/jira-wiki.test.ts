import { describe, expect, it } from "vitest";
import { stripJiraWiki } from "../../../../src/services/ollama/jira-wiki.js";

// GH-44 · E1 — el formato wiki de Jira se limpia antes de enviar la descripción a Ollama.

describe("GH-44 · E1 — stripJiraWiki quita las marcas del formato wiki de Jira", () => {
  it("quita la negrita y la cursiva sin tocar el texto", () => {
    expect(stripJiraWiki("*Como* nuevo usuario, _quiero_ entrar")).toBe("Como nuevo usuario, quiero entrar");
  });

  it("quita las marcas anidadas, como `*1. Registro (**_Happy Path_**)*`", () => {
    expect(stripJiraWiki("*1. Registro exitoso (**_Happy Path_**)*")).toBe("1. Registro exitoso (Happy Path)");
  });

  it("quita el prefijo de los encabezados (`h3.`, `h4.`)", () => {
    expect(stripJiraWiki("h3. *Criterios de Aceptación*\nh4. Caso uno")).toBe("Criterios de Aceptación\nCaso uno");
  });

  it("convierte las viñetas `*` y `#` en líneas con guion", () => {
    expect(stripJiraWiki("* *Dado* que estoy aquí\n** *Y* algo más\n# paso uno")).toBe("- Dado que estoy aquí\n- Y algo más\n- paso uno");
  });

  it("deja los enlaces solo con su texto", () => {
    expect(stripJiraWiki("Mira [la guía|https://ejemplo.com/guia]")).toBe("Mira la guía");
  });

  it("no toca los `{{marcadores}}` del ticket", () => {
    expect(stripJiraWiki("Usa {{descripcion}} tal cual")).toBe("Usa {{descripcion}} tal cual");
  });

  it("conserva los números, los textos entre comillas y los guiones bajos de los identificadores", () => {
    const text = 'Una contraseña de 8 caracteres, el mensaje "El correo ya está registrado", 2 * 3 y snake_case_nombre';
    expect(stripJiraWiki(text)).toBe(text);
  });

  it("deja igual un texto que no tiene formato wiki", () => {
    const text = "Como analista quiero exportar el informe.\n\nPara compartirlo.";
    expect(stripJiraWiki(text)).toBe(text);
  });
});
