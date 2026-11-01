# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repo is the AI4Devs (LIDR) final-project deliverable for **DevFlow CLI** — a planned CLI/TUI tool for Windows 10/11 that eliminates context-switching when a developer starts a Jira ticket: it queries Jira, creates a standardized Git branch, creates a local ticket folder outside the repo, and uses a local LLM (Ollama) to draft the first sections of a Markdown dev document.

**There is no application code yet.** The repo currently holds only product/architecture documentation. Do not assume a scaffold, package manager, or language exists until one is actually created (check for a `package.json` at the repo root before trusting any command below).

## Documentation layout

`README.md` (repo root, single canonical file — the old lowercase `readme.md` was merged into it and deleted, since having both on a case-insensitive filesystem like Windows risks a checkout collision) carries the course's fixed-skeleton deliverable structure (sections 0-7, Spanish, `>` blockquotes are the grader's instructions where still unanswered) as its body, with a short product tagline up top. Heavy sections (2, 3, 5, 6) are kept short in `README.md` and link out to `docs/` instead of duplicating content, to avoid the two drifting apart:

- `docs/PRD.md` — product spec (scope, non-goals, measurable success criteria).
- `docs/ADR-001-arquitectura-inicial.md` — the architecture decision log (MADR-style). Contains §0 (evaluation of the 3-layer pattern) plus ADR-001.1 through ADR-005.1 and ADR-007.1 (Git Manager scope change); the stack decision is ADR-006.1 in `docs/008-evaluacion-stack-tecnologico.md` (Accepted).
- `docs/001-descripcion-general-del-producto.md` … `docs/007-pull-requests.md` (plus `docs/008-evaluacion-stack-tecnologico.md`) — one file per `README.md` section (1 through 7), kept in sync with the PRD/ADR content. **File names have no accents** (`descripcion`, not `descripción`) — an explicit repo convention; don't reintroduce them when creating new files in this numbered series. Section 0 (Ficha del proyecto) has no separate `docs/000-*.md` file — its content lives only in `README.md` §0, since it was short enough not to need a dedicated file.
- `docs/009-flujo-funcional.md` — living document of the end-to-end functional flow (install → ticket → Git/folders → Ollama → Fase 2 + `ticket_logs`), with a per-step status (`Especificado` / `En desarrollo` / `Implementado`) and the open gaps H-01…H-06 cross-referenced to US/TK. Not tied to a `README.md` section (deliberately not linked from it). Update it whenever a step is implemented or a gap is resolved, and keep it in sync with `docs/002-*.md` and `docs/005-*.md`/`docs/006-*.md`.
- `prompts.md` — executive summary of the prompts used, one per course section, mirroring `README.md`'s own section anchors (`#1-...`) in its index — not links to `docs/` files.
- `docs/prompts-claude-fase-inicial.md` — verbatim log of the prompts used to build the docs above.

When a PRD/ADR decision changes something described in `docs/001-*.md` or `docs/002-*.md`, update those files too, **and** the corresponding short summary in `README.md` — they're meant to mirror each other, not drift.

## Architecture already decided (see ADR-001 for full rationale)

The tool follows a **3-layer pattern**: TUI Layer → Service Layer (an *orchestrator of independent steps*, not one monolithic method) → Storage Layer. Key decisions already locked in, all cross-referenced from `docs/002-arquitectura-del-sistema.md` §2.2:

- **CLI/TUI only** — no GUI, no web/Electron, no OAuth-with-browser flow anywhere (Jira auth is API Token/PAT). (ADR-001.1)
- **SQLite embedded** (`node:sqlite`) for config + ticket history (`app_config`, `jira_projects`, `repositories`, `ticket_logs` — schema in `docs/003-modelo-de-datos.md`), not flat files. Only the Orchestrator writes `ticket_logs`; no other component touches SQLite directly. (ADR-002.1)
- **Ollama local LLM with deterministic fallback** — never OpenAI/Anthropic cloud APIs, for privacy and cost reasons. Ollama must return structured JSON (the type's JSON Schema passed in `format`, validated with Ajv) before rendering to Markdown; anything that fails validation (including any code snippet) falls back to raw unstructured text, never blocking the flow. (ADR-003.1)
- **Evidence folders stay local, outside the project's Git repo entirely** — `<tickets_root>/ID/<repo>/adjuntos/` and the generated Markdown doc live under the developer's Windows user profile, never inside the tracked repository. (ADR-004.1)
- **Jira REST API is called directly** (Jira Cloud API v2, Basic email + API Token) — no MCP Server (e.g. Atlassian Rovo MCP) intermediary, to avoid OAuth/browser flows and keep token/latency budget under the tool's own control. (ADR-005.1)
- **Git Manager's scope (changed decision — see ADR-007.1):** it verifies the repo exists, runs `git status --porcelain` and stops listing the files if there are pending changes, informs and continues if the branch already exists, updates the base branch (`git pull --ff-only origin <base>` if on it, otherwise `git fetch origin <base>:<base>`), then creates the branch with `git switch -c <branch> <base>`. A failed pull is a blocking error (never branch from a stale base). It **never commits, adds or pushes**. Base branch is per repository (default `main`), with a one-off `--base` override. (The original minimal scope — only repo/branch existence checks, no status, no pull — is superseded.)
- **Result contract** used by every orchestrated step: `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.

## Reglas de implementación

Restricciones técnicas ya decididas (ADR-006.1 aceptado, ADR-003.1, ADR-007.1) que toda sesión de código debe respetar:

- Stack: Node.js ≥ 22.13 + TypeScript `strict`; `node:sqlite` (sin compilación nativa); Commander + `@inquirer/prompts` + un spinner simple; Handlebars; Ajv; Vitest + msw. **Sin Ink** (compite con inquirer por stdin) y **sin Zod**: el JSON Schema es la fuente de verdad.
- Jira Cloud API **v2** (descripción en texto plano), auth Basic email + token. Ante un 404 en `/issue` o `/project`, llamar a `/myself`: 401 = token inválido, 200 = no existe. Validar las claves de proyecto con `GET /rest/api/2/project/{key}` al darlas de alta (la JQL ignora claves inexistentes sin error).
- **Un repositorio por ejecución**; un documento (y su `adjuntos/`) por ticket y repositorio; la Fase 1 de Ollama se genera una vez por ticket y se reutiliza (`ollama_status = 'reused'`). Clave sin repositorios: solo documento, sin rama.
- Ramas: `<prefijo>/<ID>-<SUFIJO>` (`features/` o `bugs/` según el tipo de issue). Épica/Epic: bloqueada con aviso (sin rama ni documento). Bug/Error/Defecto → plantilla `bug`; el resto → plantilla `historia`.
- Git Manager: la secuencia de ADR-007.1; nunca commit, add ni push.
- Ollama: modelo mínimo `qwen2.5:3b` (el 1.5b está descartado), `ollama_timeout_seconds` = 120, streaming y `keep_alive` corto. El primer campo del schema es `presenteEnTicket`, seguido del posprocesado determinista (`siFalta`, `verificarLiterales`).
- Prompts, schemas y plantillas son archivos versionados en `./templates/` (no configuración del usuario); registrar `prompt_version` en `ticket_logs`.
- `ticket_logs`: una fila por `(ticket_id, repository_id)` con *upsert*; `UNIQUE` no deduplica `repository_id = NULL`, ese caso se trata aparte.
- Solo el Orquestador escribe `ticket_logs`; solo `SQLiteStorageManager` importa `node:sqlite`; la TUI solo habla con el Orquestador.

## Conventions

- **Application code, when it exists, goes at the repo root** (`src/`, `tests/`, `package.json`), alongside `docs/` — there is no separate `finalproject-<INITIALS>/` folder. Lint, typecheck and `.gitignore` must exclude `docs/` and `.claude/`.
- **Branches:** `feature/entrega-<N>-<INITIALS>`, one per course deliverable. PRs target `main`.
- Docs are Spanish; match that when editing them. Commit messages in this repo's history are mostly Spanish/informal.
- Mermaid diagrams in `docs/002-*.md` and `docs/003-*.md` are the source of truth for component/sequence/ER diagrams — update them alongside prose changes, don't let them drift.

## Build / test commands

None yet — no scaffold exists. When one is created, replace this section with the real install/dev/build/lint/test/single-test commands.
