import { describe, expect, it } from 'bun:test'
import { Command } from 'commander'
import BaseCommand, {
    type BaseCommandContext,
    type BaseCommandInput,
} from '@/commands/_base-command'

describe('BaseCommand', () => {
    it('passes arguments and command options to handle', async () => {
        const seen: BaseCommandInput<[string], { flag?: boolean }>[] = []
        class FixtureCommand extends BaseCommand<[string], { flag?: boolean }> {
            public override readonly args = [{ name: '<name>' }]
            public readonly description = 'Fixture command.'
            public readonly name = 'fixture'
            public override readonly options = [{ flags: '--flag' }]
            public override readonly usesInitializationGuard = false

            public handle(
                input: BaseCommandInput<[string], { flag?: boolean }>,
            ): void {
                seen.push(input)
            }
        }

        const program = new Command()
        new FixtureCommand().register(program, contextFor(program))

        await program.parseAsync(
            ['node', 'konteks', 'fixture', 'value', '--flag'],
            {
                from: 'node',
            },
        )

        expect(seen).toEqual([
            {
                args: ['value'],
                options: { flag: true },
            },
        ])
    })

    it('runs initialization before project commands', async () => {
        let ranInitialization = false
        class FixtureCommand extends BaseCommand {
            public readonly description = 'Fixture command.'
            public readonly name = 'fixture'

            public handle(): void {}
        }

        const program = new Command()
        new FixtureCommand().register(program, {
            runInitializationGuard: async () => {
                ranInitialization = true
            },
        })

        await program.parseAsync(['node', 'konteks', 'fixture'], {
            from: 'node',
        })

        expect(ranInitialization).toBe(true)
    })

    it('registers child commands declared as properties', async () => {
        const seen: BaseCommandInput[] = []

        class ChildCommand extends BaseCommand {
            public readonly description = 'Child command.'
            public readonly name = 'child'
            public override readonly usesInitializationGuard = false

            public handle(input: BaseCommandInput): void {
                seen.push(input)
            }
        }

        class ParentCommand extends BaseCommand {
            public override readonly children = [new ChildCommand()]
            public readonly description = 'Parent command.'
            public readonly name = 'parent'
            public override readonly usesInitializationGuard = false

            public handle(): void {}
        }

        const program = new Command()
        new ParentCommand().register(program, contextFor(program))

        await program.parseAsync(['node', 'konteks', 'parent', 'child'], {
            from: 'node',
        })

        expect(seen).toEqual([
            {
                args: [],
                options: {},
            },
        ])
    })
})

function contextFor(_program: Command): BaseCommandContext {
    return {
        runInitializationGuard: async () => {},
    }
}
