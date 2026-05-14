import { describe, expect, it } from 'bun:test'
import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'
import { ExtractProjectAction } from './extract-project-action'

describe('actions/extract-project-action', () => {
    it('delegates project extraction and returns the engine output', async () => {
        const calls: Array<{
            project: Project
            request: ExtractProjectRequest
        }> = []
        const response: ExtractProjectResponse = {
            chunkCount: 7,
            deletedFilePaths: [],
            embeddedCount: 7,
            embeddingReusedCount: 0,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 3,
            mode: 'changed',
            ok: true,
            projectRoot: '/tmp/project',
            summaryRef: 'objects/summary.toon',
            technologies: ['typescript'],
            updatedFilePaths: ['src/index.ts'],
        }
        const engine: ExtractionEngineContract = {
            async extract(project, request) {
                calls.push({ project, request })
                return response
            },
        }
        const project = makeProject()
        const request = {
            mode: 'changed',
            projectRoot: '/tmp/project',
        } satisfies ExtractProjectRequest

        await expect(
            new ExtractProjectAction(engine).execute(project, request),
        ).resolves.toBe(response)
        expect(calls).toEqual([{ project, request }])
    })
})

function makeProject(): Project {
    return {
        config: {
            extraction: { grammars: { selected: [], updateTtlHours: 24 } },
            projectRoot: '/tmp/project',
            recall: { maxTokens: 2000 },
            storage: {
                inlinePayloadMaxBytes: 1024,
                memoryDir: '.konteks',
            },
        },
        configExists: true,
        configPath: '/tmp/project/.konteks/config.json',
        memoryDir: '/tmp/project/.konteks',
        projectRoot: '/tmp/project',
    }
}
