import { dirname, join } from 'node:path'
import { mkdir, readFile, writeFile } from '@/services/file-manager'
import { contentAddressPath, contentHash } from './content'

type ToonObject = {
    hash: string
    path: string
    ref: string
}

export type ToonStore = {
    read(ref: string): Promise<string>
    write(content: string): Promise<ToonObject>
}

export function createToonStore(rootDir: string): ToonStore {
    return {
        async read(ref: string): Promise<string> {
            return readFile(join(rootDir, ref), 'utf8')
        },
        async write(content: string): Promise<ToonObject> {
            const hash = contentHash(content)
            const ref = join('objects', contentAddressPath(hash, 'toon'))
            const path = join(rootDir, ref)

            await mkdir(dirname(path), { recursive: true })
            await writeFile(path, content, { flag: 'wx' }).catch(error => {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error
                }
            })

            return {
                hash,
                path,
                ref,
            }
        },
    }
}
