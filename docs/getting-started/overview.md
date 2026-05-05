# Overview

**Konteks** is a local context graph for AI coding agents. It acts as a **memory engine** for your repository, performing autonomous **knowledge curation** to ensure you **never re-explain your project** to an AI agent.

## Why Konteks?

Traditional Retrieval-Augmented Generation (RAG) often fails in coding because it treats code as plain text. It searches for keywords but misses the *structure*.

Konteks is built specifically for code. It uses language-aware mining (via Tree-sitter) and a hybrid graph-search model to understand the *meaning* and *relationships* within your project. By using Konteks, you move from "reading files" to "sharing a brain" with your AI agent.

## The Vision

In a typical agentic workflow, every new session is a "blank slate." The agent has to rediscover your architecture, your decisions, and your progress from scratch. This "context amnesia" leads to wasted tokens, redundant questions, and architectural drift.

Our vision is a world where project context is durable and portable. Konteks provides a queryable memory that lives directly inside your repository, bridging the gap between raw file reading and human-level project understanding.

## Core Philosophy

### 1. Local-First & Privacy-Centric

Konteks stores all memory artifacts (SQLite database and object store) inside your repository, typically in a `.konteks/` directory.

* **Your data stays with your code.**
* No cloud services, no external accounts, and no telemetry.
* Memory is as portable as your repo.

### 2. Zero-Friction (The Zero-Install Mandate)

We believe that setup should not be a barrier. Konteks is designed to be used through the JavaScript package ecosystem without global installation.

* Use it via `npx` or `bunx`.
* No host SQLite installation or native compilation required.
* Works anywhere Node.js or Bun is available.

### 3. Agent-Native & MCP-First

Konteks is built from the ground up for the **Model Context Protocol (MCP)**.

* It doesn't just return "search results"; it provides **Recall**—a ranked, token-efficient package of context tailored for LLM consumption.
* It follows a structured [Session Lifecycle](lifecycle.md) (Bootstrap -> Work -> Save) to keep the agent-human collaboration focused.

### 4. High Signal, Low Noise

Konteks focuses on **curated context**. Instead of logging every raw conversation, it prioritizes:

* **Durable Decisions**: Why you chose X over Y.
* **Structural Relationships**: How modules actually connect beyond simple imports.
* **Task State**: What was attempted, what failed, and what's next.

---

**Ready to get started?** Follow the [Quickstart](quickstart.md) to set up your project memory in minutes.

**Want to see the technical details?** Check out the [Architecture Overview](../core-concepts/overview.md) to see how Konteks is built under the hood.

**Need terminology?** Use the [Glossary](../reference/glossary.md) for short definitions of Konteks concepts.
