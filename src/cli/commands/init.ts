import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
    createDefaultConfig,
    resolveProjectContext,
} from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'

export async function initCommand(options: GlobalCliOptions): Promise<void> {
    const context = await resolveProjectContext(options.project)
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

    console.log(`Initialized Konteks at ${context.memoryDir}`)
}
