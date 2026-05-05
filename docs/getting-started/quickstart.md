# Quickstart

Follow these steps to set up Konteks and prepare your project for AI-assisted development.

## Step 1: Initialize Project Memory

Konteks is designed to be "Zero-Install." You can initialize your project using your preferred JavaScript package manager.

### Using npx

```bash
npx -y @konteks/cli init
```

### Using bunx

```bash
bunx @konteks/cli init
```

**What happens?**

* Creates a `.konteks/` directory for local memory storage.
* Initializes the `memory.sqlite` substrate.
* **Automatically adds `.konteks/` to your `.gitignore`**.

## Step 2: Extract Project Knowledge (Mining)

Once initialized, you must populate the memory engine with your project's current state.

```bash
npx @konteks/cli mine
```

**What happens?**

* Performs language-aware static analysis using Tree-sitter.
* Constructs the initial semantic and structural indexes.
* Populates the knowledge graph with your project's features and modules.

## Step 3: Verify Memory Health

Ensure your project memory is fresh and ready for an AI agent.

```bash
npx @konteks/cli status
```

If the status reports that your memory is **fresh**, the memory engine is ready.

---

**Next: Learn the [Bootstrap -> Work -> Save lifecycle](lifecycle.md)** to see how to use this memory with your AI agent.
