# CLI API

The Konteks CLI manages local project memory. It is designed to run through `npx`, `bunx`, `pnpm dlx`, or `yarn dlx`.

For terms, see the [Glossary](../reference/glossary.md).

## Commands

| Command | Capability | Use When |
| :--- | :--- | :--- |
| `konteks init` | Initialize | Prepare a project for local memory storage. |
| `konteks repair` | Repair | Rebuild project memory artifacts from scratch. |
| `konteks status` | Status | Check memory health and freshness. |
| `konteks doctor` | Diagnose | Inspect runtime and project setup problems. |
| `konteks mcp` | Serve | Start the MCP server for an agent client. |
| `konteks install-skills` | Compatibility | Install Konteks skills for agents without MCP prompt support. |

## MCP Debugging

These commands inspect MCP behavior from the terminal without registering an agent.

| Command | Shows |
| :--- | :--- |
| `konteks mcp tools` | MCP tool names, descriptions, and schemas. |
| `konteks mcp prompts` | MCP prompt names, descriptions, and arguments. |
| `konteks mcp prompt <prompt>` | Render one MCP prompt for debugging. |
| `konteks mcp prompt <prompt> '<json>'` | Render one MCP prompt with arguments. |
| `konteks mcp call <tool>` | Raw MCP result for one tool call. |
| `konteks mcp call <tool> '<json>'` | Raw MCP result for one tool call with input. |

## Compatibility Skills

If your agent supports MCP but does not show MCP prompts in its autocomplete UI (e.g. [Codex](https://github.com/openai/codex/issues/5059)), you can install native skills as a workaround:

```bash
konteks install-skills [--global]
```

This writes the five Konteks lifecycle prompts (`warm-up`, `recall`, `work-on-existing`, `work-on-new`, `save`) as native skills into `.agents/skills` (local) or `~/.agents/skills` (global).

## Global Options

| Option | Use When |
| :--- | :--- |
| `--project <path>` | Run Konteks against a specific project root. |
| `--verbose` | Show detailed diagnostic output. |
| `--help` | Show command help. |
