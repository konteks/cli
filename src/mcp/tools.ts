import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import type { z } from 'zod'
import {
    KONTEKS_TOOL_SURFACE,
    MCP_INSTRUCTIONS,
} from '@/providers/protocol/tool-surface'

export type KonteksToolRegistration = {
    annotations: Tool['annotations']
    description: string
    inputSchema: z.ZodTypeAny
    name: string
}

export function getKonteksMcpInstructions(): string {
    return MCP_INSTRUCTIONS
}

export function listKonteksTools(): Tool[] {
    return KONTEKS_TOOL_SURFACE.map(surface => ({
        description: surface.description,
        inputSchema: {
            properties: {},
            type: 'object',
        },
        name: surface.name,
    }))
}

export function getKonteksToolRegistrations(): KonteksToolRegistration[] {
    return KONTEKS_TOOL_SURFACE.map(surface => ({
        annotations: surface.annotations,
        description: surface.description,
        inputSchema: surface.inputSchema,
        name: surface.name,
    }))
}
