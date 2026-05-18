import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { terminal } from '@/support/terminal/service'
import FakeEmbeddingProvider from '../../fake/fake-embedding-provider'

const checkboxCalls: unknown[] = []
let checkboxResult: string[] = []
const confirmCalls: unknown[] = []
let confirmResult = true

class MockHuggingFaceEmbeddingProvider extends FakeEmbeddingProvider {
    private readonly options?: {
        onProgress?: (event: {
            message: string
            phase: 'preparation'
            stage: 'prepare'
            status: 'progress'
        }) => void
    }

    public constructor(options?: {
        onProgress?: (event: {
            message: string
            phase: 'preparation'
            stage: 'prepare'
            status: 'progress'
        }) => void
    }) {
        super()
        this.options = options
    }

    public async prepare(): Promise<void> {
        this.options?.onProgress?.({
            message: 'Loading embedding model fake/all-MiniLM-L6-v2',
            phase: 'preparation',
            stage: 'prepare',
            status: 'progress',
        })
        this.options?.onProgress?.({
            message: 'Embedding model ready: fake/all-MiniLM-L6-v2',
            phase: 'preparation',
            stage: 'prepare',
            status: 'progress',
        })
    }
}

mock.module('@/providers/embeddings/hugging-face-embedding-provider', () => ({
    default: MockHuggingFaceEmbeddingProvider,
}))

mock.module('@inquirer/prompts', () => ({
    checkbox: async (options: unknown) => {
        checkboxCalls.push(options)
        return checkboxResult
    },
    confirm: async (options: unknown) => {
        confirmCalls.push(options)
        return confirmResult
    },
    select: async () => 'grammars',
}))

const tempDirs: string[] = []

async function makeTempProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-init-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')
    return projectRoot
}

afterEach(async () => {
    checkboxCalls.splice(0)
    checkboxResult = []
    confirmCalls.splice(0)
    confirmResult = true
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

async function withWorkingDirectory<T>(
    cwd: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(cwd)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

describe('InitCommand', () => {
    const init = async (project: string) =>
        await withWorkingDirectory(project, async () => {
            const output: string[] = []
            const logSpy = spyOn(terminal, 'log').mockImplementation(
                message => {
                    output.push(message)
                },
            )
            const errorSpy = spyOn(terminal, 'writeError').mockImplementation(
                message => {
                    output.push(message)
                },
            )

            try {
                const command = await createCommand()
                await command.handle()
            } finally {
                logSpy.mockRestore()
                errorSpy.mockRestore()
            }

            return output.join('\n')
        })

    it('adds .konteks to .gitignore during init', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('.konteks/\n')
    })

    it('preserves existing .gitignore entries', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(join(projectRoot, '.gitignore'), 'node_modules\n')

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('node_modules\n.konteks/\n')
    })

    it('does not duplicate existing .konteks ignore entries', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(
            join(projectRoot, '.gitignore'),
            'node_modules\n.konteks/\n',
        )

        await init(projectRoot)

        await expect(
            readFile(join(projectRoot, '.gitignore'), 'utf8'),
        ).resolves.toBe('node_modules\n.konteks/\n')
    })

    it('skips when the project is already initialized', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)
        const manifestPath = join(projectRoot, '.konteks', 'mine-manifest.json')
        const firstManifest = await readFile(manifestPath, 'utf8')

        await init(projectRoot)

        const secondManifest = await readFile(manifestPath, 'utf8')
        expect(secondManifest).toBe(firstManifest)
    })

    it('prints the redesigned init progress and summary', async () => {
        const projectRoot = await makeTempProject()

        const output = await init(projectRoot)

        const plainOutput = stripAnsi(output)

        expect(plainOutput).toContain('Initializing project memory')
        expect(plainOutput).toContain(
            '  ✓ 2 files scanned, 0 languages detected: none',
        )
        expect(plainOutput).toContain('  ✓ Extracted 2 semantic sections')
        expect(plainOutput).toContain('  ✓ Loaded 0 language parsers')
        expect(plainOutput).toContain('Loading embedding model')
        expect(plainOutput).toContain('Embedding model ready')
        expect(plainOutput).toContain('Building project memory...')
        expect(plainOutput).toContain('vectors indexed')
        expect(plainOutput).toContain('  ✓ Generated project summary')
        expect(plainOutput).toContain('Project memory ready')
        expect(plainOutput).toContain('  Files indexed      2')
        expect(plainOutput).toContain('  Sections extracted 2')
        expect(plainOutput).toContain('  Vectors indexed    5')
        expect(plainOutput).not.toContain('Initialized Konteks at')
        expect(plainOutput).not.toContain('Extracted 2 files into 2 sections')
    })

    it('colors init progress when color is supported', async () => {
        const projectRoot = await makeTempProject()
        const colorSpy = spyOn(terminal, 'stderrSupportsColor').mockReturnValue(
            true,
        )

        try {
            const output = await init(projectRoot)

            expect(output).toContain('\u001b[32m✓\u001b[0m')
            expect(output).toContain('\u001b[36mProject memory ready\u001b[0m')
        } finally {
            colorSpy.mockRestore()
        }
    })

    it('excludes bundled parser detections from the language review', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}')

        const output = await withInteractiveTerminal(() => init(projectRoot))
        const manifest = JSON.parse(
            await readFile(
                join(projectRoot, '.konteks', 'mine-manifest.json'),
                'utf8',
            ),
        )
        const config = JSON.parse(
            await readFile(
                join(projectRoot, '.konteks', 'config.json'),
                'utf8',
            ),
        )

        const plainOutput = stripAnsi(output)

        expect(plainOutput).toContain(
            '  2 files will be scanned, including bundled language: json',
        )
        expect(plainOutput).toContain('  0 languages detected: none')
        expect(plainOutput).not.toContain('Bundled required')
        expect(plainOutput).not.toContain('Detected languages: json')
        expect(plainOutput).not.toContain('✓ Detected 1 languages')
        expect(plainOutput).toContain('Preparing language parsers')
        expect(plainOutput).toContain('1/1 language parsers ready')
        expect(manifest.diagnostics.detectedParserLanguages).toEqual([])
        expect(config.extraction.grammars.selected).toEqual([])
        expect(confirmCalls).toHaveLength(0)
        expect(checkboxCalls).toHaveLength(0)
    })

    it('prints a skipped-file summary after deselecting detected languages', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(join(projectRoot, 'src.ts'), 'export const value = 1\n')
        confirmResult = false
        checkboxResult = []

        const output = await withInteractiveTerminal(() => init(projectRoot))

        const plainOutput = stripAnsi(output)

        expect(plainOutput).toContain(
            '  2 files will be scanned, including bundled languages: none',
        )
        expect(plainOutput).toContain('  1 language detected: typescript')
        expect(plainOutput).toContain('Scanned 2 files, 1 file skipped.')
    })

    it('opens registry grammar checkboxes when detected languages are rejected', async () => {
        const projectRoot = await makeTempProject()
        await writeFile(join(projectRoot, 'src.ts'), 'export const value = 1\n')
        confirmResult = false
        checkboxResult = []

        await withInteractiveTerminal(() => init(projectRoot))
        const config = JSON.parse(
            await readFile(
                join(projectRoot, '.konteks', 'config.json'),
                'utf8',
            ),
        )
        const choices = (
            checkboxCalls[0] as {
                choices: Array<{ checked: boolean; value: string }>
            }
        ).choices

        expect(confirmCalls).toHaveLength(1)
        expect(checkboxCalls).toHaveLength(1)
        expect(
            choices.find(choice => choice.value === 'typescript')?.checked,
        ).toBe(true)
        expect(config.extraction.grammars.selected).toEqual([])
    })

    it('finishes setup when a previous init stopped before extraction', async () => {
        const projectRoot = await makeTempProject()
        await mkdir(join(projectRoot, '.konteks'), { recursive: true })
        await writeFile(join(projectRoot, '.konteks', 'config.json'), '{}\n')

        await init(projectRoot)

        await expect(
            readFile(
                join(projectRoot, '.konteks', 'mine-manifest.json'),
                'utf8',
            ),
        ).resolves.toContain('"version": 1')
    })

    it('continues from existing sections when the manifest is missing', async () => {
        const projectRoot = await makeTempProject()

        await init(projectRoot)
        const manifestPath = join(projectRoot, '.konteks', 'mine-manifest.json')
        const firstManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        await rm(manifestPath)

        await init(projectRoot)

        const resumedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        expect(resumedManifest.diagnostics.chunkCount).toBe(
            firstManifest.diagnostics.chunkCount,
        )
        expect(
            resumedManifest.diagnostics.embeddingReusedCount,
        ).toBeGreaterThan(0)
        expect(resumedManifest.diagnostics.vectorCount).toBe(
            resumedManifest.diagnostics.embeddedCount +
                resumedManifest.diagnostics.embeddingReusedCount,
        )
    })
})

async function createCommand() {
    const { default: InitCommand } = await import('@/commands/init-command')
    return new InitCommand()
}

async function withInteractiveTerminal<T>(operation: () => Promise<T>) {
    const stdinSpy = spyOn(terminal, 'stdinIsInteractive').mockReturnValue(true)
    const stderrSpy = spyOn(terminal, 'stderrIsInteractive').mockReturnValue(
        true,
    )

    try {
        return await operation()
    } finally {
        stdinSpy.mockRestore()
        stderrSpy.mockRestore()
    }
}

function stripAnsi(value: string): string {
    const ansiPattern = new RegExp(
        `${String.fromCharCode(27)}\\[[0-9;]*m`,
        'gu',
    )
    return value.replaceAll(ansiPattern, '')
}
