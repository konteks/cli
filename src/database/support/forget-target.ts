export type TargetKind = 'chunk' | 'diary_entry' | 'observation' | 'relation'

export type ForgetTarget = {
    id: string
    kind: TargetKind
}
