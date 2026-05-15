import { describe, expect, it } from 'bun:test'
import {
    clampDepth,
    normalizeEntityName,
    tokenize,
    toPathSteps,
} from '@/providers/persistence/sqlite/stores/graph-utils'

describe('providers/persistence/sqlite/stores/graph-utils', () => {
    it('normalizes names and tokenizes graph search text', () => {
        expect(normalizeEntityName('  My   Entity  ')).toBe('my entity')
        expect(tokenize('Alpha alpha beta/gamma x')).toEqual([
            'alpha',
            'beta/gamma',
        ])
    })

    it.each([
        [-1, 1],
        [0, 1],
        [2.8, 2],
        [99, 5],
    ])('clamps depth %p to %p', (input, expected) => {
        expect(clampDepth(input)).toBe(expected)
    })

    it('converts comma-delimited path rows to graph path steps', () => {
        expect(
            toPathSteps({
                entity_path: 'a,b,c',
                predicate_path: 'uses,imports',
                relation_path: 'r1,r2',
            }),
        ).toEqual([
            {
                depth: 1,
                fromEntityId: 'a',
                predicate: 'uses',
                relationId: 'r1',
                toEntityId: 'b',
            },
            {
                depth: 2,
                fromEntityId: 'b',
                predicate: 'imports',
                relationId: 'r2',
                toEntityId: 'c',
            },
        ])
    })
})
