import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import BaseCommand, {
    type BaseCommandContext,
    type BaseCommandInput,
} from './_base-command'

describe('BaseCommand', () => {
    it('passes arguments, command options, and global options to handle', async () => {
        const seen: BaseCommandInput<[string], { flag?: boolean }>[] = []
        class FixtureCommand extends BaseCommand<[string], { flag?: boolean }> {
            constructor() {
                super({
                    description: 'Fixture command.',
                    name: 'fixture',
                    requiresProject: false,
                })
            }

            protected override configure(command: Command): void {
                command.argument('<name>').option('--flag')
            }

            override handle(
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
            constructor() {
                super({
                    description: 'Fixture command.',
                    name: 'fixture',
                })
            }

            override handle(): void {}
        }

        const program = new Command().option('--project <path>')
        new FixtureCommand().register(program, {
            ensureInitialized: async project => {
                projects.push(project)
            },
            getGlobalOptions: () => program.opts(),
        })

        await program.parseAsync(
            ['node', 'konteks', '--project', '/repo', 'fixture'],
            { from: 'node' },
        )

        expect(projects).toEqual(['/repo'])
    })
})

function contextFor(program: Command): BaseCommandContext {
    return {
        ensureInitialized: async () => {},
        getGlobalOptions: () => program.opts(),
    }
}
