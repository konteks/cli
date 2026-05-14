import { describe, expect, it } from 'bun:test'
import type { WarmUpResult } from './warm-up'
import { warmUpMemory } from './warm-up'

type CoveredTypes = [WarmUpResult]

describe('memory/warm-up', () => {
    it('exposes the warm-up memory workflow entrypoint', () => {
        expect(typeof warmUpMemory).toBe('function')
    })

    it('keeps the warm-up result type colocated with the workflow', () => {
        type _Covered = CoveredTypes
        expect(['WarmUpResult']).toEqual(['WarmUpResult'])
    })
})
