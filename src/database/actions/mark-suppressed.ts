import { eq } from 'drizzle-orm'
import { diaryEntries, observations, sections } from '@/database/schema'
import type { ForgetTarget } from '@/database/support/forget-target'
import getDb from './_db'

export default async function markSuppressed(
    target: ForgetTarget,
    reason: string | undefined,
): Promise<boolean> {
    const db = await getDb()
    const values = {
        forgetReason: reason ?? null,
        suppressedAt: new Date().toISOString(),
    }
    if (target.kind === 'section') {
        await db.update(sections).set(values).where(eq(sections.id, target.id))
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
