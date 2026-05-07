import { defineConfig } from 'tsup'

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/cli.ts'],
    esbuildOptions(options) {
        options.loader = {
            ...options.loader,
            '.md': 'text',
        }
    },
    format: ['esm'],
    silent: true,
})
