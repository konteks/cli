import { readExtractionManifest } from '@/providers/extraction/engine/manifest'
import { projectDatabasePath } from '@/providers/persistence/sqlite/database'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import CliUserError from '@/support/cli/cli-user-error'

const uninitializedCliMessage = 'Project memory is missing or incomplete.'

function createUninitializedCliError(): CliUserError {
    return new CliUserError({
        command: 'konteks init',
        hint: 'Initialize this project, then retry your command.',
        message: uninitializedCliMessage,
        title: 'Konteks memory is not initialized',
    })
}

export default async function ensureCliProjectInitialized(): Promise<void> {
    const context = await loadProjectContext()

    if (!context.configExists) {
        throw createUninitializedCliError()
    }

    if (!(await readExtractionManifest(context.memoryDir))) {
        throw createUninitializedCliError()
    }

    if (!(await pathExists(projectDatabasePath(context)))) {
        throw createUninitializedCliError()
    }
}
