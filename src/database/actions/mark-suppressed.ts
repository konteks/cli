import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import { chunks, diaryEntries, observations } from '@/database/schema'
import type { ForgetTarget } from '@/database/support/forget-target'

export default async function markSuppressed(
    db: SqliteConnection,
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const values = {
        forgetReason: reason ?? null,
        suppressedAt: new Date().toISOString(),
    }
    if (target.kind === 'chunk') {
        await db.db.update(chunks).set(values).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.db
            .update(observations)
            .set(values)
            .where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.db
            .update(diaryEntries)
            .set(values)
            .where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}
