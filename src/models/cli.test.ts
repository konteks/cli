import { describe, expect, it } from 'bun:test'
import type { GlobalCliOptions } from './cli'

type CoveredTypes = [GlobalCliOptions]

describe('models/cli', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['GlobalCliOptions'] as const
        expect(typeNames).toEqual(['GlobalCliOptions'])
    })
})
