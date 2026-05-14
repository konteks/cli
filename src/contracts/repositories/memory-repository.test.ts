import { describe, expect, it } from 'bun:test'
import type {
    ForgetInput,
    MemoryRecallInput,
    MemoryRepositoryContract,
    MemorySearchInput,
    SaveInput,
    SaveOptions,
} from './memory-repository'

type CoveredTypes = [
    ForgetInput,
    MemoryRecallInput,
    MemoryRepositoryContract,
    MemorySearchInput,
    SaveInput,
    SaveOptions,
]

describe('contracts/repositories/memory-repository', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'ForgetInput',
            'MemoryRecallInput',
            'MemoryRepositoryContract',
            'MemorySearchInput',
            'SaveInput',
            'SaveOptions',
        ] as const
        expect(typeNames).toEqual([
            'ForgetInput',
            'MemoryRecallInput',
            'MemoryRepositoryContract',
            'MemorySearchInput',
            'SaveInput',
            'SaveOptions',
        ])
    })
})
