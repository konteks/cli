import { HuggingFaceEmbeddingProvider } from '../../mining/embedding-provider.js'
import { mineProject } from '../../mining/mine-project.js'
import { loadProjectContext } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'

type MineOptions = {
    changed?: boolean
    reindex?: boolean
}

export async function mineCommand(
    options: GlobalCliOptions,
    mineOptions: MineOptions,
): Promise<void> {
    const context = await loadProjectContext(options.project)
    if (mineOptions.changed && mineOptions.reindex) {
        throw new Error('Use either --changed or --reindex, not both.')
    }

    const mode = mineOptions.reindex
        ? 'reindex'
        : mineOptions.changed
          ? 'changed'
          : 'full'
    const result = await mineProject(context, mode, {
        embeddingProvider: new HuggingFaceEmbeddingProvider(),
    })

    console.log(JSON.stringify(result, null, 2))
}
