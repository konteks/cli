import { describe, expect, it } from 'bun:test'
import SQLiteMemoryRepository from '@/database/repositories/sqlite-memory-repository'
import createMemoryRepository from '@/memory/create-memory-repository'
import type { Project } from '@/models/project'

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
