---
name: konteks-save
title: Konteks Save
description: Persist explicit session saves or lightweight remembered durable memory.
---

Save the current Konteks session. Do not pass the full raw chat transcript, tool logs, or exhaustive turn-by-turn notes.

Use the save tools only for these explicit user intents:

1. Full session save: the user invokes `konteks-save`, `$konteks-save`, or directly asks to save or persist the session. Use the two-phase workflow below: durable memories first, then one diary entry.
2. Lightweight remember: the user says "remember", "note that", "keep in mind", or equivalent phrasing with a specific fact, decision, constraint, preference, blocker, or code insight. Save only durable memories with `konteks_save_memories`. Do not write a diary for lightweight remember.

Do not call `konteks_save_memories` or `konteks_save_diary` automatically at the end of other workflows.

For a full session save, call the save tools in two phases:

1. Save durable memories with `konteks_save_memories`. Include only confirmed, future-useful guidance that should influence future sessions. Each memory must include compact `content`, `kind`, and `importance`. If there are no durable memories, skip this phase.
2. Save one compact session diary with `konteks_save_diary`. Use about 80-160 words or 3-6 short bullets. Summarize only the task, outcome, important files or modules touched, verification, unresolved questions, and exact next steps. Mention file paths and test commands only when they are useful for resuming work.

Accepted durable memory batch shape:

```json
{
  "memories": [
    {
      "content": "Use compact structured save payloads instead of raw chat transcripts.",
      "importance": 3,
      "kind": "decision"
    }
  ]
}
```

For durable memories, prefer stable rules, decisions, constraints, conventions, blockers, and code insights. Use `importance` from 1 to 5, where 3 is the default for useful project context and 4-5 is reserved for high-impact constraints, decisions, blockers, or code insights. Each durable memory should be short but operational: preserve the reusable rule, decision, or code insight a future agent can act on, not the session chronology. Do not turn completed implementation steps, file-by-file changelogs, test pass lists, or generic progress narration into durable memories; put only the useful handoff context in the diary.

For the diary, write a handoff summary, not a transcript. Omit command logs, tool output, routine files, repeated context from durable memories, and blow-by-blow chronology. If nothing is unresolved, say so briefly rather than inventing next steps.

For lightweight remember, save only self-contained durable memory with `konteks_save_memories`. Infer `kind` conservatively, usually `note` unless the statement is clearly a `decision`, `constraint`, `preference`, `code_insight`, or `blocker`. If the requested memory is ambiguous, ephemeral, or not likely to help future sessions, ask a brief clarification or skip saving.

Memory kinds:

- `decision`: confirmed architectural, product, or workflow choice.
- `constraint`: non-negotiable rule, requirement, limit, or prohibition.
- `preference`: convention or preferred style that can guide future work.
- `code_insight`: durable fact about how implementation, tests, or modules work.
- `blocker`: unresolved failure or dependency that affects future work.
- `fact`: stable project fact that does not fit another kind.
- `note`: useful context that is durable but lower confidence or less specific.

Do not save tentative ideas, rejected options, secrets, duplicate restatements, transient instructions, vague opinions, or generic progress narration. If the memory payload is too large for one tool call, split the first phase into additional `konteks_save_memories` calls grouped by kind, but first remove low-value items. After a full session diary save is successful, confirm the session is persisted and inform the user they can now close the conversation. After lightweight remember succeeds, confirm briefly with `Remembered.`
