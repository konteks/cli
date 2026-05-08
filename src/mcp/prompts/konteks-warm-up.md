---
name: konteks-warm-up
title: Konteks Warm Up
description: Open a fresh Konteks session with project context.
argument.topic.description: Optional free-form topic, module, file, behavior, decision, or memory focus for targeted recall after warm up.
argument.topic.required: false
---

Warm up this session by calling `konteks_warm_up`.

Optional focus: {{topic}}

If the optional focus is non-empty, also pass it to `konteks_warm_up` for that focus to be included in returned context as focused supplemental memory for the next task.

After context is loaded, do not summarize or re-explain what you found unless the user explicitly asks. Reply only: `Konteks is warmed up and ready for the task.` no further action is required.
