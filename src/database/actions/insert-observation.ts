import type { SqliteConnection } from '@/database/actions/_db'
import { observations } from '@/database/schema'
import type { ObservationKind } from '@/models/memory'

export type InsertObservationInput = {
    confidence: number
    contentHash: string | null
    createdAt: string
    deletedAt?: string | null
    forgetReason?: string | null
    id: string
    kind: ObservationKind
    payloadRef?: string | null
    suppressedAt?: string | null
    textInline: string | null
}

export default async function insertObservation(
    db: SqliteConnection,
    input: InsertObservationInput,
): Promise<void> {
    await db.db.insert(observations).values({
        confidence: input.confidence,
        contentHash: input.contentHash,
        createdAt: input.createdAt,
        deletedAt: input.deletedAt ?? null,
        forgetReason: input.forgetReason ?? null,
        id: input.id,
        kind: input.kind,
        payloadRef: input.payloadRef ?? null,
        suppressedAt: input.suppressedAt ?? null,
        textInline: input.textInline,
    })
}
