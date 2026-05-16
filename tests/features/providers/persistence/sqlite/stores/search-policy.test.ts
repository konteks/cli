import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openProjectDatabase } from '@/providers/persistence/sqlite/database'
import searchMemory from '@/providers/persistence/sqlite/search-memory'
import { loadProjectContext } from '@/providers/project/context'

const tempDirs: string[] = []

async function makeAdapter() {
    const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-policy-test-'))
    tempDirs.push(projectRoot)
    await mkdir(join(projectRoot, '.git'), { recursive: true })
    return await withProjectRoot(projectRoot, async () =>
        openProjectDatabase(await loadProjectContext()),
    )
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

async function withProjectRoot<T>(
    projectRoot: string,
    operation: () => Promise<T>,
): Promise<T> {
    const previous = process.cwd()
    process.chdir(projectRoot)

    try {
        return await operation()
    } finally {
        process.chdir(previous)
    }
}

describe('search policy', () => {
    it('gates diary from recall when no continuity intent is present', async () => {
        const service = await makeAdapter()
        await service.adapter.execute(
            `
insert into diary_entries (id, subject, summary, tags_json, created_at)
values (?, ?, ?, ?, ?)
`,
            [
                'diary_test',
                'auth refactor',
                'Tried a failing approach for auth refactor.',
                '["auth"]',
                new Date().toISOString(),
            ],
        )
        const recall = await searchMemory(service, {
            task: 'auth refactor design',
        })
        const withContinuity = await searchMemory(service, {
            task: 'continue auth refactor after previous failed attempt',
        })

        expect(recall.some(item => item.id === 'diary_test')).toBe(false)
        expect(withContinuity.some(item => item.id === 'diary_test')).toBe(true)
        await service.close()
    })

    it('downranks agent references for recall unless query asks for agent context', async () => {
        const service = await makeAdapter()
        const adapter = service.adapter
        await adapter.execute(
            `
insert into retrieval_documents (
  target_id, target_type, source_id, source_role, path, anchor, summary,
  fts_text, fts_hash, embedding_text, embedding_hash, updated_at
) values (?, 'module', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                'module_app',
                'src_app',
                'app_code',
                'src/app',
                'src/app',
                'Core app module',
                'auth session refresh flow',
                'hash1',
                'auth session refresh flow',
                'eh1',
                new Date().toISOString(),
            ],
        )
        await adapter.execute(
            `
insert into retrieval_documents (
  target_id, target_type, source_id, source_role, path, anchor, summary,
  fts_text, fts_hash, embedding_text, embedding_hash, updated_at
) values (?, 'module', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                'module_agent_ref',
                'src_agent',
                'agent_reference',
                '.agents/skills',
                '.agents/skills',
                'Agent skill reference',
                'auth session refresh flow',
                'hash2',
                'auth session refresh flow',
                'eh2',
                new Date().toISOString(),
            ],
        )
        await adapter.execute(
            `
insert into retrieval_documents_fts (
  target_id, target_type, source_role, path, anchor, fts_text
) values (?, 'module', ?, ?, ?, ?)
`,
            [
                'module_app',
                'app_code',
                'src/app',
                'src/app',
                'auth session refresh flow',
            ],
        )
        await adapter.execute(
            `
insert into retrieval_documents_fts (
  target_id, target_type, source_role, path, anchor, fts_text
) values (?, 'module', ?, ?, ?, ?)
`,
            [
                'module_agent_ref',
                'agent_reference',
                '.agents/skills',
                '.agents/skills',
                'auth session refresh flow',
            ],
        )

        const normal = await searchMemory(service, {
            task: 'auth session refresh flow',
        })
        const agent = await searchMemory(service, {
            task: 'agent prompt auth session refresh flow',
        })

        expect(normal[0]?.id).toBe('module_app')
        expect(agent.some(item => item.id === 'module_agent_ref')).toBe(true)
        await service.close()
    })
})
