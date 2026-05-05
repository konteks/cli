# Memory Model: The Surfaces of Project Knowledge

Konteks represents a project not as a flat list of files, but as a multi-dimensional **semantic graph**. This model allows the system to store and retrieve knowledge across four distinct surfaces, each serving a specific role in the [Knowledge Journey](overview.md).

## 1. Structural Memory

Structural memory represents the "skeleton" of your project. It captures the entities and the rigid relationships that define your architecture.

### Concepts

* **Entities**: The nodes of the graph. These include files, modules, classes, functions, and high-level features.
* **Relations**: The edges connecting entities (e.g., `Feature A` -> `implemented_in` -> `File B`).
* **Expansion**: The ability to navigate these links to find hidden dependencies.

### Technical Specification: Entity-Relationship Model

Structural memory is materialized in SQLite via the `entities` and `relations` tables.

| Table | Purpose | Key Fields |
| :--- | :--- | :--- |
| `entities` | Stores unique project artifacts | `id`, `type`, `name`, `canonical_name` |
| `relations` | Stores typed links between entities | `subject_id`, `predicate`, `object_id`, `confidence` |
| `entity_aliases` | Handles naming variations | `entity_id`, `value`, `normalized_value` |

## 2. Semantic Memory

Semantic memory captures the "meaning" within your project. It stores atomic units of knowledge and high-level observations that aren't tied to a single structural link.

### Concepts

* **Atomic Knowledge Units**: Small, semantic sections of code or documentation.
* **Observations**: Facts or insights captured during extraction or agent sessions (e.g., "The user prefers Bun over npm").

### Technical Specification: Indexing Substrate

Semantic units are indexed for both lexical and semantic search.

| Table | Purpose | Key Fields |
| :--- | :--- | :--- |
| `chunks` | Atomic sections of code/text | `content_hash`, `summary`, `token_count`, `payload_ref` |
| `observations` | Durable facts and insights | `text`, `kind`, `confidence`, `source_id` |

## 3. Temporal Memory

Temporal memory tracks the "when." It provides the chronological context required to understand how a project has evolved and what decisions are currently active.

### Concepts

* **Event Log**: An append-only record of every meaningful memory mutation.
* **Temporal Validity**: The ability to know if a relation is still `active` or has been `superseded`.

### Technical Specification: Chronology Tables

| Table | Purpose | Key Fields |
| :--- | :--- | :--- |
| `memory_events` | The master chronological log | `event_type`, `subject_id`, `summary`, `created_at` |
| `sessions` | Groups of related task events | `task`, `status`, `started_at`, `ended_at` |

## 4. Taxonomic Memory

Taxonomic memory provides the "where." It organizes knowledge into project-specific scopes to ensure that retrieval is always contextually relevant.

### Concepts

* **Project Scopes**: The logical domains of your project (e.g., `api`, `ui`, `database`).
* **Ontology**: The hierarchy that defines how different parts of the project relate to each other at a high level.

### Technical Specification: Classification Schema

| Table | Purpose | Key Fields |
| :--- | :--- | :--- |
| `taxonomy_nodes` | The labels in your ontology | `name`, `parent_id`, `summary` |
| `taxonomy_links` | Assignments of entities to nodes | `entity_id`, `node_id`, `confidence` |

---

**How is this knowledge acquired?** Read about [Semantic Extraction](extraction.md).
