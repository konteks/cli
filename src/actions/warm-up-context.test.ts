import { describe, expect, it } from 'bun:test'
import type { WarmUpContext } from '@/models/memory'
import { limitWarmUpContext } from './warm-up-context'

describe('actions/warm-up-context', () => {
    it('keeps stable project facts and trims large lists by token budget', () => {
        const context: WarmUpContext = {
            architecture: ['layer 1', 'layer 2', 'layer 3'],
            description: 'Project memory graph',
            entryPoints: ['src/main.ts'],
            guidance: [
                { id: 'g1', kind: 'constraint', text: 'Keep this rule.' },
                { id: 'g2', kind: 'decision', text: 'And this decision.' },
            ],
            highlights: [
                {
                    excerpt: 'Important source',
                    id: 'h1',
                    score: 100,
                    scoreDetails: {
                        importance: 80,
                        recency: 10,
                        role: 35,
                        tokenCostPenalty: 0,
                    },
                    tokenCost: 10,
                    type: 'module',
                },
            ],
            keyFiles: ['src/a.ts', 'src/b.ts'],
            summary: 'Konteks',
            taxonomy: [],
            technologies: ['bun', 'typescript'],
        }

        const limited = limitWarmUpContext(context, 80)

        expect(limited.summary).toBe('Konteks')
        expect(limited.technologies).toEqual(['bun', 'typescript'])
        expect(limited.architecture.length).toBeLessThanOrEqual(3)
        expect(limited.guidance).toEqual(context.guidance)
        expect(limited.highlights).toEqual(context.highlights)
    })
})
