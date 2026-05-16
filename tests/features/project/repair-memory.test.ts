import { describe, expect, it } from 'bun:test'
import type { ProjectExtractor } from '@/extraction/create-project-extractor'
import type { ExtractProjectResponse } from '@/models/extraction'
import repairMemory from '@/project/repair-memory'

describe('project/repair', () => {
    it('skips repair when confirmation returns false', async () => {
        await expect(
            repairMemory({ confirmRepair: async () => false }),
        ).resolves.toEqual({ mode: 'repair', ok: false, skipped: true })
    })

    it('reindexes the selected project and returns repair mode output', async () => {
        const response: ExtractProjectResponse = {
            chunkCount: 4,
            deletedFilePaths: [],
            embeddedCount: 3,
            embeddingReusedCount: 1,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 2,
            mode: 'reindex',
            ok: true,
            projectRoot: '/tmp/project',
            summaryRef: 'objects/summary.toon',
            technologies: ['typescript'],
            updatedFilePaths: ['src/index.ts'],
        }
        const calls: unknown[] = []
        const extractor: ProjectExtractor = {
            async execute(request) {
                calls.push(request)
                return response
            },
        }

        await expect(
            repairMemory({
                confirmRepair: async () => true,
                extractor,
            }),
        ).resolves.toEqual({
            ...response,
            mode: 'repair',
        })
        expect(calls).toEqual([
            { mode: 'reindex', projectRoot: process.cwd() },
        ])
    })
})
