import { describe, expect, it } from 'bun:test'
import createColorPalette from '@/support/terminal/create-color-palette'

describe('support/terminal/color-palette', () => {
    it('returns plain values when colors are disabled', () => {
        const color = createColorPalette(false)

        expect(color.accent('value')).toBe('value')
        expect(color.danger('value')).toBe('value')
        expect(color.dim('value')).toBe('value')
    })

    it('wraps values with ANSI codes when colors are enabled', () => {
        const color = createColorPalette(true)

        expect(color.success('ok')).toBe('\u001b[32mok\u001b[0m')
        expect(color.warning('warn')).toBe('\u001b[33mwarn\u001b[0m')
    })

    it('creates all named palette functions', () => {
        const color = createColorPalette(false)
        expect(Object.keys(color).sort()).toEqual([
            'accent',
            'danger',
            'dim',
            'info',
            'success',
            'warning',
        ])
    })
})
