export type TargetKind = 'section' | 'diary_entry' | 'observation' | 'relation'

export type ForgetTarget = {
    id: string
    kind: TargetKind
}
