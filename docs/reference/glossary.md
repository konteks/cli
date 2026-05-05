# Glossary

Short definitions for Konteks product terms.

## Agent

An AI coding assistant connected to the project through an MCP client.

## Bootstrap

The first lifecycle phase. Bootstrap gives a fresh agent session stable project context using `konteks_bootstrap`.

## Context

Relevant project knowledge given to an agent so it can work without rediscovering the repository from scratch.

## Diary

A chronological activity record saved by an agent. Diary entries help future sessions avoid repeated work, but they are not part of default Bootstrap context.

## Knowledge Curation

The process of turning raw project artifacts and agent findings into durable, retrievable memory.

## Local-First

Konteks stores memory in the project directory and does not require a cloud service or account.

## MCP

Model Context Protocol. The protocol Konteks uses to expose memory tools and workflow prompts to AI agents.

## MCP Prompt

A user-invoked workflow template exposed through MCP. Konteks prompts guide agents through Bootstrap, Work, and Save flows.

## MCP Tool

A callable operation exposed to an agent through MCP, such as `konteks_bootstrap`, `konteks_recall`, or `konteks_save`.

## Memory Engine

The Konteks system that mines, stores, retrieves, and updates project memory.

## Mine

The CLI process that scans project files, extracts structure, builds retrieval documents, and prepares local memory.

## Recall

Task-specific retrieval. Recall gives the agent compact, relevant context before existing work begins.

## Retrieval Document

A derived search surface built from chunks, modules, memories, or diary entries. Retrieval documents provide bounded text for FTS and embeddings.

## Save

The final lifecycle phase. Save records completed work, decisions, and durable task state back to Konteks.

## Storage Substrate

The local persistence layer for Konteks memory, currently based on WASM SQLite and a content-addressed object store.

## TOON

A compact text format used for agent-readable stored summaries and payloads.

## Work

The second lifecycle phase. Existing work should use Recall first; genuinely new work may start directly.
