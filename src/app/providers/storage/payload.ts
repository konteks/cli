import { contentHash } from './content'
import type { ToonStore } from './toon-store'

type StoredPayload = {
    contentHash: string
    contentInline?: string
    payloadRef?: string
    tokenCount: number
}

export async function storePayload(
    content: string,
    options: {
        inlineMaxBytes: number
        toonStore: ToonStore
    },
): Promise<StoredPayload> {
    const tokenCount = estimateTokenCount(content)
    const hash = contentHash(content)

    if (Buffer.byteLength(content, 'utf8') <= options.inlineMaxBytes) {
        return {
            contentHash: hash,
            contentInline: content,
            tokenCount,
        }
    }

    const object = await options.toonStore.write(content)
    return {
        contentHash: object.hash,
        payloadRef: object.ref,
        tokenCount,
    }
}

function estimateTokenCount(content: string): number {
    return Math.ceil(content.trim().split(/\s+/u).filter(Boolean).length * 1.33)
}
