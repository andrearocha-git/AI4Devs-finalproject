import { describe, expect, it } from "vitest";
import { describeFailure } from "../../../src/tui/failure-message.js";

describe("describeFailure", () => {
  it("token inválido: habla de credenciales, no de que algo no exista", () => {
    const message = describeFailure({ kind: "FallbackManual", reason: "invalid_token" });

    expect(message).toContain("API Token");
    expect(message).not.toContain("no existe");
  });

  it("Jira sin respuesta: sugiere revisar la conexión y la URL", () => {
    expect(describeFailure({ kind: "FallbackManual", reason: "network_timeout" })).toContain("no respondió");
  });

  it("no encontrado: usa el texto del llamador o uno genérico", () => {
    expect(describeFailure({ kind: "FallbackManual", reason: "not_found" }, "La clave ABC no existe en Jira.")).toBe(
      "La clave ABC no existe en Jira.",
    );
    expect(describeFailure({ kind: "FallbackManual", reason: "not_found" })).toContain("Jira");
  });

  it("ErrorBloqueante: muestra su mensaje tal cual", () => {
    expect(describeFailure({ kind: "ErrorBloqueante", subtype: "RepositorioNoEncontrado", message: "no es un repo" })).toBe("no es un repo");
  });

  it("FallbackDeterminista: mensaje genérico (no debería ocurrir en la configuración)", () => {
    expect(describeFailure({ kind: "FallbackDeterminista", rawText: "x" })).toContain("inesperada");
  });
});
