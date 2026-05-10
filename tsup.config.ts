import { defineConfig } from 'tsup'

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/main.ts'],
    esbuildOptions(options) {
        options.loader = {
            ...options.loader,
            '.md': 'text',
            '.sql': 'text',
        }
    },
    format: ['esm'],
    silent: true,
})
