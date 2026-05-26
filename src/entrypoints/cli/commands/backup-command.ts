import { dirname, resolve } from 'node:path'
import { loadProjectContext, pathExists } from '@/modules/project/context'
import CliUserError from '@/support/cli/cli-user-error'
import { mkdir } from '@/support/file-manager'
import { createTarGz } from '@/support/targz'
import type { BaseCommandInput } from './_base-command'
import BaseCommand from './_base-command'
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
        await mkdir(dirname(outputPath))
        await createTarGz(context.memoryDir, outputPath)

        this.consoleOutput.print(outputPath)
    }
}
