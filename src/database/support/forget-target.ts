import type { ForgetInput } from '@/database/services/forget-memory'

export type ForgetResult = {
    accepted: boolean
    mode: NonNullable<ForgetInput['mode']>
    affectedIds: string[]
}

export type TargetKind = 'chunk' | 'diary_entry' | 'observation' | 'relation'

export type ForgetTarget = {
    id: string
    kind: TargetKind
}
