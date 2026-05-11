import { defineConfig } from 'tsup'

export default defineConfig({
    clean: true,
    entry: ['src/main.ts'],
    format: ['esm'],
    silent: true,
})
