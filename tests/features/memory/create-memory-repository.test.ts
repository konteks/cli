import { describe, expect, it } from 'bun:test'
import createMemoryRepository from '@/memory/create-memory-repository'
import type { Project } from '@/models/project'
import SQLiteMemoryRepository from '@/providers/persistence/sqlite/sqlite-memory-repository'

describe('memory/repository', () => {
    it('creates the SQLite-backed memory repository implementation', () => {
        const service = {} as ConstructorParameters<
            typeof SQLiteMemoryRepository
        >[0]
        const context = { projectRoot: '/tmp/project' } as Project

        expect(createMemoryRepository(service, context)).toBeInstanceOf(
            SQLiteMemoryRepository,
        )
    })
})
