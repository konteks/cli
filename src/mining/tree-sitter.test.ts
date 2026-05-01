import { describe, expect, it } from 'bun:test'
import { chunkFile } from './chunking.js'
import { initTreeSitterWithBundledGrammars } from './grammar-loader.js'
import { TreeSitterEngine } from './tree-sitter-engine.js'

describe('TreeSitterEngine', () => {
    it('extracts symbols from typescript code', async () => {
        const engine = new TreeSitterEngine()
        await initTreeSitterWithBundledGrammars(engine)

        const code = `
            import { something } from './else'

            export interface User {
                id: string
                name: string
            }

            /**
             * Create a user
             */
            export function createUser(name: string): User {
                return { id: '1', name }
            }

            export class UserManager {
                private users: User[] = []

                addUser(user: User) {
                    this.users.push(user)
                }
            }

            type Status = 'active' | 'inactive'

            const internalVal = 42
        `

        const metadata = await engine.parse('test.ts', code)

        expect(metadata).toBeDefined()
        expect(metadata?.language).toBe('typescript')
        expect(metadata?.symbols).toContainEqual(
            expect.objectContaining({
                isExported: true,
                kind: 'interface',
                name: 'User',
            }),
        )
        expect(metadata?.symbols).toContainEqual(
            expect.objectContaining({
                isExported: true,
                kind: 'function',
                name: 'createUser',
            }),
        )
        expect(metadata?.symbols).toContainEqual(
            expect.objectContaining({
                isExported: true,
                kind: 'class',
                name: 'UserManager',
            }),
        )
        expect(metadata?.symbols).toContainEqual(
            expect.objectContaining({
                isExported: false,
                kind: 'type',
                name: 'Status',
            }),
        )
    })

    it('chunks code based on AST boundaries', async () => {
        const engine = new TreeSitterEngine()
        await initTreeSitterWithBundledGrammars(engine)

        const code = `
            export function first() { return 1 }
            export function second() { return 2 }
        `

        const chunks = await chunkFile(
            {
                contentHash: 'hash',
                mtimeMs: 0,
                path: 'test.ts',
                sizeBytes: 100,
            },
            code,
            engine,
        )

        expect(chunks.length).toBe(2)
        expect(chunks[0].anchor).toBe('first')
        expect(chunks[0].content).toContain('function first')
        expect(chunks[1].anchor).toBe('second')
        expect(chunks[1].content).toContain('function second')
    })

    it('falls back to heuristic when engine is missing or fails', async () => {
        const code = 'export const x = 1\nexport const y = 2'
        const chunks = await chunkFile(
            {
                contentHash: 'hash',
                mtimeMs: 0,
                path: 'test.ts',
                sizeBytes: 100,
            },
            code,
        )

        expect(chunks.length).toBe(2)
        expect(chunks[0].anchor).toBe('x')
        expect(chunks[1].anchor).toBe('y')
    })
})
