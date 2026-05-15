import { describe, expect, it } from 'bun:test'
import resolveInitialGrammars from '@/project/resolve-initial-grammars'

describe('project/grammars', () => {
    it('returns unique grammar ids when all values are known', async () => {
        await expect(
            resolveInitialGrammars('/tmp/project', [
                'typescript',
                'typescript',
            ]),
        ).resolves.toEqual(['typescript'])
    })

    it('rejects unknown grammar ids before project initialization', async () => {
        await expect(
            resolveInitialGrammars('/tmp/project', ['typescript', 'not-real']),
        ).rejects.toThrow('Unknown grammar id: not-real')
    })
})
