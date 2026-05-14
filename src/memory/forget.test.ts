import { describe, expect, it } from 'bun:test'
import { forgetMemory } from './forget'

describe('memory/forget', () => {
    it('exposes the forget memory workflow entrypoint', () => {
        expect(typeof forgetMemory).toBe('function')
    })
})
