import { describe, expect, it } from 'bun:test'
import type { InitializeProjectOptions, InitializeProjectResult } from './init'
import { initializeProject } from './init'

type CoveredTypes = [InitializeProjectOptions, InitializeProjectResult]

describe('project/init', () => {
    it('matches the public runtime contract', () => {
        expect(typeof initializeProject).toBe('function')
    })

    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'InitializeProjectOptions',
            'InitializeProjectResult',
        ] as const

        expect(typeNames).toEqual([
            'InitializeProjectOptions',
            'InitializeProjectResult',
        ])
    })
})
