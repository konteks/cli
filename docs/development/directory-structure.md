# Directory Structure

Konteks uses a Laravel-inspired TypeScript layout under `src/app`.

- `actions`
  - One expressive action per user workflow, such as `recall-memory-action.ts`.
  - Actions coordinate repositories and services, then return typed results.
- `controllers`
  - Thin CLI and MCP entrypoints.
  - Controllers parse command/tool input, call actions or services, and format output.
- `models`
  - Core project and memory data shapes.
- `contracts`
  - Interfaces for repositories and services.
  - Contract names use expressive suffixes such as `MemoryRepositoryContract`.
- `repositories`
  - Concrete data access implementations that satisfy repository contracts.
- `database`
  - SQLite schema, migrations, adapters, query stores, and persistence helpers.
- `services`
  - Reusable application services for mining, MCP runtime behavior, AI embeddings,
    file-system context, terminal output, validation, and external library wrappers.
- `storage`
  - Local object and TOON payload storage helpers.
- `dto`
  - Typed request/response objects for CLI and application workflows.

Rules:

- Keep filenames kebab-case.
- Prefer expressive action, service, repository, and contract names.
- Keep controllers thin; do workflow orchestration in actions and reusable behavior in services.
- Preserve public CLI commands, MCP tool names, prompt names, and persisted database behavior during refactors.
