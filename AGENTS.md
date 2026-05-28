# Agent Instructions

## Project Overview

Konteks is a local-first memory engine and MCP-enabled CLI for AI coding agents. It builds project-local memory artifacts under `.konteks/` and exposes warm-up, recall, save, search, and forget workflows through the CLI and MCP server.

## Tech Stack

- Runtime/package manager: Bun `>=1.3` with Node.js `>=22` support.
- Language: strict TypeScript, ESM modules, path alias `@/*` for `src/*`.
- Build/test tooling: `tsup`, Bun test, Biome, Knip, and `tsc --noEmit`.
- Formatting/linting: Biome enforces kebab-case filenames, single quotes, no semicolons unless required, organized imports, and no explicit `any`.

## Repository Layout

- `src/entrypoints/cli`: CLI command registration and command handlers.
- `src/entrypoints/mcp`: MCP server, prompts, handlers, and tools.
- `src/modules`: domain logic for memory, extraction, project state, and embeddings.
- `src/database`: schema, persistence services, actions, migrations, and database utilities.
- `src/support`: shared filesystem, CLI, output, formatting, TUI, and error-log utilities.
- `src/assets`: bundled prompts, grammar registry, and ignore-rule assets.
- `tests/features`: behavior-focused test coverage for CLI, MCP, memory, extraction, and project flows.
- `tests/support` and `tests/fake`: test helpers and fakes.

## Common Commands

```bash
bun run dev
bun run lint
bun run check
```

- `bun run dev` runs the CLI from `src/main.ts`.
- `bun run lint` runs Biome formatting/checks, Knip, and TypeScript.
- `bun run check` runs build, lint, and tests.

## Coding Guidelines

- Keep changes scoped to the relevant entrypoint, module, database, or support boundary.
- Prefer existing helpers and public APIs over new abstractions or direct database access.
- Preserve strict TypeScript behavior; do not introduce `any` or loosen compiler settings.
- Keep `.konteks/` local and ignored. Do not commit generated memory artifacts.
- Keep project error logging best-effort and non-blocking; logging failures must not mask original CLI or MCP errors.
- Preserve rebuild semantics: `konteks rebuild` rebuilds derived memory artifacts and must preserve durable memories and diary entries.
- Keep ignore matching fail-safe across ecosystems unless a deliberate product change says otherwise.
- Do not reintroduce file-size caps, per-file section caps, word chunking caps, or embedding/FTS retrieval truncation in core SQLite payload handling.
- Update docs when changing user-facing CLI behavior, MCP behavior, setup steps, storage behavior, or terminology.

## Testing Guidelines

- Put behavior tests under `tests/features` and reuse helpers from `tests/support`.
- Test through public input/output surfaces: CLI output, exports, manifests, MCP responses, or result objects.
- Avoid tests that import database internals or perform direct database operations.
- For isolated project-root tests, create temp fixtures with a `.git` marker when root resolution matters.
- For human CLI output, prefer `toContain` and `not.toContain` on visible fragments instead of exact-output parsing.
- Keep strict parsing for generated JSON files and protocol responses such as MCP JSON-RPC.
- Use fake providers from `tests/fake` when testing embeddings or extraction behavior without external dependencies.

## Konteks Workflow For Agents

- At the start of a fresh session, run `$konteks-warm-up`.
- During work, run `$konteks-recall <task>` only when needed to remembered modules, constraints, prior decisions, or historical context matter.
- At the end of meaningful work, run `$konteks-save` to persist durable memories and one compact session diary.
- Do not save raw transcripts, routine command logs, or low-value chronology.

## Safety

- Do not revert user changes unless explicitly requested.
- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless explicitly requested.
- Ask before broad edits to global agent configuration.
- If a command needs network access, package downloads, global config writes, or filesystem access outside the workspace, request approval with the exact command.
