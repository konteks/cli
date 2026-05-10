import { describe, expect, it } from 'bun:test'
import {
    createIgnoreMatcher,
    shouldIgnoreRelativePath,
} from './ignore-rules.js'

describe('mining ignore rules', () => {
    it('skips dependency, build, memory, secret, and binary paths', () => {
        expect(shouldIgnoreRelativePath('node_modules/pkg/index.js')).toBe(true)
        expect(shouldIgnoreRelativePath('dist/index.js')).toBe(true)
        expect(shouldIgnoreRelativePath('.konteks/config.json')).toBe(true)
        expect(shouldIgnoreRelativePath('.env.local')).toBe(true)
        expect(shouldIgnoreRelativePath('certs/prod.pem')).toBe(true)
        expect(shouldIgnoreRelativePath('assets/logo.png')).toBe(true)
        expect(shouldIgnoreRelativePath('bun.lock')).toBe(true)
        expect(shouldIgnoreRelativePath('src/generated/client.ts')).toBe(true)
        expect(shouldIgnoreRelativePath('public/app.min.js')).toBe(true)
    })

    it('keeps source and documentation paths', () => {
        expect(shouldIgnoreRelativePath('src/index.ts')).toBe(false)
        expect(shouldIgnoreRelativePath('README.md')).toBe(false)
        expect(shouldIgnoreRelativePath('package.json')).toBe(false)
    })

    it('respects gitignore patterns and negation', () => {
        const matcher = createIgnoreMatcher({
            gitignore: 'tmp/\n*.log\n!important.log\n/build-output\n',
        })

        expect(matcher.ignores('tmp/cache.txt')).toBe(true)
        expect(matcher.ignores('logs/debug.log')).toBe(true)
        expect(matcher.ignores('important.log')).toBe(false)
        expect(matcher.ignores('build-output/app.js')).toBe(true)
        expect(matcher.ignores('src/index.ts')).toBe(false)
    })

    it('uses .konteksignore as extra exclusions only', () => {
        const matcher = createIgnoreMatcher({
            gitignore: 'ignored.md\n',
            konteksignore: 'docs/private/\n!ignored.md\n',
        })

        expect(matcher.ignores('ignored.md')).toBe(true)
        expect(matcher.ignores('docs/private/notes.md')).toBe(true)
        expect(matcher.ignores('docs/public/notes.md')).toBe(false)
    })
})
