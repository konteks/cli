<img width="1536" height="1024" alt="Banner" src="https://github.com/user-attachments/assets/37e29d10-ed23-409d-92b2-2c6fab854f72" />

# Konteks

**Konteks** is a memory engine for AI coding agents.

It builds a project-local context graph through autonomous **knowledge curation**, ensuring you **never re-explain your project** to an AI agent.

> [!IMPORTANT]
> 🚧 Work in Progress: The core architecture is functional, but the retrieval logic and language support are being actively refined.

Memory artifacts are stored directly inside your repository, exposing compact, task-specific recall through an MCP server without requiring global installation or cloud dependencies.

## 🚀 Key Features

* **Zero-Install**: Run anywhere via `npx` or `bunx` without native dependencies.
* **Language-Aware**: Precise semantic parsing via Tree-sitter (not just regex).
* **Local-First**: Your project memory stays in your repo—no cloud, no accounts.
* **Token-Efficient**: High-fidelity context synthesis designed for LLM economy.

## 📖 Documentation

For a deep dive into the philosophy, architecture, and usage, see the [Full Documentation](docs/README.md).

* [Overview](docs/getting-started/overview.md): Vision, Philosophy, and the "Why."
* [Session Lifecycle](docs/getting-started/lifecycle.md): How to work with Konteks (Warm Up -> Build -> Save).
* [Architecture Overview](docs/core-concepts/overview.md): How the memory engine works under the hood.
* [Glossary](docs/reference/glossary.md): Short definitions for Konteks terms.

## 🛠 Supported Languages

Konteks uses specialized grammars for semantic extraction:

* TypeScript / JavaScript
* HTML / JSDoc
* JSON
* PHP
* *(More coming soon)*

## ⚡ Quickstart

Konteks runs on **Node.js (>=22)** or **Bun**. Start by initializing memory from your project root:

```bash
npx -y @konteks/cli init
```

Continue with the [Quickstart](docs/getting-started/quickstart.md) for MCP setup and the Warm Up -> Build -> Save flow.

## 📂 Local Storage

Konteks writes local memory under `.konteks/`. It uses SQLite (WASM) for the graph/indexes and a content-addressed object store for payloads. No host SQLite client or native modules are required.

## ⚖️ License

MIT Licensed. See [LICENSE](LICENSE) for details.
