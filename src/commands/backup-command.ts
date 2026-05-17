import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { BaseCommandInput } from '@/commands/_base-command'
import BaseCommand from '@/commands/_base-command'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import CliUserError from '@/support/cli/cli-user-error'
import { stringifyPretty } from '@/support/json/io'
import { createTarGz } from '@/support/targz'

export default class BackupCommand extends BaseCommand<[string]> {
    public override readonly args = [
        {
            description: 'Output .tar.gz file',
            name: '<file>',
        },
    ]
    public readonly description = 'Create a full .konteks backup archive.'
    public readonly name = 'backup'

    public async handle({
        args,
    }: Required<BaseCommandInput<[string]>>): Promise<void> {
        const context = await loadProjectContext()
        if (!(await pathExists(context.memoryDir))) {
            throw new CliUserError({
                command: 'konteks init',
                message: 'No Konteks memory directory exists for this project.',
                title: 'Cannot create backup',
            })
        }

        const outputPath = resolve(args[0])
        await mkdir(dirname(outputPath), { recursive: true })
        await createTarGz(context.memoryDir, outputPath)

        return this.print(stringifyPretty(outputPath))
    }
}
