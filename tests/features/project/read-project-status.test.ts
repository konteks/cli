import { describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ProjectStatusReaderContract } from '@/contracts/services/project-status-reader'
import type { Project } from '@/models/project'
import readProjectStatus, {
    type ProjectStatus,
} from '@/project/read-project-status'

describe('project/status', () => {
    it('loads the current project and returns the status reader output', async () => {
        const projectRoot = await createConfiguredProject()
        const status: ProjectStatus = {
            configExists: true,
            databaseExists: true,
            databasePath: join(projectRoot, '.konteks/memory.db'),
            freshness: {
                changedFileCount: 0,
                reason: 'fresh',
                status: 'fresh',
            },
            memoryDir: join(projectRoot, '.konteks'),
            memoryDirExists: true,
            memoryStats: {
                diaryEntries: 0,
                embeddings: 0,
                events: 0,
                files: 0,
                memories: 0,
                modules: 0,
                retrievalDocuments: 0,
                sections: 0,
            },
            projectRoot,
        }
        const calls: Project[] = []
        const statusReader: ProjectStatusReaderContract = {
            async read(project) {
                calls.push(project)
                return status
            },
        }

        await expect(
            withWorkingDirectory(projectRoot, () =>
                readProjectStatus({ statusReader }),
            ),
        ).resolves.toBe(status)
        expect(calls).toEqual([
            {
                config: {
                    extraction: {
                        grammars: { selected: [], updateTtlHours: 24 },
                    },
                    recall: { maxTokens: 2000 },
                    storage: {
                        inlinePayloadMaxBytes: 2048,
                    },
                },
                configExists: true,
                configPath: join(projectRoot, '.konteks/config.json'),
                memoryDir: join(projectRoot, '.konteks'),
                projectRoot,
            },
        ])
    })
})

async function withWorkingDirectory<T>(
    cwd: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(cwd)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

async function createConfiguredProject(): Promise<string> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-status-'))
    const memoryDir = join(projectRoot, '.konteks')
    await writeFile(join(projectRoot, 'package.json'), '{"type":"module"}\n')
    await mkdir(memoryDir, { recursive: true })
    await writeFile(join(memoryDir, 'config.json'), '{}\n')
    return projectRoot
}
