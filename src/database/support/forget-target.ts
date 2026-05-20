import type { ForgetInput } from '@/contracts/repositories/memory-repository'

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
