import inline from './inline'

export default function toBullets(
    values: string[],
    indent: number,
    options: { empty?: boolean } = {},
): string[] {
    const pad = ' '.repeat(indent)
    if (values.length === 0) {
        return options.empty === false ? [] : [`${pad}- none`]
    }
    return values.slice(0, 10).map(value => `${pad}- ${inline(value)}`)
}
