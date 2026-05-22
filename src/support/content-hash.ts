import { createHash } from 'node:crypto'

export default function contentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
}
