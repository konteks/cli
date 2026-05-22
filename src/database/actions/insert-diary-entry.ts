import { diaryEntries } from '@/database/schema'
import getDb from './_db'

export type InsertDiaryEntryInput = {
    contentHash: string | null
    createdAt: string
    deletedAt?: string | null
    forgetReason?: string | null
    id: string
    subject?: string | null
    summary: string
    suppressedAt?: string | null
    tagsJson?: string | null
}

export default async function insertDiaryEntry(
    input: InsertDiaryEntryInput,
): Promise<void> {
    const db = await getDb()
    await db.insert(diaryEntries).values({
        contentHash: input.contentHash,
        createdAt: input.createdAt,
        deletedAt: input.deletedAt ?? null,
        forgetReason: input.forgetReason ?? null,
        id: input.id,
        subject: input.subject ?? null,
        summary: input.summary,
        suppressedAt: input.suppressedAt ?? null,
        tagsJson: input.tagsJson ?? null,
    })
}
