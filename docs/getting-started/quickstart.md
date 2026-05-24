# Quickstart

Set up Konteks once, then use the same [session](../reference/glossary.md#session) flow whenever you open your coding agent.

> [!TIP]
> **Using an AI coding agent?** See [AI-Assisted Installation](../../README.md#-ai-assisted-installation) for a copy-ready prompt that asks the agent to install Konteks, configure MCP, and verify setup for you.

## Prerequisite: Project Setup

### 1. Initialize Memory

Run one command from your project root:

```bash
npx -y konteks-cli init

# or your preferred package manager:
bunx konteks-cli init
pnpm dlx konteks-cli init
yarn dlx konteks-cli init
```

**What happens?**

* Creates a `.konteks/` directory for local memory storage.
* Initializes the `memory.sqlite` substrate.
* Adds `.konteks/` to your `.gitignore`.
* Extracts and indexes the current project state.

### 2. Set Up MCP

Add Konteks to your MCP-compatible coding agent configuration before opening the agent.

> [!TIP]
> **Global Registration**: Register Konteks globally in your agent's config so you don't have to repeat this setup for every project.

```json
{
  "mcpServers": {
    "konteks": {
      "command": "npx",
      "args": ["-y", "konteks-cli", "mcp"]
    }
  }
}
```

> [!IMPORTANT]
> Konteks exposes its lifecycle workflows as [MCP Prompts](https://modelcontextprotocol.io/docs/concepts/prompts). If your agent does not show MCP Prompts in its autocomplete UI, run `konteks install-skills` once after initialization to use the lifecycle prompts as native skills. See [Compatibility](../api/cli.md#compatibility-skills).

## From This Point On

Use this flow whenever you open a fresh coding-agent session in the project.
For the full model behind this loop, read the [Warm Up -> Build -> Save lifecycle](lifecycle.md).

### 3. Open Your Agent

Open your coding agent in this repository after the MCP server is configured.

### 4. Warm Up

Run the Warm Up prompt at the start of a fresh agent session. The topic is optional: leave it blank for general project context, or add a topic to focus the memories loaded during Warm Up.

```text
/konteks-warm-up security, authentication, and authorization
```

### 5. Build

Give your agent the task (prompt) directly. Recall is not required for every task, but it is a useful supplement when the work benefits from remembered modules, constraints, or prior decisions:

```text
/konteks-recall last attack, vulnerability, prevention and mitigation
```

### 6. Save

When the session is complete or worth preserving:

```text
/konteks-save
```

The prompt tells your agent to call `konteks_save_memories` for compact durable memories, then `konteks_save_diary` for one session diary. You do not need to manually summarize or split the work yourself.
