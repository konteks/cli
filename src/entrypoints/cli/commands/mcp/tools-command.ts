import * as prompts from '@inquirer/prompts'
import z from 'zod'
import MCP_TOOLS from '@/entrypoints/mcp/tools'
import consoleOutput from '@/support/console-output'
import BaseCommand from '../_base-command'

const OMIT_OPTION = '__konteks_omit__' as const

type McpTool = (typeof MCP_TOOLS)[number]

export default class ToolsCommand extends BaseCommand {
    public readonly description = 'List MCP tools exposed by Konteks.'
    public readonly name = 'tools'

    public async handle(): Promise<void> {
        let loop = true

        while (loop) {
            const selectedToolName = await selectTool()

            const selectedTool = MCP_TOOLS.find(
                tool => tool.name === selectedToolName,
            )

            if (!selectedTool) {
                throw new Error(`Unknown tool: ${selectedToolName}`)
            }

            printTool(selectedTool)
            const isConfirmed = await callToolConfirmation()

            if (isConfirmed) {
                const input = await promptForToolInput(selectedTool)
                await selectedTool.handle(input)

                loop = await prompts.confirm({
                    default: true,
                    message: 'Call another tool?',
                })
            }
        }
    }
}

function selectTool() {
    return prompts.select({
        choices: MCP_TOOLS.map(tool => ({
            name: `${tool.name} - ${tool.description}`,
            value: tool.name,
        })),
        message: 'Select a tool:',
    })
}

function printTool(tool: (typeof MCP_TOOLS)[number]) {
    console.log({
        annotations: tool.annotations,
        description: tool.description,
        inputSchema: summarizeObjectSchema(tool.inputSchema),
        name: tool.name,
    })
}

function callToolConfirmation() {
    return prompts.confirm({
        default: true,
        message: 'Call this tool?',
    })
}

async function promptForToolInput(tool: McpTool): Promise<unknown> {
    while (true) {
        const input = await promptForObjectInput(tool.inputSchema)
        const result = tool.inputSchema.safeParse(input)

        if (result.success) {
            return result.data
        }

        consoleOutput.writeError(formatSchemaErrors(result.error))
    }
}

async function promptForObjectInput(
    schema: z.ZodObject,
): Promise<Record<string, unknown>> {
    const input: Record<string, unknown> = {}

    for (const [key, fieldSchema] of Object.entries(schema.shape)) {
        const value = await promptForField(key, fieldSchema)

        if (value !== undefined) {
            input[key] = value
        }
    }

    return input
}

async function promptForField(
    key: string,
    schema: z.ZodType,
): Promise<unknown> {
    const { innerSchema, optional } = unwrapOptionalSchema(schema)

    if (innerSchema instanceof z.ZodBoolean) {
        return promptForBooleanField(key, optional)
    }

    if (innerSchema instanceof z.ZodEnum) {
        return promptForEnumField(key, innerSchema, optional)
    }

    if (innerSchema instanceof z.ZodNumber) {
        return promptForNumberField(key, schema, optional)
    }

    if (innerSchema instanceof z.ZodString) {
        return promptForStringField(key, schema, optional)
    }

    return promptForJsonField(key, schema, optional)
}

async function promptForBooleanField(
    key: string,
    optional: boolean,
): Promise<boolean | undefined> {
    if (!optional) {
        return prompts.confirm({
            default: false,
            message: promptMessage(key, 'boolean'),
        })
    }

    const value = await prompts.select<boolean | typeof OMIT_OPTION>({
        choices: [
            { name: 'Omit', value: OMIT_OPTION },
            { name: 'true', value: true },
            { name: 'false', value: false },
        ],
        message: promptMessage(key, 'boolean'),
    })

    return value === OMIT_OPTION ? undefined : value
}

async function promptForEnumField(
    key: string,
    schema: z.ZodEnum,
    optional: boolean,
): Promise<string | undefined> {
    const enumChoices = schema.options.map(value => ({
        name: String(value),
        value: String(value),
    }))
    const value = await prompts.select<string | typeof OMIT_OPTION>({
        choices: optional
            ? [{ name: 'Omit', value: OMIT_OPTION }, ...enumChoices]
            : enumChoices,
        message: promptMessage(key, 'enum'),
    })

    return value === OMIT_OPTION ? undefined : value
}

async function promptForNumberField(
    key: string,
    schema: z.ZodType,
    optional: boolean,
): Promise<number | undefined> {
    return prompts.number({
        message: promptMessage(key, 'number'),
        required: !optional,
        validate: value => {
            if (value === undefined && optional) {
                return true
            }

            const result = schema.safeParse(value)

            return result.success ? true : formatSchemaIssue(result.error)
        },
    })
}

async function promptForStringField(
    key: string,
    schema: z.ZodType,
    optional: boolean,
): Promise<string | undefined> {
    const value = await prompts.input({
        message: promptMessage(key, 'string'),
        validate: value => {
            if (value === '' && optional) {
                return true
            }

            const result = schema.safeParse(value)

            return result.success ? true : formatSchemaIssue(result.error)
        },
    })

    return value === '' && optional ? undefined : value
}

async function promptForJsonField(
    key: string,
    schema: z.ZodType,
    optional: boolean,
): Promise<unknown> {
    const value = await prompts.input({
        message: promptMessage(key, 'JSON'),
        validate: value => {
            if (value === '' && optional) {
                return true
            }

            const parsed = parsePromptJson(value)

            if (!parsed.ok) {
                return parsed.error
            }

            const result = schema.safeParse(parsed.value)

            return result.success ? true : formatSchemaIssue(result.error)
        },
    })

    if (value === '' && optional) {
        return undefined
    }

    const parsed = parsePromptJson(value)

    if (!parsed.ok) {
        throw new Error(parsed.error)
    }

    return parsed.value
}

function unwrapOptionalSchema(schema: z.ZodType): {
    innerSchema: z.ZodType
    optional: boolean
} {
    if (schema instanceof z.ZodOptional) {
        return {
            innerSchema: schema.unwrap() as unknown as z.ZodType,
            optional: true,
        }
    }

    return {
        innerSchema: schema,
        optional: false,
    }
}

function parsePromptJson(
    value: string,
): { ok: true; value: unknown } | { error: string; ok: false } {
    try {
        return {
            ok: true,
            value: JSON.parse(value) as unknown,
        }
    } catch (error) {
        return {
            error: `Invalid JSON: ${
                error instanceof Error ? error.message : String(error)
            }`,
            ok: false,
        }
    }
}

function promptMessage(key: string, type: string): string {
    return `${key} (${type}):`
}

function formatSchemaErrors(error: z.ZodError): string {
    return `${error.issues.map(formatIssue).join('\n')}\n`
}

function formatSchemaIssue(error: z.ZodError): string {
    return error.issues.map(formatIssue).join('\n')
}

function formatIssue(issue: z.core.$ZodIssue): string {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''

    return `${path}${issue.message}`
}

function summarizeObjectSchema(schema: z.ZodObject): object {
    return Object.fromEntries(
        Object.entries(schema.shape).map(([key, fieldSchema]) => [
            key,
            summarizeSchema(fieldSchema),
        ]),
    )
}

function summarizeSchema(schema: z.ZodType): object {
    const { innerSchema, optional } = unwrapOptionalSchema(schema)

    return {
        optional,
        type: schemaTypeName(innerSchema),
    }
}

function schemaTypeName(schema: z.ZodType): string {
    if (schema instanceof z.ZodArray) {
        return 'array'
    }

    if (schema instanceof z.ZodBoolean) {
        return 'boolean'
    }

    if (schema instanceof z.ZodEnum) {
        return `enum(${schema.options.join(', ')})`
    }

    if (schema instanceof z.ZodNumber) {
        return 'number'
    }

    if (schema instanceof z.ZodObject) {
        return 'object'
    }

    if (schema instanceof z.ZodString) {
        return 'string'
    }

    return 'JSON'
}
