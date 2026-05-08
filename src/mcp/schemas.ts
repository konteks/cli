import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const warmUpOutputSchema: Tool['outputSchema'] = {
    properties: {
        architecture: { items: { type: 'string' }, type: 'array' },
        constraints: { items: { type: 'string' }, type: 'array' },
        conventions: { items: { type: 'string' }, type: 'array' },
        description: { type: 'string' },
        durableDecisions: { items: { type: 'string' }, type: 'array' },
        entryPoints: { items: { type: 'string' }, type: 'array' },
        keyFiles: { items: { type: 'string' }, type: 'array' },
        project: { type: 'object' },
        recall: {
            properties: {
                brief: { items: { type: 'string' }, type: 'array' },
                memories: { items: { type: 'object' }, type: 'array' },
                primaryTargets: { items: { type: 'string' }, type: 'array' },
                quality: {
                    enum: ['strong', 'partial', 'weak'],
                    type: 'string',
                },
                sourceCount: { type: 'number' },
                task: { type: 'string' },
            },
            type: 'object',
        },
        summary: { type: 'string' },
        taxonomy: { items: { type: 'string' }, type: 'array' },
        technologies: { items: { type: 'string' }, type: 'array' },
    },
    required: [
        'summary',
        'technologies',
        'keyFiles',
        'architecture',
        'durableDecisions',
        'constraints',
        'conventions',
        'entryPoints',
        'taxonomy',
        'project',
    ],
    type: 'object',
}

export const recallOutputSchema: Tool['outputSchema'] = {
    properties: {
        brief: { items: { type: 'string' }, type: 'array' },
        graph: { items: { type: 'object' }, type: 'array' },
        history: { items: { type: 'object' }, type: 'array' },
        memories: { items: { type: 'object' }, type: 'array' },
        primaryTargets: { items: { type: 'string' }, type: 'array' },
        quality: { enum: ['strong', 'partial', 'weak'], type: 'string' },
        sourceCount: { type: 'number' },
        task: { type: 'string' },
        tokenBudget: { type: 'number' },
    },
    required: [
        'task',
        'tokenBudget',
        'brief',
        'primaryTargets',
        'quality',
        'sourceCount',
        'graph',
        'history',
        'memories',
    ],
    type: 'object',
}

export const searchOutputSchema: Tool['outputSchema'] = {
    properties: {
        limit: { type: 'number' },
        query: { type: 'string' },
        results: { items: { type: 'object' }, type: 'array' },
    },
    required: ['query', 'limit', 'results'],
    type: 'object',
}

export const saveOutputSchema: Tool['outputSchema'] = {
    properties: {
        accepted: { type: 'boolean' },
        diaryId: { type: 'string' },
        duplicateOf: { type: 'string' },
        id: { type: 'string' },
        memoryIds: { items: { type: 'string' }, type: 'array' },
        skippedMemories: { type: 'number' },
        type: { type: 'string' },
    },
    required: ['accepted', 'id', 'type'],
    type: 'object',
}

export const forgetOutputSchema: Tool['outputSchema'] = {
    properties: {
        accepted: { type: 'boolean' },
        affectedIds: { items: { type: 'string' }, type: 'array' },
        mode: { type: 'string' },
    },
    required: ['accepted', 'mode', 'affectedIds'],
    type: 'object',
}
