import { describe, expect, it } from 'bun:test'
import {
    clearExtractedSections,
    clearExtractedSectionsForPaths,
    isExtractedSectionSuppressed,
} from './section-cleanup'

describe('providers/extraction/engine/section-cleanup', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['clearExtractedSections', clearExtractedSections, 'function'],
            [
                'clearExtractedSectionsForPaths',
                clearExtractedSectionsForPaths,
                'function',
            ],
            [
                'isExtractedSectionSuppressed',
                isExtractedSectionSuppressed,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'clearExtractedSections',
            'clearExtractedSectionsForPaths',
            'isExtractedSectionSuppressed',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
