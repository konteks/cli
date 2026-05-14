import { describe, expect, it } from 'bun:test'
import {
    chunks,
    diaryEntries,
    embeddings,
    entities,
    entityAliases,
    memoryEvents,
    memoryFtsIndexed,
    minedSuppressions,
    modules,
    observations,
    relations,
    retrievalDocuments,
    sources,
    targetEmbeddings,
    taxonomyLinks,
    taxonomyNodes,
} from './schema'

describe('providers/persistence/sqlite/schema', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['chunks', chunks, 'object'],
            ['diaryEntries', diaryEntries, 'object'],
            ['embeddings', embeddings, 'object'],
            ['entities', entities, 'object'],
            ['entityAliases', entityAliases, 'object'],
            ['memoryEvents', memoryEvents, 'object'],
            ['memoryFtsIndexed', memoryFtsIndexed, 'object'],
            ['minedSuppressions', minedSuppressions, 'object'],
            ['modules', modules, 'object'],
            ['observations', observations, 'object'],
            ['relations', relations, 'object'],
            ['retrievalDocuments', retrievalDocuments, 'object'],
            ['sources', sources, 'object'],
            ['targetEmbeddings', targetEmbeddings, 'object'],
            ['taxonomyLinks', taxonomyLinks, 'object'],
            ['taxonomyNodes', taxonomyNodes, 'object'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'chunks',
            'diaryEntries',
            'embeddings',
            'entities',
            'entityAliases',
            'memoryEvents',
            'memoryFtsIndexed',
            'minedSuppressions',
            'modules',
            'observations',
            'relations',
            'retrievalDocuments',
            'sources',
            'targetEmbeddings',
            'taxonomyLinks',
            'taxonomyNodes',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
