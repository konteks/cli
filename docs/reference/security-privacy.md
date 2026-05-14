# Security & Privacy

Konteks is built with a **Local-First Philosophy**. We believe that your project's soul—its code, decisions, and history—should remain under your control.

## 1. Data Sovereignty: All Data is Local

The most important security feature of Konteks is where your data lives: **on your machine**.

* **No Cloud Storage**: Konteks does not upload your code, summaries, or memories to any external cloud service.
* **Project-Local**: All memory is stored within the `.konteks` directory inside your project root.
* **Privacy by Default**: Because the data is local, it is never used for training models by Konteks. (Note: Your AI agent/host may still send recalled context to its own model provider as part of its normal operation).

## 2. Secret Protection

Konteks includes active measures to prevent sensitive information from entering its memory.

### Automated Detection
The `konteks_save` and `konteks_remember` tools perform a "Secret Check" before persisting any durable memory. If the content appears to contain patterns matching API keys, secrets, or common authentication tokens, the operation is blocked to prevent accidental leakage into the semantic graph.

### Respecting Ignore Rules
Konteks rigorously respects your project's ignore rules. Files and directories listed in `.gitignore` or `.ignore` are skipped during the extraction process, ensuring that environment files (like `.env`) or temporary artifacts are never indexed.

## 3. Auditability: Transparency in Memory

Konteks maintains an append-only [Memory Events](memory-model.md#3-temporal-memory) log that records every meaningful mutation of your project's memory.

*   **Transparency**: You can inspect the history of what was added, modified, or forgotten.
*   **Accountability**: Every event is tagged with an actor (e.g., `cli` or `mcp`), providing a clear audit trail of how your project's knowledge has evolved.

## 4. Data Control

You have full control over the knowledge Konteks stores.

### Forget & Delete
You can selectively remove memory using the `konteks_forget` tool. This supports multiple modes:
- **Soft Delete**: Marks memory as deleted (hidden from recall).
- **Invalidate**: Marks memory as superseded or no longer true.
- **Hard Delete**: Permanently removes the record from the local database.

### Portability & Deletion
Because all data is stored in the `.konteks` folder, you can "wipe" Konteks' memory for a project simply by deleting that folder.

## 4. Responsible AI Usage

While Konteks keeps your data local, it is important to remember that:
- **Recall Packages** contain snippets of your project's knowledge.
- These packages are sent to your AI agent (e.g., Gemini, Claude) as part of the context window.
- You should ensure that your AI host's privacy policy aligns with your project's requirements.

---

**Questions about your data?** Review the [Storage Substrate](../core-concepts/storage.md) details.
