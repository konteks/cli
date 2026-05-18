export default function pluralizeWord(value: string, count: number): string {
    return count === 1 ? value : `${value}s`
}
