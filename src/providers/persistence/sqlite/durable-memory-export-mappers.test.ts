import { describe, expect, it } from 'bun:test'
import { contentHash } from '@/providers/persistence/objects/content'
import type { ToonStore } from '@/providers/persistence/objects/create-toon-store'
import {
    exportDiaryRow,
    exportObservationRow,
} from './durable-memory-export-mappers'

describe('durable memory export mappers', () => {
    it('maps observation rows and resolves payload content', async () => {
        const toonStore = fakeToonStore({
            'objects/memory.toon': 'payload memory',
        })

        await expect(
            exportObservationRow(
                {
                    confidence: 0.7,
                    content_hash: null,
                    created_at: '2026-01-01T00:00:00.000Z',
                    deleted_at: null,
                    forget_reason: null,
                    id: 'obs_1',
                    kind: 'fact',
                    payload_ref: 'objects/memory.toon',
                    suppressed_at: null,
                    text_inline: null,
                },
                toonStore,
            ),
        ).resolves.toMatchObject({
            content: 'payload memory',
            contentHash: contentHash('payload memory'),
            kind: 'fact',
        })
    })

    it('maps diary rows and parses valid string tags only', async () => {
        const toonStore = fakeToonStore({})

        const diary = await exportDiaryRow(
            {
                content_hash: null,
                created_at: '2026-01-01T00:00:00.000Z',
                deleted_at: null,
                forget_reason: null,
                id: 'diary_1',
                payload_ref: null,
                subject: null,
                summary: 'Session summary',
                suppressed_at: null,
                tags_json: JSON.stringify(['session', 1, 'handoff']),
            },
            toonStore,
        )

        expect(diary).toMatchObject({
            subject: undefined,
            tags: ['session', 'handoff'],
        })
        await expect(
            exportDiaryRow(
                {
                    content_hash: null,
                    created_at: '2026-01-01T00:00:00.000Z',
                    deleted_at: null,
                    forget_reason: null,
                    id: 'diary_bad_tags',
                    payload_ref: null,
                    subject: 'bad tags',
                    summary: 'Inline summary',
                    suppressed_at: null,
                    tags_json: 'not-json',
                },
                toonStore,
            ),
        ).resolves.toMatchObject({ summary: 'Inline summary', tags: [] })
    })
})

function fakeToonStore(contents: Record<string, string>): ToonStore {
    return {
        read: async ref => contents[ref] ?? '',
        write: async content => ({
            hash: contentHash(content),
            path: '/tmp/object.toon',
            ref: 'objects/object.toon',
        }),
    }
}
