---
name: konteks-save
title: Konteks Save
description: Persist the current session outcome and durable findings.
---

Save the current Konteks session. Do not pass the full raw chat transcript.

Call `konteks_save` in two phases:

1. Save durable memories with `type: "memories"`. Include only confirmed, future-useful information. Each memory must include `kind` and `content`. Use these kinds: `decision`, `constraint`, `preference`, `code_insight`, `blocker`, `fact`, or `note`. If there are no durable memories, skip this phase.
2. Save one session diary with `type: "diary"`. Summarize the task, outcome, files touched, tests run, open questions, and next steps.

If the memory payload is too large for one tool call, split the first phase into additional `type: "memories"` calls grouped by kind. After the diary save is successful, confirm the session is persisted and inform the user they can now close the conversation.
