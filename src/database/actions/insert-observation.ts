import { observations } from '@/database/schema'
import type { ObservationKind } from '@/types/memory'
import getDb from './_db'

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
    input: InsertObservationInput,
): Promise<void> {
    const db = await getDb()
    await db.insert(observations).values({
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
