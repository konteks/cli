import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import * as progressReporterModule from '@/modules/extraction/create-extraction-progress-reporter'
import * as extractorModule from '@/modules/extraction/create-project-extractor'
import { terminal } from '@/support/terminal/service'
import type { ExtractProjectResponse } from '@/types/extraction'

let confirmResult = true
const confirmCalls: unknown[] = []
let extractedResponse: ExtractProjectResponse = {
    deletedFilePaths: [],
    detectedParserLanguages: [],
    embeddedCount: 0,
    embeddingReusedCount: 0,
    extractedAt: '2026-01-01T00:00:00.000Z',
    fileCount: 0,
    languageCount: 0,
    loadedParserCount: 0,
    mode: 'rebuild',
    ok: true,
    projectRoot: process.cwd(),
    sectionCount: 0,
    summaryRef: 'objects/summary.json',
    technologies: [],
    updatedFilePaths: [],
    vectorCount: 0,
}
const extractorCalls: unknown[] = []
const progressReports: unknown[] = []
let progressDoneCount = 0

mock.module('@inquirer/prompts', () => ({
    confirm: async (options: unknown) => {
        confirmCalls.push(options)
        return confirmResult
    },
}))

afterEach(() => {
    mock.restore()
})

describe('RebuildCommand', () => {
    const createCommand = async () => {
        const { default: RebuildCommand } = await import(
            '@/entrypoints/cli/commands/rebuild-command'
        )
        return new RebuildCommand()
    }

    const resetState = () => {
        confirmResult = true
        extractedResponse = {
            deletedFilePaths: [],
            detectedParserLanguages: [],
            embeddedCount: 0,
            embeddingReusedCount: 0,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 0,
            languageCount: 0,
            loadedParserCount: 0,
            mode: 'rebuild',
            ok: true,
            projectRoot: process.cwd(),
            sectionCount: 0,
            summaryRef: 'objects/summary.json',
            technologies: [],
            updatedFilePaths: [],
            vectorCount: 0,
        }
        extractorCalls.length = 0
        progressReports.length = 0
        confirmCalls.length = 0
        progressDoneCount = 0
    }

    const installExtractorSpies = () => {
        const extractorSpy = spyOn(
            extractorModule,
            'default',
        ).mockImplementation(
            (options = {}) =>
                ({
                    async execute(request: unknown) {
                        extractorCalls.push(request)
                        options.onProgress?.({
                            message: 'complete',
                            phase: 'done',
                            status: 'done',
                        })
                        return extractedResponse
                    },
                }) as ReturnType<typeof extractorModule.default>,
        )
        const progressSpy = spyOn(
            progressReporterModule,
            'default',
        ).mockImplementation(() => ({
            done() {
                progressDoneCount += 1
            },
            report(event: unknown) {
                progressReports.push(event)
            },
        }))

        return { extractorSpy, progressSpy }
    }

    it('skips rebuild when confirmation returns false', async () => {
        resetState()
        confirmResult = false
        const { extractorSpy, progressSpy } = installExtractorSpies()
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const stdinSpy = spyOn(terminal, 'stdinIsInteractive').mockReturnValue(
            true,
        )
        const stderrSpy = spyOn(
            terminal,
            'stderrIsInteractive',
        ).mockReturnValue(true)

        try {
            await (await createCommand()).handle()
            expect(extractorCalls).toEqual([])
            expect(progressReports).toEqual([])
            expect(progressDoneCount).toBe(0)
            expect(confirmCalls).toEqual([
                {
                    default: true,
                    message:
                        'Rebuild derived memory for this project? Durable memories and diary entries are preserved.',
                },
            ])
            expect(logSpy).toHaveBeenCalledWith(
                JSON.stringify(
                    { mode: 'rebuild', ok: false, skipped: true },
                    null,
                    2,
                ),
            )
        } finally {
            extractorSpy.mockRestore()
            progressSpy.mockRestore()
            stdinSpy.mockRestore()
            stderrSpy.mockRestore()
            logSpy.mockRestore()
        }
    })

    it('rebuilds the current project and prints rebuild mode output', async () => {
        resetState()
        extractedResponse = {
            deletedFilePaths: [],
            detectedParserLanguages: ['typescript'],
            embeddedCount: 3,
            embeddingReusedCount: 1,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 2,
            languageCount: 1,
            loadedParserCount: 1,
            mode: 'rebuild',
            ok: true,
            projectRoot: '/tmp/project',
            sectionCount: 4,
            summaryRef: 'objects/summary.toon',
            technologies: ['typescript'],
            updatedFilePaths: ['src/index.ts'],
            vectorCount: 4,
        }
        const { extractorSpy, progressSpy } = installExtractorSpies()
        const logSpy = spyOn(terminal, 'log').mockImplementation(() => {})
        const stdinSpy = spyOn(terminal, 'stdinIsInteractive').mockReturnValue(
            false,
        )
        const stderrSpy = spyOn(
            terminal,
            'stderrIsInteractive',
        ).mockReturnValue(false)

        try {
            await (await createCommand()).handle()
            expect(extractorCalls).toEqual([
                { mode: 'rebuild', projectRoot: process.cwd() },
            ])
            expect(progressReports).toEqual([
                { message: 'complete', phase: 'done', status: 'done' },
            ])
            expect(progressDoneCount).toBe(1)
            expect(logSpy).toHaveBeenCalledWith(
                JSON.stringify(
                    {
                        ...extractedResponse,
                        mode: 'rebuild',
                    },
                    null,
                    2,
                ),
            )
        } finally {
            extractorSpy.mockRestore()
            progressSpy.mockRestore()
            stdinSpy.mockRestore()
            stderrSpy.mockRestore()
            logSpy.mockRestore()
        }
    })
})
