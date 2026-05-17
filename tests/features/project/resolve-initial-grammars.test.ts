import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { terminal } from '@/support/terminal/service'

const tempDirs: string[] = []
const checkboxCalls: unknown[] = []

mock.module('@inquirer/prompts', () => ({
    checkbox: async (options: unknown) => {
        checkboxCalls.push(options)
        return ['typescript', 'tsx']
    },
    confirm: async () => true,
    select: async () => 'grammars',
}))

afterEach(async () => {
    checkboxCalls.splice(0)
    mock.restore()
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('project/grammars', () => {
    it('returns no grammars when prompting is unavailable', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(false)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(false)

        const resolveInitialGrammars = await loadResolver()
        await expect(resolveInitialGrammars('/tmp/project')).resolves.toEqual(
            [],
        )
    })

    it('detects project grammars and prompts with unique grammar ids', async () => {
        spyOn(terminal, 'stdinIsInteractive').mockReturnValue(true)
        spyOn(terminal, 'stderrIsInteractive').mockReturnValue(true)
        const projectRoot = await makeProject()
        await writeFile(join(projectRoot, 'src', 'index.ts'), 'export {}\n')
        await writeFile(join(projectRoot, 'src', 'app.tsx'), 'export {}\n')
        await writeFile(join(projectRoot, 'README.md'), '# Fixture\n')

        const resolveInitialGrammars = await loadResolver()
        await expect(resolveInitialGrammars(projectRoot)).resolves.toEqual([
            'typescript',
            'tsx',
        ])

        const choices = (
            checkboxCalls[0] as {
                choices: Array<{ checked: boolean; name: string; value: string }>
            }
        ).choices
        expect(choices.map(choice => choice.value)).toContain('typescript')
        expect(choices.map(choice => choice.value)).toContain('tsx')
        expect(choices.map(choice => choice.value)).not.toContain('markdown')
    })
})

async function makeProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-grammars-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, 'src'), { recursive: true })
    await writeFile(join(projectRoot, 'package.json'), '{"name":"fixture"}\n')
    return projectRoot
}

async function loadResolver() {
    const { default: resolveInitialGrammars } = await import(
        '@/project/resolve-initial-grammars'
    )
    return resolveInitialGrammars
}
