import {
    aliasesForPath,
    deleteEntityGraph,
    entityIdFor,
    findEntityMatchesByAliasValues,
    type GraphEntityType,
    type GraphRelationPredicate,
    normalizeEntityAlias,
    upsertEntity,
    upsertEntityAliases,
    upsertRelation,
} from '@/database/services/graph'
import type { ObservationKind } from '@/types/memory'

type EvidenceCandidate = {
    confidence: number
    field: 'content' | 'source' | 'subject' | 'summary' | 'tag'
    value: string
}

type DurableProjectionTarget = {
    confidence: number
    evidenceFields: Set<EvidenceCandidate['field']>
    evidenceValues: Set<string>
    id: string
}

const ATTACHABLE_ENTITY_TYPES: GraphEntityType[] = [
    'module',
    'file',
    'symbol',
    'package',
    'command',
    'config',
    'doc',
]

export async function projectMemoryToGraph(input: {
    content: string
    id: string
    kind: ObservationKind
    source?: string
    summary?: string
    tags?: string[]
}): Promise<void> {
    const entity = await upsertEntity({
        canonicalName: input.id,
        name: `${input.kind}:${input.id}`,
        properties: {
            id: input.id,
            kind: input.kind,
            origin: 'durable_memory',
            source: input.source,
            targetType: 'memory',
        },
        summary: input.summary,
        type: 'memory',
    })

    await upsertEntityAliases(
        entity.id,
        memoryAliases({
            id: input.id,
            kind: input.kind,
            source: input.source,
            tags: input.tags,
        }),
    )

    await attachDurableEntity({
        candidates: memoryEvidenceCandidates(input),
        durableEntityId: entity.id,
        durableId: input.id,
        durableType: 'memory',
        predicate: input.kind === 'constraint' ? 'applies_to' : 'concerns',
    })
}

export async function projectDiaryToGraph(input: {
    id: string
    subject?: string
    summary: string
    tags?: string[]
}): Promise<void> {
    const entity = await upsertEntity({
        canonicalName: input.id,
        name: input.subject ?? input.id,
        properties: {
            id: input.id,
            origin: 'durable_memory',
            targetType: 'diary',
        },
        summary: input.summary,
        type: 'diary',
    })

    await upsertEntityAliases(
        entity.id,
        diaryAliases({
            id: input.id,
            subject: input.subject,
            tags: input.tags,
        }),
    )

    await attachDurableEntity({
        candidates: diaryEvidenceCandidates(input),
        durableEntityId: entity.id,
        durableId: input.id,
        durableType: 'diary',
        predicate: 'concerns',
    })
}

export async function deleteDurableTargetGraph(
    targetId: string,
): Promise<void> {
    if (targetId.startsWith('diary_')) {
        await deleteEntityGraph(entityIdFor('diary', targetId))
        return
    }

    await deleteEntityGraph(entityIdFor('memory', targetId))
}

async function attachDurableEntity(input: {
    candidates: EvidenceCandidate[]
    durableEntityId: string
    durableId: string
    durableType: 'diary' | 'memory'
    predicate: GraphRelationPredicate
}): Promise<void> {
    const targetMatches = await findEntityMatchesByAliasValues(
        input.candidates.map(candidate => candidate.value),
        { types: ATTACHABLE_ENTITY_TYPES },
    )
    if (targetMatches.length === 0) {
        return
    }

    const candidatesByValue = new Map(
        input.candidates.map(candidate => [
            normalizeCandidateValue(candidate.value),
            candidate,
        ]),
    )
    const targets = new Map<string, DurableProjectionTarget>()

    for (const match of targetMatches) {
        if (match.id === input.durableEntityId) {
            continue
        }

        const matched = candidatesByValue.get(match.normalizedAlias)
        const candidate = matched ?? strongestCandidate(input.candidates)
        const existing = targets.get(match.id)
        const next = existing ?? {
            confidence: 0,
            evidenceFields: new Set<EvidenceCandidate['field']>(),
            evidenceValues: new Set<string>(),
            id: match.id,
        }

        next.confidence = Math.max(next.confidence, candidate.confidence)
        next.evidenceFields.add(candidate.field)
        next.evidenceValues.add(candidate.value)
        targets.set(match.id, next)
    }

    for (const target of targets.values()) {
        await upsertRelation({
            confidence: target.confidence,
            evidenceKey: `${input.durableId}:${target.id}`,
            objectId: target.id,
            predicate: input.predicate,
            properties: {
                durableId: input.durableId,
                durableType: input.durableType,
                evidenceFields: [...target.evidenceFields].sort(),
                evidenceValues: [...target.evidenceValues].sort(),
                origin: 'durable_memory',
            },
            subjectId: input.durableEntityId,
        })
    }
}

function memoryAliases(input: {
    id: string
    kind: ObservationKind
    source?: string
    tags?: string[]
}): string[] {
    return [
        input.id,
        `memory#${input.id}`,
        input.kind,
        input.source,
        ...(input.source ? aliasesForPath(input.source) : []),
        ...(input.tags ?? []),
    ].filter((value): value is string => Boolean(value))
}

function diaryAliases(input: {
    id: string
    subject?: string
    tags?: string[]
}): string[] {
    return [
        input.id,
        `diary#${input.id}`,
        input.subject,
        input.subject ? `diary#${input.subject}` : undefined,
        ...(input.tags ?? []),
    ].filter((value): value is string => Boolean(value))
}

function memoryEvidenceCandidates(input: {
    content: string
    source?: string
    tags?: string[]
}): EvidenceCandidate[] {
    return dedupeCandidates([
        ...sourceCandidates(input.source),
        ...tagCandidates(input.tags),
        ...textCandidates(input.content, 'content', 0.7),
    ])
}

function diaryEvidenceCandidates(input: {
    subject?: string
    summary: string
    tags?: string[]
}): EvidenceCandidate[] {
    return dedupeCandidates([
        ...textCandidates(input.subject ?? '', 'subject', 0.8),
        ...tagCandidates(input.tags),
        ...textCandidates(input.summary, 'summary', 0.7),
    ])
}

function sourceCandidates(source: string | undefined): EvidenceCandidate[] {
    if (!source) {
        return []
    }

    return [source, ...aliasesForPath(source)].map(value => ({
        confidence: 1,
        field: 'source' as const,
        value,
    }))
}

function tagCandidates(tags: string[] | undefined): EvidenceCandidate[] {
    return (tags ?? [])
        .filter(tag => tag.trim().length >= 2)
        .map(value => ({
            confidence: 0.8,
            field: 'tag' as const,
            value,
        }))
}

function textCandidates(
    text: string,
    field: 'content' | 'subject' | 'summary',
    confidence: number,
): EvidenceCandidate[] {
    if (!text) {
        return []
    }

    return [...backtickedValues(text), ...pathLikeValues(text)].map(value => ({
        confidence,
        field,
        value,
    }))
}

function backtickedValues(text: string): string[] {
    return [...text.matchAll(/`([^`]{2,120})`/gu)].map(match => match[1] ?? '')
}

function pathLikeValues(text: string): string[] {
    return [...text.matchAll(PATH_LIKE_PATTERN)].map(match => match[1] ?? '')
}

const PATH_LIKE_PATTERN =
    /(?:^|[\s("'=])([A-Za-z0-9_.@/-]+\/[A-Za-z0-9_.@/-]+|[A-Za-z0-9_.@/-]+\.(?:css|go|html|js|json|jsx|md|mdx|py|rs|scss|sql|toml|ts|tsx|txt|yaml|yml)(?:#[A-Za-z0-9_$.-]+)?)/gu

function dedupeCandidates(
    candidates: EvidenceCandidate[],
): EvidenceCandidate[] {
    const seen = new Set<string>()
    const unique: EvidenceCandidate[] = []

    for (const candidate of candidates) {
        const value = candidate.value.trim()
        const key = normalizeCandidateValue(value)
        if (!value || !key || seen.has(key)) {
            continue
        }
        seen.add(key)
        unique.push({ ...candidate, value })
    }

    return unique
}

function strongestCandidate(
    candidates: EvidenceCandidate[],
): EvidenceCandidate {
    return candidates.reduce((strongest, candidate) =>
        candidate.confidence > strongest.confidence ? candidate : strongest,
    )
}

function normalizeCandidateValue(value: string): string {
    return normalizeEntityAlias(value)
}
