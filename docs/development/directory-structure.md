# Directory Structure

```text
src
├── main.ts             # Commander CLI entrypoint and command registration.
├── assets/             # Packaged prompt templates and other static runtime assets.
├── composition/        # Skill installation and memory transfer composition.
├── contracts/          # Service and persistence boundaries that need substitution.
│   ├── repositories/   # Repository interfaces consumed by workflows.
│   └── services/       # Service interfaces, such as extraction and embedding contracts.
├── controllers/        # Thin CLI command handlers and MCP server registration.
├── extraction/         # Extraction workflow orchestration and runtime wiring.
├── middlewares/        # Cross-command guards such as CLI project initialization.
├── memory/             # Memory feature workflows: recall, search, save, forget, warm-up, runtime wiring.
├── mcp/                # MCP tool, prompt, handler, and dry-run orchestration.
├── models/             # Core project, CLI, and memory data shapes.
├── project/            # Project lifecycle workflows: init, status, repair, grammar selection.
├── providers/          # Local runtime capabilities.
│   ├── cli/            # CLI-specific input/output helpers.
│   ├── embeddings/     # Embedding providers and embedding pipeline behavior.
│   ├── extraction/     # Project extraction orchestration and engine internals.
│   ├── persistence/    # SQLite, query stores, migrations, and object payload storage.
│   ├── project/        # Project context resolution helpers.
│   └── protocol/       # MCP schemas, tool surface, and response formatting.
└── support/            # Project-owned generic utilities and test support.
    ├── fake/           # Test doubles shared across provider/controller tests.
    ├── format/         # Number and token formatting/estimation helpers.
    ├── json/           # JSON parse/stringify helpers.
    ├── object/         # Generic object/value helpers.
    ├── terminal/       # Terminal output and color helpers.
    └── version.ts      # Package version metadata.
```

## Code Flow

The outer layers translate protocol concerns into application requests.
Memory, extraction, MCP, and project lifecycle workflows live in dedicated
feature folders. Skill installation and memory transfer still use
`composition`. Providers contain concrete runtime details.

```mermaid
graph LR
    E[entrypoint] --> C[controllers]
    C --> X[composition]
    C --> Q[mcp]
    C --> J[project]
    X --> M[memory]
    Q --> M
    J --> G[extraction]
    Q --> K[contracts and models]
    G --> K
    M --> K
    J --> K
    X --> P[providers]
    G --> P
    M --> P
    Q --> P
    J --> P
    P --> R[(filesystem, SQLite, assets, SDKs)]
    C --> S[support]
    P --> S
```

Layer responsibilities:

- `main.ts` owns Commander registration and delegates to controllers.
- Controllers adapt CLI or MCP input/output and call composed operations.
- Composition owns skill installation and memory transfer wiring.
- Extraction owns project extraction workflow orchestration and project context loading.
- Memory owns recall, search, save, forget, warm-up, and MCP project/database runtime helpers.
- MCP owns tool/prompt listing, tool dispatch, response formatting, and dry-run orchestration.
- Project owns init, status, repair, and grammar selection workflows.
- Providers implement contracts and own filesystem, database, object storage, embedding, protocol-template, and SDK details.
- Middleware handles cross-cutting entrypoint checks before controllers run.
- Support stays generic, dependency-light, and reusable across layers.

Rules:

- Do not put workflow or provider selection logic in controllers.
- Keep memory workflow code in `src/memory`; do not split recall/save/search orchestration across actions and composition.
- Keep extraction workflow code in `src/extraction`; do not split extraction orchestration across actions and composition.
- Keep MCP tool, prompt, handler, and dry-run code in `src/mcp`; do not split MCP orchestration across composition.
- Keep project lifecycle workflow code in `src/project`; do not split init/status/repair orchestration across actions and composition.
- Providers must not import actions, controllers, or composition modules in production code.
- Run `bun scripts/check-architecture-boundaries.ts` after refactors that move workflow ownership.
- Prefer direct imports over barrel files, for example `@/providers/persistence/sqlite/database`.
- Keep `support` for project-owned generic utilities; do not use it as a re-export layer for third-party packages or Node built-ins.
- Preserve public CLI commands, MCP tool names, prompt names, and persisted database behavior during refactors.
