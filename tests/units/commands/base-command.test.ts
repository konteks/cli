import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import BaseCommand, {
    type BaseCommandContext,
    type BaseCommandInput,
} from '@/commands/_base-command'

describe('BaseCommand', () => {
    it('passes arguments, command options, and global options to handle', async () => {
        const seen: BaseCommandInput<[string], { flag?: boolean }>[] = []
        class FixtureCommand extends BaseCommand<[string], { flag?: boolean }> {
            override readonly args = [{ name: '<name>' }]
            readonly description = 'Fixture command.'
            readonly name = 'fixture'
            override readonly options = [{ flags: '--flag' }]
            override readonly usesInitializationGuard = false

            handle(
                input: BaseCommandInput<[string], { flag?: boolean }>,
            ): void {
                seen.push(input)
            }
        }

        const program = new Command().option('--project <path>')
        new FixtureCommand().register(program, contextFor(program))

        await program.parseAsync(
            [
                'node',
                'konteks',
                '--project',
                '/repo',
                'fixture',
                'value',
                '--flag',
            ],
            { from: 'node' },
        )

        expect(seen).toEqual([
            {
                args: ['value'],
                globalOptions: { project: '/repo' },
                options: { flag: true },
            },
        ])
    })

    it('runs initialization before project commands', async () => {
        const projects: (string | undefined)[] = []
        class FixtureCommand extends BaseCommand {
            readonly description = 'Fixture command.'
            readonly name = 'fixture'

            handle(): void {}
        }

        const program = new Command().option('--project <path>')
        new FixtureCommand().register(program, {
            getGlobalOptions: () => program.opts(),
            runInitializationGuard: async project => {
                projects.push(project)
            },
        })

        await program.parseAsync(
            ['node', 'konteks', '--project', '/repo', 'fixture'],
            { from: 'node' },
        )

        expect(projects).toEqual(['/repo'])
    })

    it('registers child commands declared as properties', async () => {
        const seen: BaseCommandInput[] = []

        class ChildCommand extends BaseCommand {
            readonly description = 'Child command.'
            readonly name = 'child'
            override readonly usesInitializationGuard = false

            handle(input: BaseCommandInput): void {
                seen.push(input)
            }
        }

        class ParentCommand extends BaseCommand {
            override readonly children = [new ChildCommand()]
            readonly description = 'Parent command.'
            readonly name = 'parent'
            override readonly usesInitializationGuard = false

            handle(): void {}
        }

        const program = new Command().option('--project <path>')
        new ParentCommand().register(program, contextFor(program))

        await program.parseAsync(
            ['node', 'konteks', '--project', '/repo', 'parent', 'child'],
            { from: 'node' },
        )

        expect(seen).toEqual([
            {
                args: [],
                globalOptions: { project: '/repo' },
                options: {},
            },
        ])
    })
})

function contextFor(program: Command): BaseCommandContext {
    return {
        getGlobalOptions: () => program.opts(),
        runInitializationGuard: async () => {},
    }
}
