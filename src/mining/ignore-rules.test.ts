import { describe, expect, it } from 'bun:test'
import { shouldIgnoreRelativePath } from './ignore-rules.js'

describe('mining ignore rules', () => {
    it('skips dependency, build, memory, secret, and binary paths', () => {
        expect(shouldIgnoreRelativePath('node_modules/pkg/index.js')).toBe(true)
        expect(shouldIgnoreRelativePath('dist/index.js')).toBe(true)
        expect(shouldIgnoreRelativePath('.konteks/config.json')).toBe(true)
        expect(shouldIgnoreRelativePath('.env.local')).toBe(true)
        expect(shouldIgnoreRelativePath('certs/prod.pem')).toBe(true)
        expect(shouldIgnoreRelativePath('assets/logo.png')).toBe(true)
    })

    it('keeps source and documentation paths', () => {
        expect(shouldIgnoreRelativePath('src/index.ts')).toBe(false)
        expect(shouldIgnoreRelativePath('README.md')).toBe(false)
        expect(shouldIgnoreRelativePath('package.json')).toBe(false)
    })
})
