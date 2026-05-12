import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GlobalCliOptions } from '@/app/models/cli'
import { loadProjectContext, pathExists } from '@/app/providers/project/context'
import { callKonteksTool, listKonteksTools } from '@/composition/mcp-surface'
import { replaceStringDeep } from '@/support/object/value'

export { callKonteksTool, listKonteksTools }

export async function dryRunKonteksTool(
    options: GlobalCliOptions,
    name: string,
    input: unknown,
): Promise<unknown> {
    const context = await loadProjectContext(options.project)
    const tempRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-dry-run-'))
    const tempMemoryDir = join(tempRoot, '.konteks')

    try {
        if (await pathExists(context.memoryDir)) {
            await cp(context.memoryDir, tempMemoryDir, { recursive: true })
        }

        const result = await callKonteksTool(
            { memoryDir: tempMemoryDir, project: options.project },
            name,
            input,
        )
        return replaceStringDeep(result, tempMemoryDir, context.memoryDir)
    } finally {
        await rm(tempRoot, { force: true, recursive: true })
    }
}
