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

Add Konteks to your MCP-compatible coding agent configuration before opening the agent:

> [!NOTE]
> MCP servers can be registered locally per project or globally for all projects. Global registration is recommended so you do not need to repeat this setup later.

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
