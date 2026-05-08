---
name: konteks-warm-up
title: Konteks Warm Up
description: Open a fresh Konteks session with project context.
argument.prompt.description: Optional free-form focus topic or task for targeted recall.
argument.prompt.required: false
---

Warm up this session by calling `konteks_warm_up` with `topic: "{{prompt}}"`.

After context is loaded, do not summarize or re-explain what you found unless the user explicitly asks. 

When the warm-up is the only or final task performed in this turn, confirm with: `Konteks is warmed up and ready for the task.`

If you are also performing other tasks (such as saving or implementation), use a response appropriate to the overall outcome instead.
