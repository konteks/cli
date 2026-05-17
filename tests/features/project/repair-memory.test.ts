import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import * as extractorModule from '@/extraction/create-project-extractor'
import type { ExtractProjectResponse } from '@/models/extraction'
import * as progressReporterModule from '@/providers/extraction/create-extraction-progress-reporter'
import { terminal } from '@/support/terminal/service'

let confirmResult = true
let extractedResponse: ExtractProjectResponse = {
    chunkCount: 0,
    deletedFilePaths: [],
    embeddedCount: 0,
    embeddingReusedCount: 0,
    extractedAt: '2026-01-01T00:00:00.000Z',
    fileCount: 0,
    mode: 'reindex',
    ok: true,
    projectRoot: process.cwd(),
    summaryRef: 'objects/summary.json',
    technologies: [],
    updatedFilePaths: [],
}
const extractorCalls: unknown[] = []
const progressReports: unknown[] = []
let progressDoneCount = 0

mock.module('@inquirer/prompts', () => ({
    confirm: async () => confirmResult,
}))

afterEach(() => {
    mock.restore()
})

describe('RepairCommand', () => {
    const createCommand = async () => {
        const { default: RepairCommand } = await import(
            '@/commands/repair-command'
        )
        return new RepairCommand()
    }

    const resetState = () => {
        confirmResult = true
        extractedResponse = {
            chunkCount: 0,
            deletedFilePaths: [],
            embeddedCount: 0,
            embeddingReusedCount: 0,
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 0,
            mode: 'reindex',
            ok: true,
            projectRoot: process.cwd(),
            summaryRef: 'objects/summary.json',
            technologies: [],
            updatedFilePaths: [],
        }
        extractorCalls.length = 0
        progressReports.length = 0
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

    it('skips repair when confirmation returns false', async () => {
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
            expect(logSpy).toHaveBeenCalledWith(
                JSON.stringify(
                    { mode: 'repair', ok: false, skipped: true },
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

    it('reindexes the current project and prints repair mode output', async () => {
        resetState()
        extractedResponse = {
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
                { mode: 'reindex', projectRoot: process.cwd() },
            ])
            expect(progressReports).toEqual([
                { message: 'complete', phase: 'done', status: 'done' },
            ])
            expect(progressDoneCount).toBe(1)
            expect(logSpy).toHaveBeenCalledWith(
                JSON.stringify(
                    {
                        ...extractedResponse,
                        mode: 'repair',
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
