import { eq } from 'drizzle-orm'
import type { SqliteConnection } from '@/database/actions/_db'
import {
    chunks,
    diaryEntries,
    observations,
    taxonomyLinks,
} from '@/database/schema'
import type { ForgetTarget } from '@/database/support/forget-target'

export default async function hardDeleteForgetTarget(
    db: SqliteConnection,
    target: ForgetTarget,
): Promise<boolean> {
    if (target.kind === 'chunk') {
        await db.db
            .delete(taxonomyLinks)
            .where(eq(taxonomyLinks.targetId, target.id))
    }

    if (target.kind === 'chunk') {
        await db.db.delete(chunks).where(eq(chunks.id, target.id))
    } else if (target.kind === 'observation') {
        await db.db.delete(observations).where(eq(observations.id, target.id))
    } else if (target.kind === 'diary_entry') {
        await db.db.delete(diaryEntries).where(eq(diaryEntries.id, target.id))
    } else {
        return false
    }
    return true
}
