import { resolveProjectContext } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'

type MineOptions = {
    changed?: boolean
}

export async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const context = await resolveProjectContext(options.project)
    const mode = mineOptions.changed ? 'changed' : 'full'
    console.log(
        JSON.stringify(
            {
                message:
                    'Mining is not implemented yet. This command is scaffolded for Phase 6.',
                mode,
                ok: false,
                projectRoot: context.projectRoot,
            },
            null,
            2,
        ),
    )
}
