import { describe, expect, it } from 'bun:test'
import searchMemory from './search-memory'

describe('memory/search', () => {
    it('exposes the search memory workflow entrypoint', () => {
        expect(typeof searchMemory).toBe('function')
    })
})
