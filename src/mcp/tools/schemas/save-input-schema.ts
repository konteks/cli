import z from 'zod'

function looksSensitive(content: string): boolean {
    return /(api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_./+=-]{12,}/iu.test(
        content,
    )
}

const saveTextSchema = z
    .string()
    .refine(val => !looksSensitive(val), {
        message: 'content appears to contain a secret',
    })
    .refine(val => val.trim().split(/\s+/u).filter(Boolean).length >= 4, {
        message: 'content is too short to save',
    })

export default saveTextSchema
