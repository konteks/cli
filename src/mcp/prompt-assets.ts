export const promptFiles = [
    {
        fileName: 'konteks-warm-up.md',
        raw: `---
name: konteks-warm-up
title: Konteks Warm Up
description: Open a fresh Konteks session with project context.
---

Warm up this Konteks session. Call \`konteks_warm_up\` once, then summarize only the returned project architecture, constraints, technologies, and durable decisions.
`,
    },
    {
        fileName: 'konteks-recall.md',
        raw: `---
name: konteks-recall
title: Konteks Recall
description: Supplement a Build task with context from known project memory.
argument.task.description: The module, feature, file, decision, or constraint to recall.
argument.task.required: true
---

Recall relevant Konteks context for this task: {{task}}. Call \`konteks_recall\`, then use the returned context as supporting evidence for the task.
`,
    },
    {
        fileName: 'konteks-work-on-existing.md',
        raw: `---
name: konteks-work-on-existing
title: Konteks Build Existing
description: Continue an existing task in the Build phase.
argument.task.description: The existing feature, module, file, or behavior to change.
argument.task.required: true
---

Build on this existing code or behavior: {{task}}. If known modules, constraints, or prior decisions may affect the task, call \`konteks_recall\` first; otherwise inspect the code directly, then implement the change.
`,
    },
    {
        fileName: 'konteks-work-on-new.md',
        raw: `---
name: konteks-work-on-new
title: Konteks Build New
description: Start a new task in the Build phase.
argument.task.description: The new task or feature to build.
argument.task.required: true
---

Build this new task: {{task}}. Discover relevant code during implementation; call \`konteks_recall\` only if known modules, constraints, or prior decisions may affect the task. Keep durable findings ready for save.
`,
    },
    {
        fileName: 'konteks-save.md',
        raw: `---
name: konteks-save
title: Konteks Save
description: Persist the current session outcome and durable findings.
---

Save the current Konteks session. Call \`konteks_save\` once with the full chat transcript in the \`chat\` argument. Do not call \`konteks_save\` repeatedly for individual memories; Konteks will derive durable memories, make them searchable, and write one diary entry from the high-signal stored memory.
`,
    },
] as const
