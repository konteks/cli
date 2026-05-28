import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import searchEntities from '@/database/actions/search-entities'
import traverseNeighbors from '@/database/actions/traverse-neighbors'
import {
    entityIdFor,
    normalizeEntityAlias,
    upsertEntity,
    upsertEntityAliases,
    upsertRelation,
} from '@/database/services/graph'

import { mkdir, rm } from '@/support/file-manager'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map(path => rm(path)))
})

async function withProjectRoot<T>(operation: () => Promise<T>): Promise<T> {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-graph-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'))
    await writeFile(join(projectRoot, 'package.json'), '{"name":"graph"}\n')

    const previous = process.cwd()
    process.chdir(projectRoot)
    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

describe.serial('graph service', () => {
    it.serial('normalizes aliases and derives stable deterministic ids', () => {
        expect(normalizeEntityAlias('  RecallRepositoryMemory  ')).toBe(
            'recall repository memory',
        )
        expect(normalizeEntityAlias('src\\memory/save-memory.ts')).toBe(
            'src/memory/save memory.ts',
        )

        const entityId = entityIdFor('file', 'src/memory/save-memory.ts')
        expect(entityId).toBe(entityIdFor('file', 'src/memory/save_memory.ts'))
        expect(entityId).not.toBe(
            entityIdFor('symbol', 'src/memory/save-memory.ts'),
        )
    })

    it.serial('upserts entities and aliases idempotently', async () => {
        await withProjectRoot(async () => {
            const first = await upsertEntity({
                canonicalName: 'src/modules/memory/recall-repository-memory.ts',
                name: 'recall-repository-memory.ts',
                summary: 'Recall repository graph target.',
                type: 'file',
            })
            const second = await upsertEntity({
                canonicalName: 'src/modules/memory/recall-repository-memory.ts',
                name: 'recall-repository-memory.ts',
                summary: 'Updated recall repository graph target.',
                type: 'file',
            })

            expect(second.id).toBe(first.id)
            expect(second.summary).toBe(
                'Updated recall repository graph target.',
            )

            const aliases = await upsertEntityAliases(first.id, [
                'RecallRepositoryMemory',
                'recall repository memory',
                'recall-repository-memory',
                '  ',
            ])
            const repeatedAliases = await upsertEntityAliases(first.id, [
                'recall_repository_memory',
            ])

            expect(aliases).toHaveLength(1)
            expect(repeatedAliases).toHaveLength(1)
            expect(repeatedAliases[0]?.id).toBe(aliases[0]?.id)

            const matches = await searchEntities('repository memory', {
                limit: 5,
            })
            expect(matches.map(match => match.id)).toContain(first.id)
        })
    })

    it.serial('finds alias-backed entities from a larger alias set', async () => {
        await withProjectRoot(async () => {
            for (let index = 0; index < 75; index += 1) {
                const entity = await upsertEntity({
                    canonicalName: `fixture:${index}`,
                    name: `fixture-${index}`,
                    type: 'file',
                })
                await upsertEntityAliases(entity.id, [
                    `unrelated alias ${index}`,
                    `noise target ${index}`,
                ])
            }
            const target = await upsertEntity({
                canonicalName:
                    'src/database/actions/query-entity-search-rows.ts',
                name: 'query-entity-search-rows.ts',
                type: 'file',
            })
            await upsertEntityAliases(target.id, [
                'recall timeout entity search',
            ])

            const matches = await searchEntities('recall timeout', {
                limit: 5,
            })

            expect(matches.map(match => match.id)).toContain(target.id)
        })
    })

    it.serial('upserts relations idempotently and exposes them through traversal', async () => {
        await withProjectRoot(async () => {
            const moduleEntity = await upsertEntity({
                canonicalName: 'src',
                name: 'src',
                type: 'module',
            })
            const fileEntity = await upsertEntity({
                canonicalName: 'src/database/services/graph.ts',
                name: 'graph.ts',
                type: 'file',
            })
            const input = {
                evidenceKey: 'src/database/services/graph.ts',
                objectId: fileEntity.id,
                predicate: 'contains' as const,
                properties: { origin: 'test' },
                subjectId: moduleEntity.id,
            }
            const first = await upsertRelation(input)
            const second = await upsertRelation({
                ...input,
                confidence: 0.9,
            })

            expect(second.id).toBe(first.id)
            expect(second.confidence).toBe(0.9)

            const neighbors = await traverseNeighbors(moduleEntity.id, {
                limit: 10,
                maxDepth: 1,
            })
            expect(neighbors).toEqual([
                expect.objectContaining({
                    depth: 1,
                    direction: 'outgoing',
                    entity: expect.objectContaining({
                        id: fileEntity.id,
                        name: 'graph.ts',
                        type: 'file',
                    }),
                    predicate: 'contains',
                    relationId: first.id,
                }),
            ])
        })
    })
})
