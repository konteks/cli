import { createHash } from 'node:crypto'

export function contentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
}

export function contentAddressPath(hash: string, extension: string): string {
    return `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash}.${extension}`
}
