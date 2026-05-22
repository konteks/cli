import { describe, expect, it } from 'bun:test'
import formatProjectSummaryToon from '@/modules/extraction/engine/format-project-summary-toon'

describe('providers/extraction/engine/toon-summary', () => {
    it('formats project metadata and caps listed files', () => {
        const output = formatProjectSummaryToon({
            extractedAt: '2026-01-01T00:00:00.000Z',
            fileCount: 2,
            files: [
                {
                    contentHash: 'hash-a',
                    mtimeMs: 1,
                    path: 'src/a.ts',
                    sizeBytes: 10,
                },
                {
                    contentHash: 'hash-b',
                    mtimeMs: 2,
                    path: 'src/b.ts',
                    sizeBytes: 20,
                },
            ],
            metadata: {
                dependencies: ['zod'],
                devDependencies: ['typescript'],
                entryPoints: ['dist/main.js'],
                name: 'konteks',
                optionalDependencies: [],
                packageManager: 'bun',
                packageManifests: [
                    {
                        dependencies: ['zod'],
                        devDependencies: ['typescript'],
                        entryPoints: ['dist/main.js'],
                        manager: 'bun',
                        name: 'konteks',
                        path: 'package.json',
                        technologies: ['typescript'],
                    },
                ],
                packagePath: 'package.json',
                peerDependencies: [],
                readmeFiles: ['README.md'],
                scripts: ['test'],
                technologies: ['typescript'],
                workspaceGlobs: [],
                workspaceManager: undefined,
            },
            mode: 'full',
            projectRoot: '/repo',
        })

        expect(output).toContain('project:')
        expect(output).toContain('  root: /repo')
        expect(output).toContain('  name: konteks')
        expect(output).toContain('  package_manifests: package.json (bun)')
        expect(output).toContain('  dependencies: zod')
        expect(output).toContain('  - path: src/a.ts | bytes: 10')
    })
})
