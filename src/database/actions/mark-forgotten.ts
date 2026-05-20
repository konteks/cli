import { eq } from 'drizzle-orm'
import { chunks, diaryEntries, observations } from '@/database/schema'
import type { ForgetTarget } from '@/database/support/forget-target'
import getDb from './_db'

export default async function markForgotten(
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const db = await getDb()
    const values = {
        deletedAt: new Date().toISOString(),
        forgetReason: reason ?? null,
    }
    if (target.kind === 'chunk') {
        await db.update(chunks).set(values).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db
            .update(observations)
            .set(values)
            .where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db
            .update(diaryEntries)
            .set(values)
            .where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}
