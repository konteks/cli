import { describe, expect, it } from 'bun:test'
import type { MemoryRepositoryContract } from '@/contracts/repositories/memory-repository'
import { ForgetMemoryAction } from './forget-memory-action'

describe('actions/forget-memory-action', () => {
    it('passes forget input to the repository and returns the result', async () => {
        const input = { id: 'obs_1', mode: 'soft_delete' as const }
        const result = {
            accepted: true,
            affectedIds: ['obs_1'],
            mode: 'soft_delete' as const,
        }
        const calls: unknown[] = []
        const repository = {
            async forget(value: unknown) {
                calls.push(value)
                return result
            },
        } as MemoryRepositoryContract

        await expect(
            new ForgetMemoryAction(repository).execute(input),
        ).resolves.toBe(result)
        expect(calls).toEqual([input])
    })
})
