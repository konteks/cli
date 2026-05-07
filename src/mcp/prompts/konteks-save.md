---
name: konteks-save
title: Konteks Save
description: Persist the current session outcome and durable findings.
---

Save the current Konteks session. Call `konteks_save` once with the full chat transcript in the `chat` argument. Do not call `konteks_save` repeatedly for individual memories; Konteks will derive durable memories, make them searchable, and write one diary entry from the high-signal stored memory. After the save is successful, confirm the session is persisted and inform the user they can now close the conversation.
