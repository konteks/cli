import { eq } from 'drizzle-orm'
import {
    chunks,
    diaryEntries,
    observations,
    taxonomyLinks,
} from '@/database/schema'
import type { ForgetTarget } from '@/database/support/forget-target'
import getDb from './_db'

export default async function hardDeleteForgetTarget(
    target: ForgetTarget,
): Promise<boolean> {
    const db = await getDb()
    if (target.kind === 'chunk') {
        await db
            .delete(taxonomyLinks)
            .where(eq(taxonomyLinks.targetId, target.id))
    }

    if (target.kind === 'chunk') {
        await db.delete(chunks).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.delete(observations).where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.delete(diaryEntries).where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}
