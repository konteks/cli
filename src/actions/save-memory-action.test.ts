import { describe, expect, it } from 'bun:test'
import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import { SaveMemoryAction } from './save-memory-action'

describe('actions/save-memory-action', () => {
    it('passes save input and options to the repository', async () => {
        const input = {
            content: 'Remember this useful implementation detail.',
            kind: 'note' as const,
            type: 'memory' as const,
        }
        const options = {
            projectUpdate: {
                deletedFilePaths: [],
                updatedFilePaths: ['src/app.ts'],
            },
        }
        const result = { accepted: true, id: 'obs_1' }
        const calls: unknown[] = []
        const repository = {
            async save(...args: unknown[]) {
                calls.push(args)
                return result
            },
        } as unknown as MemoryRepositoryContract

        await expect(
            new SaveMemoryAction(repository).execute(input, options),
        ).resolves.toBe(result)
        expect(calls).toEqual([[input, options]])
    })
})
