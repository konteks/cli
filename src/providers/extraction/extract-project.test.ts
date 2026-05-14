import { describe, expect, it } from 'bun:test'
import { extractProject, KonteksExtractionEngine } from './extract-project'

describe('providers/extraction/extract-project', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['extractProject', extractProject, 'function'],
            ['KonteksExtractionEngine', KonteksExtractionEngine, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'extractProject',
            'KonteksExtractionEngine',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
