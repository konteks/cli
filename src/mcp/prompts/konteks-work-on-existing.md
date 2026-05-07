---
name: konteks-work-on-existing
title: Konteks Build Existing
description: Continue an existing task in the Build phase.
argument.task.description: The existing feature, module, file, or behavior to change.
argument.task.required: true
---

Build on this existing code or behavior: {{task}}. If known modules, constraints, or prior decisions may affect the task, call `konteks_recall` first; otherwise inspect the code directly, then implement the change.
