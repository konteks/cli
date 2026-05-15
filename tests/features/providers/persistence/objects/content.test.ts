import { describe, expect, it } from 'bun:test'
import {
    contentAddressPath,
    contentHash,
} from '@/providers/persistence/objects/content'

describe('providers/persistence/objects/content', () => {
    it('hashes content with stable SHA-256 output', () => {
        expect(contentHash('konteks')).toBe(
            '1586d2d54364d9e25d335fb526f6dcfb2eea071633c912eddf7b1fec2effac28',
        )
        expect(contentHash('konteks')).toBe(contentHash('konteks'))
        expect(contentHash('konteks')).not.toBe(contentHash('other'))
    })

    it('creates a two-level content-addressed object path', () => {
        expect(contentAddressPath('abcdef123456', 'json')).toBe(
            'ab/cd/abcdef123456.json',
        )
    })
})
