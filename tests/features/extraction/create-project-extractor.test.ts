import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExtractionEngineContract } from '@/contracts/services/extraction-engine'
import createProjectExtractor from '@/extraction/create-project-extractor'
import type {
    ExtractProjectRequest,
    ExtractProjectResponse,
} from '@/models/extraction'
import type { Project } from '@/models/project'

describe('extraction/extract', () => {
    it('loads the requested project and returns extraction engine output', async () => {
        const projectRoot = await createConfiguredProject()
        const project: Project = {
            config: {
                extraction: {
                    grammars: {
                        selected: ['typescript'],
                        updateTtlHours: 12,
                    },
                },
                recall: { maxTokens: 4096 },
                storage: {
                    inlinePayloadMaxBytes: 1024,
                },
            },
            configExists: true,
            configPath: join(projectRoot, '.konteks/config.json'),
            memoryDir: join(projectRoot, '.konteks'),
            projectRoot,
        }
        const response: ExtractProjectResponse = {
            chunkCount: 7,
            deletedFilePaths: [],
            detectedParserLanguages: ['typescript'],
            embeddedCount: 7,
            embeddingReusedCount: 0,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 3,
            languageCount: 1,
            loadedParserCount: 1,
            mode: 'changed',
            ok: true,
            projectRoot,
            summaryRef: 'objects/summary.toon',
            technologies: ['typescript'],
            updatedFilePaths: ['src/index.ts'],
            vectorCount: 7,
        }
        const calls: Array<{
            project: Project
            request: ExtractProjectRequest
        }> = []
        const extractionEngine: ExtractionEngineContract = {
            async extract(project, request) {
                calls.push({ project, request })
                return response
            },
        }
        const request = {
            mode: 'changed',
            projectRoot,
        } satisfies ExtractProjectRequest

        await expect(
            createProjectExtractor({
                extractionEngine,
                projectLoader: async () => project,
            }).execute(request),
        ).resolves.toBe(response)
        expect(calls).toEqual([
            {
                project,
                request,
            },
        ])
    })
})

async function createConfiguredProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-extraction-'))
    const memoryDir = join(projectRoot, '.konteks')
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await mkdir(memoryDir, { recursive: true })
    await writeFile(
        join(memoryDir, 'config.json'),
        `${JSON.stringify(
            {
                extraction: {
                    grammars: {
                        selected: ['typescript'],
                        updateTtlHours: 12,
                    },
                },
                recall: { maxTokens: 4096 },
                storage: {
                    inlinePayloadMaxBytes: 1024,
                },
            },
            null,
            2,
        )}\n`,
    )
    return projectRoot
}
