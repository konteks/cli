import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { mineProject } from '../../mining/mine-project.js'
import {
    createDefaultConfig,
    loadProjectContext,
} from '../../project/context.js'
import { ensureProjectDatabase } from '../../storage/database.js'
import type { GlobalCliOptions } from '../options.js'

export async function initCommand(options: GlobalCliOptions): Promise<void> {
    const context = await loadProjectContext(options.project)
    await mkdir(context.memoryDir, { recursive: true })
    await mkdir(join(context.memoryDir, 'objects'), { recursive: true })
    await mkdir(join(context.memoryDir, 'chunks'), { recursive: true })

    await writeFile(
        context.configPath,
        `${JSON.stringify(createDefaultConfig(context.projectRoot), null, 2)}\n`,
        { flag: 'wx' },
    ).catch(async error => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error
        }
    })
    await ensureProjectDatabase(await loadProjectContext(options.project))
    await ensureKonteksGitignore(context.projectRoot)
    const extraction = await mineProject(
        await loadProjectContext(options.project),
        'full',
    )

    console.log(`Initialized Konteks at ${context.memoryDir}`)
    console.log(
        `Extracted ${extraction.fileCount} files into ${extraction.chunkCount} sections`,
    )
}

export async function ensureKonteksGitignore(
    projectRoot: string,
): Promise<void> {
    const gitignorePath = join(projectRoot, '.gitignore')
    const existing = await readFile(gitignorePath, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return ''
        }

        throw error
    })

    if (hasKonteksIgnoreEntry(existing)) {
        return
    }

    const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : ''
    await writeFile(gitignorePath, `${existing}${prefix}.konteks/\n`)
}

function hasKonteksIgnoreEntry(content: string): boolean {
    return content
        .split(/\r?\n/)
        .map(line => line.trim())
        .some(line => line === '.konteks' || line === '.konteks/')
}
