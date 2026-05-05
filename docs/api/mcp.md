# MCP API

Konteks exposes project memory to AI agents through MCP.

For terms, see the [Glossary](../reference/glossary.md).

## Surfaces

| Surface | What It Does |
| :--- | :--- |
| **Tools** | Actions the agent can call. |
| **Prompts** | Guided workflows for Warm Up -> Build -> Save. |
| **Resources** | Readable memory artifacts for inspection. |

## Tools

Canonical tool names use the `konteks_*` prefix so they stay clear when an agent has multiple MCP servers.

| Tool | Capability | Use When |
| :--- | :--- | :--- |
| `konteks_warm_up` | Warm Up | Start a fresh agent session with stable project context. |
| `konteks_recall` | Recall | Continue an existing task on known code, modules, features, or decisions. |
| `konteks_save` | Save | Preserve completed work, decisions, or durable findings. |
| `konteks_search` | Search | Inspect memory directly with a query. |
| `konteks_status` | Status | Check memory health and freshness. |
| `konteks_forget` | Forget | Remove or suppress wrong, stale, or sensitive memory. |

CLI debug commands may provide short aliases such as `search` or `status`. Agent clients should use the canonical names.

## Prompts

Prompts are user-invoked workflow templates. They guide the agent through the [Session Lifecycle](../getting-started/lifecycle.md).

| Prompt | Lifecycle Phase | Use When |
| :--- | :--- | :--- |
| `warm-up` | Warm Up | Open a fresh agent session in a project. |
| `recall` | Build | Supplement a task with context from known modules, constraints, or decisions. |
| `work-on-existing` | Build | Change known code; add recall context when needed. |
| `work-on-new` | Build | Start a genuinely new feature. |
| `save-session` | Save | Persist the outcome of the current task. |

## Resources

Resources are readable memory artifacts. They are useful for inspection, picker UIs, and debugging.

| Resource | Shows |
| :--- | :--- |
| `konteks://extraction/manifest` | Extraction and indexing state diagnostics. |
| `konteks://project/summary` | Stable extracted project summary. |
| `konteks://project/modules` | Current module and architecture index. |
| `konteks://memory/{id}` | One saved durable memory. |
| `konteks://retrieval/{targetType}/{targetId}` | One retrieval document for debugging. |

Resource lists are dynamic because memory changes after initialization, repair, `save`, and `forget`. Resource URIs should remain stable for the artifact they identify.
