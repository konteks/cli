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
