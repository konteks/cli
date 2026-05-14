import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StartMcpServerOptions } from '@/models/mcp'
import {
    type DryRunKonteksToolDependencies,
    dryRunKonteksTool,
} from './dry-run'

type CoveredTypes = [DryRunKonteksToolDependencies]

describe('mcp/dry-run', () => {
    it('calls tools against a copied temp memory dir and rewrites paths back', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-dry-run-'))
        const memoryDir = join(projectRoot, '.konteks')
        await mkdir(memoryDir, { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            '{"type":"module"}\n',
        )
        await writeFile(join(memoryDir, 'config.json'), '{}\n')

        let calledOptions: StartMcpServerOptions | undefined
        let tempMemoryExistedDuringCall = false
        const result = await dryRunKonteksTool(
            { project: projectRoot },
            'konteks_save',
            { type: 'diary' },
            {
                async callTool(options) {
                    calledOptions = options
                    tempMemoryExistedDuringCall = await fileExists(
                        join(options.memoryDir ?? '', 'config.json'),
                    )
                    return {
                        path: options.memoryDir,
                    }
                },
            },
        )

        expect(calledOptions?.memoryDir).not.toBe(memoryDir)
        expect(tempMemoryExistedDuringCall).toBe(true)
        expect(result).toEqual({ path: memoryDir })
        expect(await fileExists(calledOptions?.memoryDir ?? '')).toBe(false)
    })

    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        expect(['DryRunKonteksToolDependencies']).toEqual([
            'DryRunKonteksToolDependencies',
        ])
    })
})

async function fileExists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}
