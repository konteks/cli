import { describe, expect, it } from 'bun:test'
import createIgnoreMatcher from './create-ignore-matcher'

describe('extraction ignore rules', () => {
    it('skips dependency, build, memory, secret, and binary paths', () => {
        const matcher = createIgnoreMatcher({})

        expect(matcher.ignores('node_modules/pkg/index.js')).toBe(true)
        expect(matcher.ignores('dist/index.js')).toBe(true)
        expect(matcher.ignores('.konteks/config.json')).toBe(true)
        expect(matcher.ignores('.env.local')).toBe(true)
        expect(matcher.ignores('certs/prod.pem')).toBe(true)
        expect(matcher.ignores('assets/logo.png')).toBe(true)
        expect(matcher.ignores('bun.lock')).toBe(true)
        expect(matcher.ignores('src/generated/client.ts')).toBe(true)
        expect(matcher.ignores('public/app.min.js')).toBe(true)
    })

    it('keeps source and documentation paths', () => {
        const matcher = createIgnoreMatcher({})

        expect(matcher.ignores('src/index.ts')).toBe(false)
        expect(matcher.ignores('README.md')).toBe(false)
        expect(matcher.ignores('package.json')).toBe(false)
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
