export default function inline(value: string): string {
    return value.trim().replaceAll(/\s+/gu, ' ')
}
