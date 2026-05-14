import { describe, expect, it } from 'bun:test'
import type { ProjectStatusReaderContract } from '@/contracts/services/project-status-reader'
import type { Project } from '@/models/project'
import type { ProjectStatus } from './project-status-action'
import { ProjectStatusAction } from './project-status-action'

describe('actions/project-status-action', () => {
    it('reads status for the provided project', async () => {
        const project = makeProject()
        const status: ProjectStatus = {
            configExists: true,
            databaseExists: true,
            databasePath: '/tmp/project/.konteks/memory.db',
            freshness: {
                changedFileCount: 0,
                reason: 'fresh',
                status: 'fresh',
            },
            memoryDir: '/tmp/project/.konteks',
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
            projectRoot: '/tmp/project',
        }
        const reader: ProjectStatusReaderContract = {
            async read(value) {
                expect(value).toBe(project)
                return status
            },
        }

        await expect(
            new ProjectStatusAction(reader).execute(project),
        ).resolves.toBe(status)
    })
})

function makeProject(): Project {
    return {
        config: {
            extraction: { grammars: { selected: [], updateTtlHours: 24 } },
            projectRoot: '/tmp/project',
            recall: { maxTokens: 2000 },
            storage: {
                inlinePayloadMaxBytes: 1024,
                memoryDir: '.konteks',
            },
        },
        configExists: true,
        configPath: '/tmp/project/.konteks/config.json',
        memoryDir: '/tmp/project/.konteks',
        projectRoot: '/tmp/project',
    }
}
