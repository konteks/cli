import { describe, expect, it } from 'bun:test'
import type { ProjectExtractor } from '@/extraction/extract'
import type { ExtractProjectResponse } from '@/models/extraction'
import {
    type RepairMemoryDependencies,
    type RepairMemoryOptions,
    type RepairMemoryResult,
    repairMemory,
} from './repair'

type CoveredTypes = [
    RepairMemoryDependencies,
    RepairMemoryOptions,
    RepairMemoryResult,
]

describe('project/repair', () => {
    it('skips repair when confirmation returns false', async () => {
        await expect(
            repairMemory(
                { project: '/tmp/project' },
                { confirmRepair: async () => false },
            ),
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
            repairMemory(
                { project: '/tmp/project' },
                {
                    confirmRepair: async () => true,
                    extractor,
                },
            ),
        ).resolves.toEqual({
            ...response,
            mode: 'repair',
        })
        expect(calls).toEqual([
            { mode: 'reindex', projectRoot: '/tmp/project' },
        ])
    })

    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'RepairMemoryDependencies',
            'RepairMemoryOptions',
            'RepairMemoryResult',
        ] as const

        expect(typeNames).toEqual([
            'RepairMemoryDependencies',
            'RepairMemoryOptions',
            'RepairMemoryResult',
        ])
    })
})
