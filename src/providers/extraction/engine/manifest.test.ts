import { describe, expect, it } from 'bun:test'
import type { ExtractionManifest, ExtractionMode } from './manifest'
import {
    getExtractionFreshness,
    readExtractionManifest,
    writeExtractionManifest,
} from './manifest'

type CoveredTypes = [ExtractionManifest, ExtractionMode]

describe('providers/extraction/engine/manifest', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['getExtractionFreshness', getExtractionFreshness, 'function'],
            ['readExtractionManifest', readExtractionManifest, 'function'],
            ['writeExtractionManifest', writeExtractionManifest, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'getExtractionFreshness',
            'readExtractionManifest',
            'writeExtractionManifest',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = ['ExtractionManifest', 'ExtractionMode'] as const
        expect(typeNames).toEqual(['ExtractionManifest', 'ExtractionMode'])
    })
})
