# CLI API

The Konteks CLI manages local project memory. It is designed to run through `npx`, `bunx`, `pnpm dlx`, or `yarn dlx`.

For terms, see the [Glossary](../reference/glossary.md).

## Commands

| Command | Capability | Use When |
| :--- | :--- | :--- |
| `konteks init` | Initialize | Prepare a project for local memory storage. |
| `konteks repair` | Repair | Repair project memory artifacts by rebuilding them from scratch. |
| `konteks status` | Status | Check memory health and freshness. |
| `konteks doctor` | Diagnose | Inspect runtime and project setup problems. |
| `konteks mcp` | Serve | Start the MCP server for an agent client. |

## MCP Debugging

These commands inspect MCP behavior from the terminal without registering an agent.

| Command | Shows |
| :--- | :--- |
| `konteks mcp tools` | MCP tool names, descriptions, and schemas. |
| `konteks mcp call <tool>` | Raw MCP result for one tool call. |
| `konteks mcp call <tool> '<json>'` | Raw MCP result for one tool call with input. |

Examples:

```bash
konteks mcp tools
konteks mcp call konteks_status
konteks mcp call konteks_warm_up '{"maxTokens":500}'
konteks mcp call konteks_search '{"query":"memory","limit":3}'
```

Use canonical `konteks_*` tool names in documentation and scripts. Short debug aliases may exist for convenience, but they should not be treated as the public naming pattern.

## Global Options

| Option | Use When |
| :--- | :--- |
| `--project <path>` | Run Konteks against a specific project root. |
| `--verbose` | Show detailed diagnostic output. |
| `--help` | Show command help. |
