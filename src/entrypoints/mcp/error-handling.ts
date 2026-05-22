import {
    type CallToolResult,
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js'
import z from 'zod'
import CliUserError from '@/support/cli/cli-user-error'

const MCP_TOOL_FAILURE_MESSAGE =
    'Konteks MCP tool failed due to an internal error.'
const MCP_PROMPT_FAILURE_MESSAGE =
    'Konteks MCP prompt failed due to an internal error.'

export function createMcpToolErrorResult(input: {
    error: unknown
    toolName: string
}): CallToolResult {
    return {
        content: [
            {
                text: formatMcpToolErrorMessage(input),
                type: 'text',
            },
        ],
        isError: true,
    }
}

export function createMcpPromptError(input: {
    error: unknown
    promptName: string
}): McpError {
    if (input.error instanceof McpError) {
        return input.error
    }

    if (input.error instanceof CliUserError) {
        return new McpError(
            ErrorCode.InvalidParams,
            formatCliUserError(input.error),
        )
    }

    return new McpError(ErrorCode.InternalError, MCP_PROMPT_FAILURE_MESSAGE)
}

function formatMcpToolErrorMessage(input: {
    error: unknown
    toolName: string
}): string {
    const { error, toolName } = input

    if (error instanceof z.ZodError) {
        return `Invalid arguments for tool ${toolName}: ${formatZodError(error)}`
    }

    if (error instanceof CliUserError) {
        return formatCliUserError(error)
    }

    if (error instanceof McpError) {
        return error.message
    }

    return MCP_TOOL_FAILURE_MESSAGE
}

function formatCliUserError(error: CliUserError): string {
    const lines = [`${error.title}: ${error.message}`]

    if (error.command) {
        lines.push(`Run: ${error.command}`)
    }

    if (error.hint) {
        lines.push(error.hint)
    }

    return lines.join('\n')
}

function formatZodError(error: z.ZodError): string {
    return error.issues
        .map(issue => {
            const path =
                issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''
            return `${path}${issue.message}`
        })
        .join('; ')
}
