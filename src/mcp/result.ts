export function textResult(value: unknown) {
    return {
        content: [
            {
                text:
                    typeof value === 'string'
                        ? value
                        : JSON.stringify(value, null, 2),
                type: 'text' as const,
            },
        ],
    }
}
