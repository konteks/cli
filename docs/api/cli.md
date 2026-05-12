# CLI API

The Konteks CLI manages local project memory. It is designed to run through `npx`, `bunx`, `pnpm dlx`, or `yarn dlx`.

For terms, see the [Glossary](../reference/glossary.md).

## Commands

| Command | Capability | Use When |
| :--- | :--- | :--- |
| `konteks init` | Initialize | Prepare a project for local memory storage. |
| `konteks repair` | Repair | Rebuild project memory artifacts from scratch. |
| `konteks status` | Status | Check memory health and freshness. |
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
| `konteks mcp call <tool>` | Execute one tool in dry-run mode and print the tool text output without persisting writes. |
| `konteks mcp call <tool> '<json>'` | Execute one tool with input in dry-run mode and print the tool text output without persisting writes. |
| `konteks mcp call --json <tool> '<json>'` | Print the raw MCP result envelope as JSON. |
| `konteks mcp call --apply <tool> '<json>'` | Actually execute a mutating MCP tool call and print the tool text output. |

> [!IMPORTANT]
> `konteks mcp call` is a debug command. Mutating tools such as `konteks_warm_up`, `konteks_save`, and `konteks_forget` run against a temporary copy of Konteks memory by default, so the command can show the real tool output without persisting memory changes. Use `--apply` when you need to keep the writes, and `--json` when you need the raw MCP envelope.

## Compatibility Skills

If your agent supports MCP but does not show MCP prompts in its autocomplete UI (e.g. [Codex](https://github.com/openai/codex/issues/5059)), you can install native skills as a workaround:

```bash
konteks install-skills [--global]
```

This writes the Konteks lifecycle prompts (`warm-up`, `recall`, `save`) as native skills into `.agents/skills` (local) or `~/.agents/skills` (global).

## Global Options

| Option | Use When |
| :--- | :--- |
| `--project <path>` | Run Konteks against a specific project root. |
| `--verbose` | Show detailed diagnostic output. |
| `--help` | Show command help. |
