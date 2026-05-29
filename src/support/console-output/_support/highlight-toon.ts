import type { ConsoleColorPalette } from '..'

export default function highlightToon(
    value: string,
    color: ConsoleColorPalette,
): string {
    return value
        .split('\n')
        .map(line => highlightToonLine(line, color))
        .join('\n')
}

function highlightToonLine(line: string, color: ConsoleColorPalette): string {
    const keyValue = line.match(
        /^(\s*(?:-\s*)?)([^:\n]+?)(\[[^\]]+\])?(\{[^}]+\})?(:)(\s*)(.*)$/u,
    )

    if (keyValue) {
        const [, prefix, key, arraySize = '', fields = '', colon, gap, value] =
            keyValue

        return [
            prefix,
            color.accent(key),
            arraySize ? color.dim(arraySize) : '',
            fields ? color.dim(fields) : '',
            color.dim(colon),
            gap,
            highlightToonValue(value, color),
        ].join('')
    }

    const listItem = line.match(/^(\s*-\s+)(.*)$/u)

    if (listItem) {
        const [, prefix, value] = listItem

        return `${prefix}${highlightToonValue(value, color)}`
    }

    return highlightToonValue(line, color)
}

function highlightToonValue(value: string, color: ConsoleColorPalette): string {
    if (/^(true|false)$/u.test(value)) {
        return color.success(value)
    }

    if (value === 'null') {
        return color.dim(value)
    }

    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) {
        return color.info(value)
    }

    if (value === '[]') {
        return color.dim(value)
    }

    return value
}
