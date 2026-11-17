import { describe, expect, it } from "vitest";
import { isValidTicketId } from "../../../src/tui/validators.js";

describe("TK-03b1 · E1 — isValidTicketId", () => {
  it.each(["SCRUM-12", "scrum-2", "A-1", "  SCRUM-12  ", "AB_C1-700"])("acepta «%s» (mismo criterio que el Orquestador)", (input) => {
    expect(isValidTicketId(input)).toBe(true);
  });

  it.each(["", "   ", "SCRUM", "12", "-5", "SCR UM-1", "SCRUM-", "SCRUM-1a", "1ABC-1", "SCRUM--1"])(
    "rechaza «%s»",
    (input) => {
      expect(isValidTicketId(input)).toBe(false);
    },
  );
});
