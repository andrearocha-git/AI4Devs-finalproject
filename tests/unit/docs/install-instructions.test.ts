import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildProgram } from "../../../src/tui/cli.js";

// GH-18 — Instrucciones de instalación. Vigila que la sección 1.4 de `README.md` y de `docs/001` explique cómo instalar y arrancar,
// que lo que documenta exista de verdad y que el hueco H-05 de `docs/009` figure resuelto. Solo comprueba presencia y coherencia:
// la calidad de la redacción la revisa una persona.

const ROOT = process.cwd();
const INSTALL_DOCS = [
  { name: "README.md §1.4", file: "README.md" },
  { name: "docs/001 §1.4", file: "docs/001-descripcion-general-del-producto.md" },
] as const;

/**
 * Devuelve el texto de la sección que empieza en el encabezado indicado, hasta el siguiente encabezado de nivel 1 a 3.
 * Las líneas dentro de bloques de código (``` ... ```) no cuentan como encabezados: un `# comentario` de shell no corta la sección.
 */
function readSection(file: string, heading: RegExp): string {
  const lines = readFileSync(join(ROOT, file), "utf8").split("\n");
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return "";
  const section: string[] = [];
  let inCode = false;
  for (const line of lines.slice(start + 1)) {
    if (line.trimStart().startsWith("```")) inCode = !inCode;
    else if (!inCode && /^#{1,3}\s/.test(line)) break;
    section.push(line);
  }
  return section.join("\n");
}

const installSection = (file: string): string => readSection(file, /^### \*\*1\.4\. Instrucciones de instalación/);

describe.each(INSTALL_DOCS)("GH-18 · E1 — $name explica cómo instalar y arrancar", ({ file }) => {
  const section = installSection(file);

  it("está escrita: no es `[A definir]` ni conserva la instrucción del curso", () => {
    expect(section.trim()).not.toBe("");
    expect(section).not.toContain("[A definir]");
    expect(section).not.toContain("Documenta de manera precisa");
  });

  it("lista los requisitos previos: Node.js, Git, Ollama con qwen2.5:3b, y el email y el API Token de Jira", () => {
    for (const requisito of ["22.13", "Git", "Ollama", "qwen2.5:3b", "email", "API Token"]) {
      expect(section, `falta el requisito «${requisito}»`).toContain(requisito);
    }
  });

  it("explica los pasos de instalación: npm install, npm run build y npm link", () => {
    for (const paso of ["npm install", "npm run build", "npm link"]) {
      expect(section, `falta el paso «${paso}»`).toContain(paso);
    }
  });

  it("explica el primer arranque: devflow config, devflow config proyectos y devflow start", () => {
    for (const comando of ["devflow config", "devflow config proyectos", "devflow start"]) {
      expect(section, `falta el comando «${comando}»`).toContain(comando);
    }
  });

  it("avisa de que el API Token se guarda en claro en la base local", () => {
    expect(section).toMatch(/en claro/);
  });
});

// ---- E2: todo lo que se documenta existe ----

/** Scripts de `package.json` y nombres de `bin`. */
const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
  bin: Record<string, string>;
};

/** Los comandos del programa, como rutas de nombres (`config`, `config proyectos`, `start`), tomados del programa real. */
function registeredCommands(): Set<string> {
  const noop = vi.fn(async () => {});
  const program = buildProgram({ config: noop, configProyectos: noop, start: noop });
  const paths = new Set<string>();
  const walk = (parent: { commands: readonly { name(): string; commands: readonly unknown[] }[] }, prefix: string[]): void => {
    for (const command of parent.commands) {
      const path = [...prefix, command.name()];
      paths.add(path.join(" "));
      walk(command as Parameters<typeof walk>[0], path);
    }
  };
  walk(program, []);
  return paths;
}

/** Los `npm run <script>` que menciona un texto. */
const documentedScripts = (text: string): string[] => [...text.matchAll(/npm run ([\w:-]+)/g)].map((m) => m[1] ?? "");

/**
 * Los comandos `devflow ...` que menciona un texto, en código en línea (`devflow start [ID]`) o en bloques (`devflow --help`).
 * De cada mención se toman las palabras en minúsculas que siguen a `devflow` (`config proyectos`, `start`); las opciones y los
 * argumentos (`--help`, `[ID]`, `SCRUM-12`) cortan la lectura.
 */
function documentedCommands(text: string): string[] {
  const mentions = [...text.matchAll(/`devflow([^`]*)`/g), ...text.matchAll(/^devflow(.*)$/gm)].map((m) => m[1] ?? "");
  const commands: string[] = [];
  for (const mention of mentions) {
    const words: string[] = [];
    for (const token of mention.trim().split(/\s+/)) {
      if (!/^[a-z]+$/.test(token)) break;
      words.push(token);
    }
    if (words.length > 0) commands.push(words.join(" "));
  }
  return commands;
}

describe.each(INSTALL_DOCS)("GH-18 · E2 — en $name todo lo que se documenta existe", ({ file }) => {
  const section = installSection(file);

  it("cada `npm run <script>` existe en package.json (y se documenta al menos uno)", () => {
    const scripts = documentedScripts(section);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      expect(Object.keys(packageJson.scripts), `el script «${script}» no existe en package.json`).toContain(script);
    }
  });

  it("el comando se llama como el bin de package.json", () => {
    expect(Object.keys(packageJson.bin)).toContain("devflow");
  });

  it("cada comando `devflow ...` está registrado en el programa, y se documentan config, config proyectos y start", () => {
    const registered = registeredCommands();
    const commands = documentedCommands(section);
    for (const esperado of ["config", "config proyectos", "start"]) {
      expect(commands, `no se documenta «devflow ${esperado}»`).toContain(esperado);
    }
    for (const command of commands) {
      expect(registered, `«devflow ${command}» no es un comando del programa`).toContain(command);
    }
  });
});

// ---- E3: H-05 figura resuelto en docs/009 ----

describe("GH-18 · E3 — H-05 figura resuelto en docs/009", () => {
  const lines = readFileSync(join(ROOT, "docs/009-flujo-funcional.md"), "utf8").split("\n");

  it("la fila de H-05 está marcada como resuelta (como los demás huecos resueltos) y ya no dice «Parcial»", () => {
    const row = lines.find((line) => line.startsWith("| **H-05**")) ?? "";
    expect(row, "no se encontró la fila de H-05").not.toBe("");
    const estado = row.split("|").map((cell) => cell.trim()).filter((cell) => cell !== "").at(-1) ?? "";
    expect(estado).toContain("🟢 Resuelto");
    expect(estado).not.toContain("Parcial");
  });

  it("la nota de instalación del paso 1.1 remite a README y docs/001 §1.4 en lugar de decir que faltan las instrucciones", () => {
    const note = lines.find((line) => line.startsWith("> Procedimiento de instalación")) ?? "";
    expect(note, "no se encontró la nota de instalación del paso 1.1").not.toBe("");
    expect(note).toContain("README");
    expect(note).toContain("001");
    expect(note).toContain("§1.4");
    expect(note).not.toMatch(/faltan/);
  });
});
