import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm } from '@/app/support/file-manager'
import { createCliProgram } from './program'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('CLI initialization middleware', () => {
    for (const args of [
        ['status'],
        ['repair'],
        ['install-skills'],
        ['mcp'],
        ['mcp', 'tools'],
        ['mcp', 'tool', 'konteks_warm_up'],
        ['mcp', 'prompts'],
        ['mcp', 'prompt', 'konteks-warm-up'],
        ['mcp', 'call', 'konteks_warm_up'],
    ]) {
        it(`blocks ${args.join(' ')} when project memory is not initialized`, async () => {
            const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-cli-'))
            tempDirs.push(projectRoot)
            let actionCalled = false
            const program = createCliProgram({
                handlers: blockedHandlers(() => {
                    actionCalled = true
                }),
            })

            await expect(
                program.parseAsync(['--project', projectRoot, ...args], {
                    from: 'user',
                }),
            ).rejects.toThrow('Konteks memory is not initialized')

            expect(actionCalled).toBe(false)
        })
    }

    it('allows init before project memory is initialized', async () => {
        let initializedProject: string | undefined
        let guardCalled = false
        const program = createCliProgram({
            ensureInitialized: async () => {
                guardCalled = true
            },
            handlers: {
                init: async options => {
                    initializedProject = options.project
                },
            },
        })

        await program.parseAsync(['--project', '/tmp/project', 'init'], {
            from: 'user',
        })

        expect(guardCalled).toBe(false)
        expect(initializedProject).toBe('/tmp/project')
    })

    it('runs commands after the initialization guard passes', async () => {
        let checkedProject: string | undefined
        let statusProject: string | undefined
        const program = createCliProgram({
            ensureInitialized: async project => {
                checkedProject = project
            },
            handlers: {
                getStatus: async options => {
                    statusProject = options.project
                },
            },
        })

        await program.parseAsync(['--project', '/tmp/project', 'status'], {
            from: 'user',
        })

        expect(checkedProject).toBe('/tmp/project')
        expect(statusProject).toBe('/tmp/project')
    })
})

function blockedHandlers(onAction: () => void) {
    const block = async () => {
        onAction()
    }

    return {
        callMcpTool: block,
        getPromptDetail: block,
        getPrompts: block,
        getStatus: block,
        getToolDetail: block,
        getTools: block,
        installSkills: block,
        repair: block,
        startMcpServer: block,
    }
}
