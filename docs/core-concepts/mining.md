# Mining & Chunking: Semantic Extraction

The journey of project knowledge begins with **Semantic Extraction**. This process transforms raw source code and documentation into the **Atomic Knowledge Units** that populate the [Memory Model](memory-model.md).

## 1. The Mining Lifecycle

Mining is the process of scanning a repository to capture its latent structure and meaning.

### Concepts

* **Static Analysis**: Konteks examines code without executing it, identifying patterns and relationships.
* **Incremental Mining**: To maintain efficiency, the system can identify and process only the files that have changed since the last mining operation.

### Technical Specification: The Miner

* **CLI Command**: `konteks mine`
* **Ignore Rules**: Respects `.gitignore`, `.ignore`, and built-in defaults (e.g., `node_modules`, `.git`).
* **Metadata Extraction**: Ingests `package.json`, `README.md`, and configuration files to build the initial [Taxonomic Memory](memory-model.md#4-taxonomic-memory).

## 2. Language-Aware Parsing (Tree-sitter)

Traditional tools often split code into arbitrary fixed-size chunks (e.g., every 1000 characters). This breaks the "Semantic Integrity" of the code. Konteks uses **Tree-sitter** to understand the actual structure of the code.

### Concepts

* **Abstract Syntax Trees (AST)**: By parsing code into a tree structure, Konteks understands what is a function, a class, or a variable.
* **Semantic Units**: Instead of character counts, Konteks chunks code by its logical boundaries (e.g., one chunk = one function).

### Technical Specification: The Parser

* **Engine**: Web-Tree-Sitter (WASM)
* **Supported Languages**: TypeScript, JavaScript, HTML, JSON, and more.
* **Rationale**: We use WASM builds to maintain our "Zero-Install" promise while gaining the accuracy of a full compiler-grade parser.

## 3. Chunking Strategies

Different types of files require different extraction strategies to ensure high-fidelity [Recall](recall.md).

### Code Sectioning

* **Target**: One logical unit (Function/Class/Component).
* **Size**: Typically 300–900 tokens.
* **Metadata**: Each chunk is tagged with its parent file, module name, and symbol signature.

### Markdown & Prose

* **Target**: Heading-based sections.
* **Overlap**: Minimal overlap is used to preserve context at the boundaries of sections.

### Data & Config (JSON/YAML)

* **Target**: Meaningful object paths.
* **Structure**: Preserves the path hierarchy (e.g., `compilerOptions.target`) within the chunk metadata.

---

**How is this knowledge used?** Read about [Recall & Contextual Synthesis](recall.md).
