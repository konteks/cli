import { afterEach, describe, expect, it } from 'bun:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, rm } from '@/app/support/file-manager'
import { contentAddressPath, contentHash } from './content'
import { storePayload } from './payload'
import { createToonStore } from './toon-store'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
    const path = await mkdtemp(join(tmpdir(), 'konteks-store-'))
    tempDirs.push(path)
    return path
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('TOON store', () => {
    it('writes content-addressed objects', async () => {
        const root = await makeTempDir()
        const store = createToonStore(root)
        const content = 'kind: note\ntext: hello\n'

        const object = await store.write(content)

        expect(object.hash).toBe(contentHash(content))
        expect(object.ref).toBe(
            `objects/${contentAddressPath(contentHash(content), 'toon')}`,
        )
        expect(await store.read(object.ref)).toBe(content)
    })

    it('stores small payloads inline', async () => {
        const root = await makeTempDir()
        const payload = await storePayload('small text', {
            inlineMaxBytes: 2048,
            toonStore: createToonStore(root),
        })

        expect(payload.contentInline).toBe('small text')
        expect(payload.payloadRef).toBeUndefined()
    })

    it('stores large payloads as TOON objects', async () => {
        const root = await makeTempDir()
        const payload = await storePayload('large '.repeat(1000), {
            inlineMaxBytes: 32,
            toonStore: createToonStore(root),
        })

        expect(payload.contentInline).toBeUndefined()
        expect(payload.payloadRef).toMatch(
            /^objects\/[a-f0-9]{2}\/[a-f0-9]{2}\//u,
        )
    })
})
