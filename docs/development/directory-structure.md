# Directory Structure

Konteks uses a Laravel-inspired TypeScript layout under `src/app`.

- `actions`
  - One expressive action per user workflow, such as `recall-memory-action.ts`.
  - Actions coordinate repositories, feature modules, and support helpers, then return typed results.
- `controllers`
  - Thin CLI and MCP entrypoints.
  - Controllers parse command/tool input, call actions or feature modules, and format output.
- `models`
  - Core project and memory data shapes.
- `contracts`
  - Interfaces for repositories and services.
  - Contract names use expressive suffixes such as `MemoryRepositoryContract`.
- `repositories`
  - Concrete data access implementations that satisfy repository contracts.
- `providers`
  - Grouped local capability implementations. These are runtime capabilities used by
    actions, controllers, repositories, and tests, not only bootstrapping service
    providers.
  - `ai`: embedding providers and embedding pipeline behavior.
  - `database`: SQLite schema, migrations, adapters, query stores, and persistence
    helpers.
  - `file-system`: project context resolution and project status checks.
  - `mcp`: MCP runtime inputs, retrieval formatting, warm-up context, and related
    tests.
  - `mining`: project extraction orchestration, progress reporting, and mining
    engine internals.
  - `storage`: local object and TOON payload storage helpers.
- `support`
  - Generic wrappers and helpers for CLI libraries, JSON, formatting, terminal output,
    validation, prompts, version lookup, and external SDK re-exports.
- `dto`
  - Typed request/response objects for CLI and application workflows.

Rules:

- Keep filenames kebab-case.
- Prefer expressive action, service, repository, and contract names.
- Keep controllers thin; do workflow orchestration in actions and feature modules.
- Prefer direct imports over barrel files.
- Import provider capabilities directly from their grouped provider paths, such as
  `@/app/providers/database/sqlite/database`.
- Preserve public CLI commands, MCP tool names, prompt names, and persisted database behavior during refactors.
