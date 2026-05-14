# Contributing

Thanks for wanting to contribute to Konteks.

## Setup

Install dependencies:

```bash
bun install
```

Run the CLI from source:

```bash
bun run dev
```

Build the distributable CLI:

```bash
bun run build
```

## Before Opening a PR

Run the full check:

```bash
bun run check
```

Use focused checks while working:

```bash
bun run lint
bun run test
```

`bun run lint` runs formatting, unused-code checks, and TypeScript type checks. If formatting changes are needed, let the script write them and include those changes.

## Code Guidelines

- Keep changes small and focused.
- Put tests next to the code they cover using the existing `*.test.ts` pattern.
- Follow the current module boundaries:
  - `src/controllers` handles CLI and protocol entrypoints.
  - `src/actions` holds use-case logic.
  - `src/composition` wires implementations together.
  - `src/contracts` defines shared interfaces.
  - `src/providers` contains concrete infrastructure.
  - `src/support` contains low-level helpers.
- Do not add provider barrel files. Import provider modules directly.
- Providers should not import actions, controllers, or composition modules.
- Actions and controllers should depend on contracts instead of concrete providers.

## Docs

Update docs when you change user-facing CLI behavior, MCP behavior, setup steps, storage behavior, or terminology.

Useful docs entrypoints:

- `README.md`
- `docs/README.md`
- `docs/api/cli.md`
- `docs/api/mcp.md`

## Pull Requests

Before submitting:

- Explain what changed and why.
- Mention any user-facing behavior changes.
- Include tests for behavior changes.
- Confirm `bun run check` passes.
