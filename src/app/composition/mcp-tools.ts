import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GlobalCliOptions } from '@/app/controllers/cli/types'
import { callMcpTool, listMcpTools } from '@/app/controllers/mcp/serve'
import { loadProjectContext, pathExists } from '@/app/providers/project/context'
import { cp, mkdtemp, rm } from '@/app/support/file-manager'
import { replaceStringDeep } from '@/app/support/object'

export { callMcpTool as callKonteksTool, listMcpTools as listKonteksTools }

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
