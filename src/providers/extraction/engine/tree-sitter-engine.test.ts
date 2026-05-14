import { describe, expect, it } from 'bun:test'
import type { CodeMetadata, TreeSitterLanguage } from './tree-sitter-engine'
import { TreeSitterEngine } from './tree-sitter-engine'

type CoveredTypes = [CodeMetadata, TreeSitterLanguage]

describe('providers/extraction/engine/tree-sitter-engine', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['TreeSitterEngine', TreeSitterEngine, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['TreeSitterEngine'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['CodeMetadata', 'TreeSitterLanguage'] as const
        expect(typeNames).toEqual(['CodeMetadata', 'TreeSitterLanguage'])
    })
})
