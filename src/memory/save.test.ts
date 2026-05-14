import { describe, expect, it } from 'bun:test'
import { saveMemory } from './save'

describe('memory/save', () => {
    it('exposes the save memory workflow entrypoint', () => {
        expect(typeof saveMemory).toBe('function')
    })
})
