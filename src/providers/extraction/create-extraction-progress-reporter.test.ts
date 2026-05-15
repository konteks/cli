import { describe, expect, it } from 'bun:test'
import createExtractionProgressReporter from './create-extraction-progress-reporter'

describe('providers/extraction/progress-reporter', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            [
                'createExtractionProgressReporter',
                createExtractionProgressReporter,
                'function',
            ],
        ] as const

        expect(cases.map(([name]) => name)).toEqual([
            'createExtractionProgressReporter',
        ])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
