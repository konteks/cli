# Directory Structure

This document provides an overview of the Konteks project structure and organization.

- controllers
  - cli
    - init.ts
    - repair.ts
    - get-health.ts
    - get-status.ts
    - get-prompts.ts
    - get-prompt-detail.ts
    - get-tools.ts
    - get-tool-detail.ts
    - call-mcp-tool.ts
    - install-skills.ts
  - mcp
    - serve.ts
    - tools
      - warm-up.ts
      - recall.ts
      - save.ts
      - search.ts
      - forget.ts
    - prompts
      - warm-up.ts
      - recall.ts
      - work-on-existing.ts
      - work-on-new.ts
      - save.ts
- services
  - cli
  - database
  - mcp
  - file-system
  - model
  - parser
