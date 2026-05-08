import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { callMcpTool } from '../../mcp/server.js'
import { loadProjectContext, pathExists } from '../../project/context.js'
import type { GlobalCliOptions } from '../options.js'
import { isRecord } from './json-output.js'

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

function replaceStringDeep(value: unknown, from: string, to: string): unknown {
    if (typeof value === 'string') {
        return value.split(from).join(to)
    }

    if (Array.isArray(value)) {
        return value.map(item => replaceStringDeep(item, from, to))
    }

    if (isRecord(value)) {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                replaceStringDeep(item, from, to),
            ]),
        )
    }

    return value
}
