import { describe, expect, it } from 'bun:test'
import rebuildModuleArtifacts from './rebuild-module-artifacts'

describe('providers/extraction/engine/module-store', () => {
    it('matches the public runtime contract', () => {
        const cases = [
            ['rebuildModuleArtifacts', rebuildModuleArtifacts, 'function'],
        ] as const

        expect(cases.map(([name]) => name)).toEqual(['rebuildModuleArtifacts'])
        for (const [name, value, kind] of cases) {
            expect(typeof value, name).toBe(kind)
        }
    })
})
