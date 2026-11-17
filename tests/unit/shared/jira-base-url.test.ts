import { describe, expect, it } from "vitest";
import { defaultTicketsRoot } from "../../../src/shared/config/app-config.provider.js";
import { normalizeJiraBaseUrl } from "../../../src/shared/config/jira-base-url.js";

describe("normalizeJiraBaseUrl", () => {
  it.each([
    ["https://equipo.atlassian.net", "https://equipo.atlassian.net"],
    ["  https://equipo.atlassian.net/  ", "https://equipo.atlassian.net"],
    ["HTTPS://Equipo.Atlassian.NET", "https://equipo.atlassian.net"],
    ["https://equipo.atlassian.net/jira/your-work", "https://equipo.atlassian.net"],
    ["http://localhost:8080", "http://localhost:8080"],
  ])("«%s» → %s (solo el origin)", (input, expected) => {
    expect(normalizeJiraBaseUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "equipo.atlassian.net",
    "ftp://equipo.atlassian.net",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "https://usuario:clave@equipo.atlassian.net",
    "https://equipo.atlassian.net?x=1",
    "https://equipo.atlassian.net/#fragmento",
  ])("rechaza «%s»", (input) => {
    expect(normalizeJiraBaseUrl(input)).toBeNull();
  });
});

describe("defaultTicketsRoot", () => {
  it("cuelga de USERPROFILE: <perfil>\\DevFlowCLI\\tickets", () => {
    expect(defaultTicketsRoot({ USERPROFILE: "C:\\Users\\andrea" })).toBe("C:\\Users\\andrea\\DevFlowCLI\\tickets");
  });

  it.each([{}, { USERPROFILE: "  " }])("devuelve undefined sin USERPROFILE (%j)", (env) => {
    expect(defaultTicketsRoot(env)).toBeUndefined();
  });
});
