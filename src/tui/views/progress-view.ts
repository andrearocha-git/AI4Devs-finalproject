import type { StepName, StepStatus } from "../../shared/types/ticket-run.types.js";

/** Flujo de salida que usa la vista; `process.stdout` lo cumple. */
export interface ProgressStream {
  /** `true` si la salida es una terminal interactiva. */
  isTTY?: boolean;
  write(text: string): unknown;
}

/** Opciones de {@link createProgressView}. */
export interface ProgressViewOptions {
  stream: ProgressStream;
  /** Variables de entorno (por defecto `process.env`); con `TERM=dumb` no se anima aunque haya TTY. */
  env?: Record<string, string | undefined>;
  /** Milisegundos entre cuadros de la animación (por defecto 100). */
  intervalMs?: number;
}

/** Progreso de `devflow start` paso a paso. */
export interface ProgressView {
  /**
   * Recibe un evento de `startTicket`: `started` empieza a mostrar el paso y `ok`, `fallback` o `error` fijan su línea final.
   * No hace nada si la vista se descartó con {@link ProgressView.cancel}.
   */
  onStep(step: StepName, status: StepStatus, detail?: string): void;
  /** Detiene la animación y borra su línea para no pisar un prompt; no hace nada sin paso en curso o sin TTY. */
  pause(): void;
  /** Reanuda la animación del paso en curso tras un {@link ProgressView.pause}. */
  resume(): void;
  /** Borra la línea en curso y descarta todos los eventos siguientes (la persona canceló y no se crea nada). */
  cancel(): void;
  /** Detiene el temporizador y borra la línea en curso. Es idempotente; hay que llamarlo siempre al terminar, también ante un error. */
  stop(): void;
}

const LABELS: Record<StepName, string> = {
  jira: "Consultando Jira",
  git: "Revisando el repositorio y preparando la rama",
  filesystem: "Creando la carpeta y el documento",
  ollama: "Generando documento con Ollama (puede tardar ~1 min)...",
};
const MARKS = { ok: "✔", fallback: "⚠", error: "✖" } as const;
/** Marcos ASCII: se ven bien en cualquier consola de Windows. */
const FRAMES = ["|", "/", "-", "\\"];
/** Vuelve al inicio de la línea y la borra. */
const CLEAR_LINE = "\r\x1b[2K";

/**
 * Crea la vista de progreso: un spinner de una línea por paso, sin dependencias.
 *
 * Con TTY anima el paso en curso en la misma línea (el temporizador no impide que el proceso termine) y fija una línea
 * por paso al terminar. Sin TTY, o con `TERM=dumb`, escribe una línea por evento sin animación ni secuencias de escape.
 * El paso de Ollama muestra un texto fijo: no hay progreso del *streaming*.
 *
 * @param options Flujo de salida, entorno e intervalo.
 * @returns La vista; hay que llamar a `stop()` al terminar.
 */
export function createProgressView(options: ProgressViewOptions): ProgressView {
  const { stream, env = process.env, intervalMs = 100 } = options;
  const animated = stream.isTTY === true && env.TERM !== "dumb";
  let timer: ReturnType<typeof setInterval> | undefined;
  let current: StepName | undefined;
  let frame = 0;
  let paused = false;
  let discarded = false;

  const stopTimer = (): void => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };
  const draw = (): void => {
    if (current === undefined) return;
    stream.write(`${CLEAR_LINE}${FRAMES[frame % FRAMES.length]} ${LABELS[current]}`);
    frame += 1;
  };
  const animate = (): void => {
    frame = 0;
    draw();
    timer = setInterval(draw, intervalMs);
    timer.unref();
  };
  const clearCurrentLine = (): void => {
    if (animated && current !== undefined && !paused) stream.write(CLEAR_LINE);
  };

  return {
    onStep(step, status, detail) {
      if (discarded) return;
      if (status === "started") {
        current = step;
        paused = false;
        if (animated) animate();
        else stream.write(`${LABELS[step]}${LABELS[step].endsWith("...") ? "" : "..."}\n`);
        return;
      }
      stopTimer();
      const note = step === "jira" && status === "fallback" ? "se cargará a mano" : detail;
      const line = `${MARKS[status]} ${LABELS[step]}${note ? ` — ${note}` : ""}\n`;
      stream.write(animated ? `${CLEAR_LINE}${line}` : line);
      current = undefined;
      paused = false;
    },
    pause() {
      if (!animated || current === undefined || paused) return;
      stopTimer();
      stream.write(CLEAR_LINE);
      paused = true;
    },
    resume() {
      if (!animated || current === undefined || !paused) return;
      paused = false;
      animate();
    },
    cancel() {
      stopTimer();
      clearCurrentLine();
      discarded = true;
      current = undefined;
    },
    stop() {
      stopTimer();
      clearCurrentLine();
      current = undefined;
    },
  };
}
