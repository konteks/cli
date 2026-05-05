# CLI API

The Konteks CLI manages local project memory. It is designed to run through `npx`, `bunx`, `pnpm dlx`, or `yarn dlx`.

For terms, see the [Glossary](../reference/glossary.md).

## Commands

| Command | Capability | Use When |
| :--- | :--- | :--- |
| `konteks init` | Initialize | Prepare a project for local memory storage. |
| `konteks mine` | Mine | Extract project knowledge into memory. |
| `konteks status` | Status | Check memory health and freshness. |
| `konteks doctor` | Diagnose | Inspect runtime and project setup problems. |
| `konteks mcp` | Serve | Start the MCP server for an agent client. |

## Mining

| Command | Use When |
| :--- | :--- |
| `konteks mine` | Build or refresh project memory. |
| `konteks mine --changed` | Process only files changed since the last successful mine. |
| `konteks mine --reindex` | Rebuild mined artifacts and indexes from scratch. |

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
konteks mcp call status
konteks mcp call bootstrap '{"maxTokens":500}'
konteks mcp call search '{"query":"memory","limit":3}'
```

CLI debug aliases:

| Alias | MCP Tool |
| :--- | :--- |
| `status` | `konteks_status` |
| `bootstrap` | `konteks_bootstrap` |
| `recall` | `konteks_recall` |
| `search` | `konteks_search` |
| `save` | `konteks_save` |
| `forget` | `konteks_forget` |

## Global Options

| Option | Use When |
| :--- | :--- |
| `--project <path>` | Run Konteks against a specific project root. |
| `--verbose` | Show detailed diagnostic output. |
| `--help` | Show command help. |

## Lifecycle Map

| User Intent | CLI Command |
| :--- | :--- |
| Set up memory | `konteks init` |
| Populate memory | `konteks mine` |
| Check readiness | `konteks status` |
| Register an agent | `konteks mcp` |
| Inspect MCP tools | `konteks mcp tools` |
| Debug MCP output | `konteks mcp call <tool>` |
