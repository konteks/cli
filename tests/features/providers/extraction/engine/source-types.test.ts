import { describe, expect, it } from 'bun:test'
import { EXTRACTED_FILE_SOURCE_TYPE } from '@/modules/extraction/engine/source-types'

describe('providers/extraction/engine/source-types', () => {
    it('keeps the persisted extracted-file source type stable', () => {
        expect(EXTRACTED_FILE_SOURCE_TYPE).toBe('extracted_file')
    })
})
