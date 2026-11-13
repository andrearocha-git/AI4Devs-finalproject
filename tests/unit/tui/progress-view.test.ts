import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createProgressView } from "../../../src/tui/views/progress-view.js";

const CLEAR = "\r\x1b[2K";

function setup(options: { isTTY?: boolean; env?: Record<string, string | undefined> } = {}) {
  const writes: string[] = [];
  const stream = { isTTY: options.isTTY ?? true, write: (text: string) => writes.push(text) };
  const view = createProgressView({ stream, env: options.env ?? {} });
  return { view, writes, text: () => writes.join("") };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TK-03b3 · E1 — vista de progreso con TTY", () => {
  it("al empezar un paso pinta de inmediato su primer cuadro y después uno nuevo cada ~100 ms en la misma línea", () => {
    const { view, writes } = setup();

    view.onStep("jira", "started");
    expect(writes).toHaveLength(1);
    expect(writes[0]).toBe(`${CLEAR}| Consultando Jira`);

    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);
    vi.advanceTimersByTime(100);

    expect(writes).toEqual([
      `${CLEAR}| Consultando Jira`,
      `${CLEAR}/ Consultando Jira`,
      `${CLEAR}- Consultando Jira`,
      `${CLEAR}\\ Consultando Jira`,
      `${CLEAR}| Consultando Jira`,
    ]);
    expect(writes.join("")).not.toContain("\n");
    view.stop();
  });

  it("al llegar ok fija la línea una sola vez con ✔, detiene la animación y el siguiente paso arranca en una línea nueva", () => {
    const { view, writes } = setup();

    view.onStep("jira", "started");
    view.onStep("jira", "ok");
    const afterOk = writes.length;
    vi.advanceTimersByTime(1000);

    expect(writes.at(-1)).toBe(`${CLEAR}✔ Consultando Jira\n`);
    expect(writes).toHaveLength(afterOk);
    expect(vi.getTimerCount()).toBe(0);

    view.onStep("git", "started");
    expect(writes.at(-1)).toMatch(/^\r\x1b\[2K\| /);
    view.stop();
  });

  it("fallback y error fijan la línea con ⚠ y ✖ y su detalle; el fallback de Jira avisa de la carga manual", () => {
    const { view, writes } = setup();

    view.onStep("jira", "started");
    view.onStep("jira", "fallback", "network_timeout");
    view.onStep("git", "started");
    view.onStep("git", "error", "El repositorio tiene cambios pendientes");
    view.onStep("ollama", "started");
    view.onStep("ollama", "fallback", "se conserva la Fase 1 anterior");

    const finals = writes.filter((w) => w.endsWith("\n"));
    expect(finals[0]).toBe(`${CLEAR}⚠ Consultando Jira — se cargará a mano\n`);
    expect(finals[1]).toContain("✖ Revisando el repositorio y preparando la rama — El repositorio tiene cambios pendientes");
    expect(finals[2]).toContain("⚠ Generando documento con Ollama (puede tardar ~1 min)... — se conserva la Fase 1 anterior");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("el paso de Ollama muestra el texto fijo de que puede tardar ~1 min", () => {
    const { view, text } = setup();

    view.onStep("ollama", "started");

    expect(text()).toContain("Generando documento con Ollama (puede tardar ~1 min)...");
    view.stop();
  });

  it("el temporizador no impide que el proceso termine (unref)", () => {
    const unref = vi.fn();
    vi.spyOn(globalThis, "setInterval").mockImplementation((() => ({ unref })) as never);
    vi.spyOn(globalThis, "clearInterval").mockImplementation((() => {}) as never);
    const { view } = setup();

    view.onStep("jira", "started");

    expect(unref).toHaveBeenCalledTimes(1);
    view.stop();
  });
});

describe("TK-03b3 · E1 — vista de progreso sin TTY", () => {
  it("una línea por evento, sin animación ni secuencias de escape", () => {
    const { view, writes, text } = setup({ isTTY: false });

    view.onStep("jira", "started");
    view.onStep("jira", "ok");
    view.onStep("git", "started");
    view.onStep("git", "error", "Cambios pendientes");
    vi.advanceTimersByTime(1000);

    expect(writes).toEqual([
      "Consultando Jira...\n",
      "✔ Consultando Jira\n",
      "Revisando el repositorio y preparando la rama...\n",
      "✖ Revisando el repositorio y preparando la rama — Cambios pendientes\n",
    ]);
    expect(text()).not.toMatch(/[\r\x1b]/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("con TERM=dumb tampoco anima aunque haya TTY", () => {
    const { view, text } = setup({ isTTY: true, env: { TERM: "dumb" } });

    view.onStep("jira", "started");
    vi.advanceTimersByTime(500);

    expect(text()).toBe("Consultando Jira...\n");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("TK-03b3 · E1 — pausa, descarte y parada", () => {
  it("pause borra la línea y detiene la animación; resume reanuda el paso en curso", () => {
    const { view, writes } = setup();

    view.onStep("git", "started");
    view.pause();
    const paused = writes.length;
    vi.advanceTimersByTime(1000);

    expect(writes.at(-1)).toBe(CLEAR);
    expect(writes).toHaveLength(paused);
    expect(vi.getTimerCount()).toBe(0);

    view.resume();
    expect(writes.at(-1)).toMatch(/^\r\x1b\[2K\S Revisando el repositorio y preparando la rama$/);
    vi.advanceTimersByTime(100);
    expect(writes.length).toBeGreaterThan(paused + 1);
    view.stop();
  });

  it("pause y resume sin paso en curso no escriben nada", () => {
    const { view, writes } = setup();

    view.pause();
    view.resume();

    expect(writes).toEqual([]);
  });

  it("si la confirmación se cancela, cancel borra la línea y descarta los eventos que quedan", () => {
    const { view, writes } = setup();
    view.onStep("jira", "started");
    view.onStep("jira", "ok");
    view.onStep("git", "started");
    view.pause();

    view.cancel();
    const before = writes.length;
    view.onStep("git", "ok", "inspección completada; ejecución cancelada");
    view.onStep("filesystem", "started");
    vi.advanceTimersByTime(1000);

    expect(writes).toHaveLength(before);
    expect(writes.join("")).toContain("✔ Consultando Jira");
    expect(writes.join("")).not.toContain("inspección completada");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stop borra el temporizador y la línea en curso aunque el flujo termine por un error, y es idempotente", () => {
    const { view, writes } = setup();
    view.onStep("filesystem", "started");

    view.stop();
    view.stop();

    expect(vi.getTimerCount()).toBe(0);
    expect(writes.at(-1)).toBe(CLEAR);
    expect(writes.filter((w) => w === CLEAR)).toHaveLength(1);
  });
});
