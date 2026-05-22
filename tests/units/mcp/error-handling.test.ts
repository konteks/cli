import { describe, expect, it } from 'bun:test'
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js'
import z from 'zod'
import {
    createMcpPromptError,
    createMcpToolErrorResult,
} from '@/entrypoints/mcp/error-handling'
import CliUserError from '@/support/cli/cli-user-error'

describe('mcp/error-handling', () => {
    it('formats actionable tool errors from CliUserError', () => {
        const result = createMcpToolErrorResult({
            error: new CliUserError({
                command: 'konteks init',
                hint: 'Initialize memory before calling this tool.',
                message: 'Konteks memory is not initialized.',
                title: 'Memory unavailable',
            }),
            toolName: 'konteks_recall',
        })

        expect(result).toEqual({
            content: [
                {
                    text: [
                        'Memory unavailable: Konteks memory is not initialized.',
                        'Run: konteks init',
                        'Initialize memory before calling this tool.',
                    ].join('\n'),
                    type: 'text',
                },
            ],
            isError: true,
        })
    })

    it('formats tool validation failures without throwing', () => {
        const result = createMcpToolErrorResult({
            error: new z.ZodError([
                {
                    code: 'invalid_type',
                    expected: 'string',
                    input: undefined,
                    message:
                        'Invalid input: expected string, received undefined',
                    path: ['task'],
                },
            ]),
            toolName: 'konteks_recall',
        })

        expect(result).toEqual({
            content: [
                {
                    text: 'Invalid arguments for tool konteks_recall: task: Invalid input: expected string, received undefined',
                    type: 'text',
                },
            ],
            isError: true,
        })
    })

    it('sanitizes unexpected tool failures', () => {
        const result = createMcpToolErrorResult({
            error: new Error('sensitive details'),
            toolName: 'konteks_recall',
        })

        expect(result).toEqual({
            content: [
                {
                    text: 'Konteks MCP tool failed due to an internal error.',
                    type: 'text',
                },
            ],
            isError: true,
        })
    })

    it('maps actionable prompt failures to invalid params', () => {
        const error = createMcpPromptError({
            error: new CliUserError({
                message: 'Topic is required.',
                title: 'Invalid prompt arguments',
            }),
            promptName: 'konteks-warm-up',
        })

        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InvalidParams)
        expect(error.message).toBe(
            'MCP error -32602: Invalid prompt arguments: Topic is required.',
        )
    })

    it('sanitizes unexpected prompt failures', () => {
        const error = createMcpPromptError({
            error: new Error('template path leaked'),
            promptName: 'konteks-warm-up',
        })

        expect(error).toBeInstanceOf(McpError)
        expect(error.code).toBe(ErrorCode.InternalError)
        expect(error.message).toBe(
            'MCP error -32603: Konteks MCP prompt failed due to an internal error.',
        )
    })
})
