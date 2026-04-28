import { mineProject } from '../../mining/mine-project.js'
import { loadProjectContext } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'

type MineOptions = {
    changed?: boolean
}

export async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const context = await loadProjectContext(options.project)
    const mode = mineOptions.changed ? 'changed' : 'full'
    const result = await mineProject(context, mode)

    console.log(JSON.stringify(result, null, 2))
}
