# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repo is the AI4Devs (LIDR) final-project deliverable for **DevFlow CLI** — a planned CLI/TUI tool for Windows 10/11 that eliminates context-switching when a developer starts a Jira ticket: it queries Jira, creates a standardized Git branch, creates a local ticket folder outside the repo, and uses a local LLM (Ollama) to draft the first sections of a Markdown dev document.

**There is no application code yet.** The repo currently holds only product/architecture documentation. Do not assume a scaffold, package manager, or language exists until one is actually created (check for `finalproject-<INITIALS>/` or a `package.json` before trusting any command below).

## Two parallel, non-overlapping doc sets — don't confuse them

- **`readme.md` / `prompts.md`** (lowercase, repo root): the fixed-skeleton course deliverable template (Spanish, `>` blockquotes are the grader's instructions). `readme.md`'s index links to its own internal anchors (`#1-...`), not to files.
- **`README.md`** (uppercase, repo root) + **`docs/`**: the actual product documentation for DevFlow CLI. This is where real work happens:
  - `docs/PRD.md` — product spec (scope, non-goals, measurable success criteria).
  - `docs/ADR-001-arquitectura-inicial.md` — the architecture decision log (MADR-style). Contains §0 (evaluation of the 3-layer pattern) plus ADR-001.1 through ADR-005.1.
  - `docs/000-ficha-del-proyecto.md` … `docs/007-pull-requests.md` — one file per `readme.md` section (0 through 7), kept in sync with the PRD/ADR content. **File names have no accents** (`descripcion`, not `descripción`) — an explicit repo convention; don't reintroduce them when creating new files in this numbered series.
  - `docs/prompts-claude-fase-inicial.md` — verbatim log of the prompts used to build the docs above.

When a PRD/ADR decision changes something described in `docs/001-*.md` or `docs/002-*.md`, update those files too — they're meant to mirror the PRD/ADR, not drift from them.

## Architecture already decided (see ADR-001 for full rationale)

The tool follows a **3-layer pattern**: TUI Layer → Service Layer (an *orchestrator of independent steps*, not one monolithic method) → Storage Layer. Key decisions already locked in, all cross-referenced from `docs/002-arquitectura-del-sistema.md` §2.2:

- **CLI/TUI only** — no GUI, no web/Electron, no OAuth-with-browser flow anywhere (Jira auth is API Token/PAT). (ADR-001.1)
- **SQLite embedded** for config + ticket history (`app_config`, `projects_config`, `ticket_logs` — schema in `docs/003-modelo-de-datos.md`), not flat files. Only the Orchestrator writes `ticket_logs`; no other component touches SQLite directly. (ADR-002.1)
- **Ollama local LLM with deterministic fallback** — never OpenAI/Anthropic cloud APIs, for privacy and cost reasons. Ollama must return structured JSON validated against a schema before rendering to Markdown; anything that fails validation (including any code snippet) falls back to raw unstructured text, never blocking the flow. (ADR-003.1)
- **Evidence folders stay local, outside the project's Git repo entirely** — `/ticket-ID/adjuntos/` and the generated Markdown doc live under the developer's Windows user profile, never inside the tracked repository. (ADR-004.1)
- **Jira REST API is called directly** (HTTP + API Token) — no MCP Server (e.g. Atlassian Rovo MCP) intermediary, to avoid OAuth/browser flows and keep token/latency budget under the tool's own control. (ADR-005.1)
- **Git Manager's scope is deliberately minimal**: it only checks that the repo exists and the branch doesn't already exist, then creates the branch. It performs **no commit, no add, no push, no working-directory checks, no lock detection** — those are the developer's problem, by explicit product decision (not an oversight).
- **Result contract** used by every orchestrated step: `Ok | FallbackManual | FallbackDeterminista | ErrorBloqueante`.

## Conventions

- **Application code, when it exists, goes in a single top-level `finalproject-<INITIALS>` folder** — this user's initials are `ANR` (branch `feature/entrega-1-ANR`) → `finalproject-ANR/`.
- **Branches:** `feature/entrega-<N>-<INITIALS>`, one per course deliverable. PRs target `main`.
- Docs are Spanish; match that when editing them. Commit messages in this repo's history are mostly Spanish/informal.
- Mermaid diagrams in `docs/002-*.md` and `docs/003-*.md` are the source of truth for component/sequence/ER diagrams — update them alongside prose changes, don't let them drift.

## Build / test commands

None yet — no scaffold exists. When one is created, replace this section with the real install/dev/build/lint/test/single-test commands.
