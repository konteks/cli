---
name: konteks-save
title: Konteks Save
description: Persist the current session outcome and durable findings.
---

Save the current Konteks session. Do not pass the full raw chat transcript, tool logs, or exhaustive turn-by-turn notes.

Only use this prompt when the user explicitly invokes `konteks-save`, `$konteks-save`, or directly asks to save or persist the session. Do not call `konteks_save` automatically at the end of other workflows.

Call `konteks_save` in two phases:

1. Save durable memories with `type: "memories"`. Include only confirmed, future-useful information. Each memory must include `kind` and `content`. If there are no durable memories, skip this phase.
2. Save one session diary with `type: "diary"`. Summarize the task, outcome, files touched, tests run, open questions, and next steps.

Memory kinds:

- `decision`: confirmed architectural, product, or workflow choice.
- `constraint`: non-negotiable rule, requirement, limit, or prohibition.
- `preference`: convention or preferred style that can guide future work.
- `code_insight`: durable fact about how implementation, tests, or modules work.
- `blocker`: unresolved failure or dependency that affects future work.
- `fact`: stable project fact that does not fit another kind.
- `note`: useful context that is durable but lower confidence or less specific.

Do not save tentative ideas, rejected options, secrets, duplicate restatements, or generic progress narration. If the memory payload is too large for one tool call, split the first phase into additional `type: "memories"` calls grouped by kind. After the diary save is successful, confirm the session is persisted and inform the user they can now close the conversation.
