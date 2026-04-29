# Konteks

Konteks is a local context graph for AI coding agents.

It stores project memory inside the repository and exposes compact recall through an MCP server, so future agent sessions can recover decisions, handoffs, relationships, and useful project context without a global install.

## Quickstart

Initialize project-local memory:

```bash
npx -y @konteks/cli init
```

Equivalent package-manager execution:

```bash
bunx @konteks/cli init
pnpm dlx @konteks/cli init
yarn dlx @konteks/cli init
```

Start the MCP server from a project root:

```bash
npx @konteks/cli mcp
```

Mine project context when bootstrap recommends it:

```bash
npx @konteks/cli mine
```

## MCP Config

```json
{
  "mcpServers": {
    "konteks": {
      "command": "npx",
      "args": ["-y", "@konteks/cli", "mcp"]
    }
  }
}
```

## Local Storage

Konteks writes local memory under:

```text
.konteks/
  config.json
  memory.sqlite
  objects/
  chunks/
```

Add `.konteks/` to `.gitignore` unless you intentionally want to share memory artifacts.

Konteks uses SQLite through the JavaScript/WASM package ecosystem. Users do not need to install a host SQLite client or compile native modules.

## Development

```bash
bun install
bun run check
```

The package is distributed as an ESM CLI with `konteks` as the binary entrypoint.
