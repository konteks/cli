import {
    isRecord,
    parseJsonInput,
    stringifyPretty,
    terminal,
} from '@/app/services'

export { isRecord, parseJsonInput }

export function printJson(value: unknown): void {
    terminal.log(stringifyPretty(value))
}
