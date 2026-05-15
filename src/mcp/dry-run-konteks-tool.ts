import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { GlobalCliOptions } from '@/models/cli'
import type { StartMcpServerOptions } from '@/models/mcp'
import { loadProjectContext, pathExists } from '@/providers/project/context'
import { replaceStringDeep } from '@/support/object/value'
import { callKonteksTool } from './handlers'

export type DryRunKonteksToolDependencies = {
    callTool?: (
        options: StartMcpServerOptions,
        name: string,
        input: unknown,
    ) => Promise<unknown>
}

export default async function dryRunKonteksTool(
    options: GlobalCliOptions,
    name: string,
    input: unknown,
    dependencies: DryRunKonteksToolDependencies = {},
): Promise<unknown> {
    const context = await loadProjectContext(options.project)
    const tempRoot = await mkdtemp(join(tmpdir(), 'konteks-mcp-dry-run-'))
    const tempMemoryDir = join(tempRoot, '.konteks')
    const callTool = dependencies.callTool ?? callKonteksTool

    try {
        if (await pathExists(context.memoryDir)) {
            await cp(context.memoryDir, tempMemoryDir, { recursive: true })
        }

        const result = await callTool(
            { memoryDir: tempMemoryDir, project: options.project },
            name,
            input,
        )
        return replaceStringDeep(result, tempMemoryDir, context.memoryDir)
    } finally {
        await rm(tempRoot, { force: true, recursive: true })
    }
}
