import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
    loadProjectContext,
    pathExists,
} from '@/infrastructure/file-system/context.js'
import { replaceStringDeep } from '../../../utils/object.js'
import { callMcpTool } from '../../mcp/server.js'
import type { GlobalCliOptions } from '../options.js'

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
