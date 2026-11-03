import { describe, expect, it } from "vitest";
import type { StepResult } from "../../../src/shared/errors/result.types.js";

/** Función exhaustiva: si falta un `kind` o sobra uno, `tsc` falla (CA1, verificado por el compilador). */
function describeResult(result: StepResult<number>): string {
  switch (result.kind) {
    case "Ok":
      return `ok:${result.value}`;
    case "FallbackManual":
      return `manual:${result.reason}`;
    case "FallbackDeterminista":
      return `determinista:${result.rawText}`;
    case "ErrorBloqueante":
      return `bloqueante:${result.subtype}:${result.message}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

describe("E1 — StepResult discriminable por kind (TK-02a CA1)", () => {
  it.each<[StepResult<number>, string]>([
    [{ kind: "Ok", value: 7 }, "ok:7"],
    [{ kind: "FallbackManual", reason: "network_timeout" }, "manual:network_timeout"],
    [{ kind: "FallbackDeterminista", rawText: "texto crudo" }, "determinista:texto crudo"],
    [{ kind: "ErrorBloqueante", subtype: "CambiosPendientes", message: "a.ts" }, "bloqueante:CambiosPendientes:a.ts"],
  ])("estrecha %j por su kind", (result, expected) => {
    expect(describeResult(result)).toBe(expected);
  });
});
