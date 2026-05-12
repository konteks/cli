import { defineConfig } from 'tsup'

export default defineConfig({
    clean: true,
    entry: ['src/main.ts'],
    esbuildOptions: options => {
        options.loader = {
            '.md': 'text',
            '.sql': 'text',
        }

        return options
    },
    format: ['esm'],
    silent: true,
})
