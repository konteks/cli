import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callMcpTool } from '@/app/controllers/mcp'
import type { GlobalCliOptions } from '@/app/dto/cli/options'
import { replaceStringDeep } from '@/app/services'
import { cp, mkdtemp, rm } from '@/app/services/file-manager'
import {
    loadProjectContext,
    pathExists,
} from '@/app/services/file-system/context'

export async function dryRunMcpTool(
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

        const result = await callMcpTool(
            { memoryDir: tempMemoryDir, project: options.project },
            name,
            input,
        )
        return replaceStringDeep(result, tempMemoryDir, context.memoryDir)
    } finally {
        await rm(tempRoot, { force: true, recursive: true })
    }
}
