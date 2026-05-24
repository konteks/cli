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
const INTERNAL_ERROR_LOG_HINT =
    'Details were written to .konteks/errors.log when available.'

export function createMcpToolErrorResult(input: {
    error: unknown
    logged?: boolean
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
    logged?: boolean
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

    return new McpError(
        ErrorCode.InternalError,
        internalErrorMessage(MCP_PROMPT_FAILURE_MESSAGE, input.logged),
    )
}

export function isUnexpectedMcpError(error: unknown): boolean {
    return !(
        error instanceof z.ZodError ||
        error instanceof CliUserError ||
        error instanceof McpError
    )
}

function formatMcpToolErrorMessage(input: {
    error: unknown
    logged?: boolean
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

    return internalErrorMessage(MCP_TOOL_FAILURE_MESSAGE, input.logged)
}

function internalErrorMessage(message: string, logged?: boolean): string {
    return logged ? `${message}\n${INTERNAL_ERROR_LOG_HINT}` : message
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
