import { readFileSync } from "node:fs";
import { Ajv } from "ajv";
import type { StepResult } from "../../shared/errors/result.types.js";
import type { DocumentoFase1 } from "../../shared/types/documento-fase1.types.js";
import type { ContextoTicket, TipoTicket } from "../../shared/types/ticket-context.types.js";
import { postprocessRulesFor, promptVersionFor } from "../orchestrator/issue-type-resolver.js";
import { postprocess, type ModelDocument } from "./postprocess.js";

/** Configuración del transformer; llega entera por constructor (no lee `AppConfig` ni el entorno). */
export interface OllamaTransformerOptions {
  /** URL base de Ollama (`ollama_host`, p. ej. `http://localhost:11434`). */
  host: string;
  /** Modelo (`ollama_model`); el mínimo viable es `qwen2.5:3b`. */
  model: string;
  /** Tiempo máximo total de la petición, incluido el streaming (`ollama_timeout_seconds`, 120 por defecto en la app). */
  timeoutSeconds: number;
  /** Cuánto mantiene Ollama el modelo en memoria tras responder; corto para liberar la RAM. Por defecto `30s`. */
  keepAlive?: string;
  /** `fetch` inyectable; por defecto el global. */
  fetch?: typeof fetch;
}

const PROMPTS_DIR = new URL("../../../templates/prompts/", import.meta.url);
const read = (name: string): string => readFileSync(new URL(name, PROMPTS_DIR), "utf8");

const ajv = new Ajv({ strict: true });

interface TypePrompts {
  system: string;
  schema: object;
  validate: (data: unknown) => boolean;
}

const promptsCache = new Map<TipoTicket, TypePrompts>();

/** Carga (una vez) el prompt de sistema, el schema y el validador compilado de un tipo. */
function promptsFor(tipo: TipoTicket): TypePrompts {
  let prompts = promptsCache.get(tipo);
  if (!prompts) {
    const schema = JSON.parse(read(`${tipo}.schema.json`)) as object;
    prompts = {
      system: `${read("comun.system.md").trim()}\n\n${read(`${tipo}.system.md`).trim()}`,
      schema,
      validate: ajv.compile(schema),
    };
    promptsCache.set(tipo, prompts);
  }
  return prompts;
}

/** Rellena `ticket.user.md` en una sola pasada, para que un `{{...}}` dentro del texto del ticket no se vuelva a expandir. */
function userPrompt(ctx: ContextoTicket): string {
  const values: Record<string, string> = {
    ticketId: ctx.ticketId,
    title: ctx.title,
    description: ctx.description.trim() === "" ? "(sin descripción)" : ctx.description,
  };
  return read("ticket.user.md")
    .trim()
    .replace(/\{\{(ticketId|title|description)\}\}/g, (_match, key: string) => values[key] ?? "");
}

/** Texto crudo del ticket (título y descripción) que se usa cuando Ollama no puede redactar la Fase 1. */
function rawTextOf(ctx: ContextoTicket): string {
  const description = ctx.description.trim();
  return description === "" ? ctx.title : `${ctx.title}\n\n${ctx.description}`;
}

/** `true` si algún texto del documento (a cualquier profundidad) contiene un bloque de código delimitado con triple acento grave. */
function containsCodeBlock(value: unknown): boolean {
  if (typeof value === "string") return value.includes("```");
  if (Array.isArray(value)) return value.some(containsCodeBlock);
  if (value !== null && typeof value === "object") return Object.values(value).some(containsCodeBlock);
  return false;
}

/**
 * Transforma el texto de un ticket en la Fase 1 estructurada del documento, usando un modelo local de Ollama (ADR-003.1).
 */
export class OllamaAITransformer {
  private readonly fetchImpl: typeof fetch;

  /** @param options Host, modelo, timeout y `keep_alive`; ver {@link OllamaTransformerOptions}. */
  constructor(private readonly options: OllamaTransformerOptions) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  /**
   * Pide a Ollama que redacte la Fase 1 del ticket y valida la respuesta contra el JSON Schema del tipo.
   *
   * @param ctx Ticket (de Jira o cargado a mano).
   * @param tipo `bug` o `historia`: elige el prompt, el schema y la `promptVersion`.
   * @param onToken Se invoca durante el streaming con el total acumulado de caracteres recibidos.
   * @returns `Ok` con el `DocumentoFase1` ya posprocesado (`siFalta` y, en bugs, `verificarLiterales`; ver `postprocess.ts`), con
   * `generatedByOllama: true` y la `promptVersion` del tipo. Cualquier otra cosa devuelve
   * `FallbackDeterminista` con el título y la descripción originales, y nunca lanza: Ollama apagado o sin el modelo, error HTTP o
   * de streaming, timeout total, JSON ilegible o que no cumple el schema, o un bloque de código (triple acento grave) en cualquier texto.
   */
  async processContext(
    ctx: ContextoTicket,
    tipo: TipoTicket,
    onToken?: (chars: number) => void,
  ): Promise<StepResult<DocumentoFase1>> {
    const fallback: StepResult<DocumentoFase1> = { kind: "FallbackDeterminista", rawText: rawTextOf(ctx) };
    try {
      const prompts = promptsFor(tipo);
      const document: unknown = JSON.parse(await this.generate(prompts, userPrompt(ctx), onToken));
      if (!prompts.validate(document) || containsCodeBlock(document)) return fallback;
      const corrected = postprocess(document as ModelDocument, ctx, postprocessRulesFor(tipo));
      return { kind: "Ok", value: { ...corrected, generatedByOllama: true, promptVersion: promptVersionFor(tipo) } };
    } catch {
      return fallback;
    }
  }

  /**
   * Llama a `/api/generate` en streaming y devuelve el texto completo que produjo el modelo.
   *
   * @throws Si Ollama no responde, responde con un error HTTP o de streaming, o vence el timeout total (que también corta la lectura).
   */
  private async generate(prompts: TypePrompts, prompt: string, onToken?: (chars: number) => void): Promise<string> {
    const response = await this.fetchImpl(`${this.options.host.replace(/\/+$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.options.model,
        system: prompts.system,
        prompt,
        stream: true,
        format: prompts.schema,
        keep_alive: this.options.keepAlive ?? "30s",
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(this.options.timeoutSeconds * 1000),
    });
    if (!response.ok || response.body === null) throw new Error(`Ollama respondió HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (line !== "") {
            const parsed = JSON.parse(line) as { response?: string; error?: string };
            if (parsed.error !== undefined) throw new Error(parsed.error);
            const piece = parsed.response ?? "";
            output += piece;
            if (piece !== "") onToken?.(output.length);
          }
          newline = buffer.indexOf("\n");
        }
      }
    } finally {
      // Libera la conexión si salimos antes de tiempo (error de streaming o timeout); si ya terminó, no hace nada.
      await reader.cancel().catch(() => {});
    }
    return output;
  }
}
