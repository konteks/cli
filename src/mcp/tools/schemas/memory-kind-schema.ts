import z from 'zod'

const memoryKindSchema = z.enum([
    'blocker',
    'code_insight',
    'constraint',
    'decision',
    'fact',
    'note',
    'preference',
])

export default memoryKindSchema
