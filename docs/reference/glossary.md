# Glossary

Short definitions for Konteks product terms.

## Agent

An AI coding assistant connected to the project through an MCP client.

## Warm Up

The first lifecycle phase. Warm Up gives a fresh agent session stable project context using `konteks_warm_up`.

## Context

Relevant project knowledge given to an agent so it can work without rediscovering the repository from scratch.

## Diary

A chronological activity record saved by an agent. Diary entries help future sessions avoid repeated work, but they are not part of default Warm Up context.

## Indexed

A section, module, memory, or diary entry that Konteks has prepared for search and recall.

## Knowledge Curation

The process of turning raw project artifacts and agent findings into durable, retrievable memory.

## Local-First

Konteks stores memory in the project directory and does not require a cloud service or account.

## MCP

Model Context Protocol. The protocol Konteks uses to expose memory tools and workflow prompts to AI agents.

## MCP Prompt

A user-invoked workflow template exposed through MCP. Konteks prompts guide agents through Warm Up, Build, and Save flows.

## MCP Tool

A callable operation exposed to an agent through MCP, such as `konteks_warm_up`, `konteks_recall`, or `konteks_save`.

## Memory Engine

The Konteks system that extracts, stores, retrieves, and updates project memory.

## Repair

The CLI command that repairs project memory artifacts by rebuilding them from scratch for recovery or maintenance.

## Recall

Task-specific retrieval. Recall gives the agent compact, relevant context before existing work begins.

## Retrieval Document

A derived search surface built from sections, modules, memories, or diary entries. Retrieval documents provide bounded text for FTS and embeddings.

## Save

The final lifecycle phase. Save records the current session diary and durable memories back to Konteks.

## Session

One continuous agent conversation inside a project. A session starts when you open or resume the coding agent and ends when you close it, intentionally reset context, or switch to unrelated work. A session can contain one task or several related tasks.

## Session Boundary

The practical line that decides what belongs in one saved diary entry. Keep work in the same session when it shares the same goal, files, constraints, or decision chain. Start a fresh session when the next work is unrelated, needs a different project briefing, or would pollute the agent's current context.

## Storage Substrate

The local persistence layer for Konteks memory, currently based on WASM SQLite and a content-addressed object store.

## Task

A concrete unit of work inside a session, such as fixing a bug, adding a feature, or refactoring a module. Tasks are smaller than sessions: one session may include multiple related tasks.

## TOON

A compact text format used for agent-readable stored summaries and payloads.

## Unchanged

An item whose indexed content has not changed since the previous extraction, so Konteks can keep its existing search data.

## Build

The second lifecycle phase. Use Build prompts to continue existing tasks or start new ones; Recall can supplement either path when related context is useful.
