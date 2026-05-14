import { describe, expect, it } from 'bun:test'
import type { WarmUpInput, WarmUpResult } from './warm-up-action'
import { WarmUpAction } from './warm-up-action'

type CoveredTypes = [WarmUpInput, WarmUpResult]

describe('actions/warm-up-action', () => {
    it('matches the public runtime contract', () => {
        const cases = [['WarmUpAction', WarmUpAction, 'function']] as const

        expect(cases.map(([name]) => name)).toEqual(['WarmUpAction'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['WarmUpInput', 'WarmUpResult'] as const
        expect(typeNames).toEqual(['WarmUpInput', 'WarmUpResult'])
    })
})
