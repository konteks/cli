# Quickstart

Set up Konteks once, then use the same [session](../reference/glossary.md#session) flow whenever you open your coding agent.

## Prerequisite: Project Setup

### 1. Initialize Memory

Run one command from your project root:

```bash
npx -y @konteks/cli init

# or your preferred package manager:
bunx @konteks/cli init
pnpm dlx @konteks/cli init
yarn dlx @konteks/cli init
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
      "args": ["-y", "@konteks/cli", "mcp"]
    }
  }
}
```

> [!IMPORTANT]
> **Agent Support**: If your agent supports MCP Tools but does not show MCP Prompts in its autocomplete UI, run `konteks install-skills` once after initialization to use the lifecycle prompts as native skills. See [Compatibility](../api/cli.md#Compatibility-Skills).

## From This Point On

Use this flow whenever you open a fresh coding-agent session in the project.
For the full model behind this loop, read the [Warm Up -> Build -> Save lifecycle](lifecycle.md).

### 3. Open Your Agent

Open your coding agent in this repository after the MCP server is configured.

### 4. Warm Up

Run the Warm Up prompt at the start of a fresh agent session:

```text
/konteks-warm-up
```

You can also append an additional topic(s) to bring relevant memories during Warm Up:

```text
/konteks-warm-up auth security
```

### 5. Build

For an existing feature, module, or file:

```text
/konteks-work-on-existing improve auth session and reduce token refresh race conditions.
```

For a new task:

```text
/konteks-work-on-new design and implement a lightweight notification center for failed background jobs.
```

### 6. Save

When the session is complete or worth preserving:

```text
/konteks-save
```

The prompt tells your agent to call `konteks_save` with compact structured payloads: durable memories first, then one session diary. You do not need to manually summarize or split the work yourself.
