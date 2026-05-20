import { describe, expect, it } from 'bun:test'
import { buildChunkRetrievalTexts } from '@/database/support/retrieval-texts'

describe('buildChunkRetrievalTexts', () => {
    it('keeps FTS and embedding text bounded', () => {
        const texts = buildChunkRetrievalTexts({
            anchor: 'largeSymbol',
            content: 'word '.repeat(5000),
            language: 'typescript',
            path: 'src/large.ts',
            sourceRole: 'app_code',
            summary: 'Large code chunk used to verify retrieval text bounds.',
            topics: ['large', 'retrieval', 'bounds'],
        })

        expect(texts.embeddingText.length).toBeLessThanOrEqual(2500)
        expect(texts.ftsText.length).toBeLessThanOrEqual(6000)
        expect(texts.embeddingText).toContain('path: src/large.ts#largeSymbol')
        expect(texts.ftsText).toContain('topics: large, retrieval, bounds')
    })
})
