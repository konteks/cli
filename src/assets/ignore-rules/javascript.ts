import type { IgnoreRuleSet } from './types'

export default {
    directoryNames: [
        '.angular',
        '.astro',
        '.expo',
        '.next',
        '.npm',
        '.nuxt',
        '.parcel-cache',
        '.pnpm-store',
        '.rollup.cache',
        '.serverless',
        '.svelte-kit',
        '.turbo',
        '.vercel',
        '.vite',
        '.yarn',
        'bower_components',
        'jspm_packages',
        'node_modules',
        'storybook-static',
    ],
    fileNames: [
        'npm-debug.log',
        'pnpm-debug.log',
        'yarn-debug.log',
        'yarn-error.log',
    ],
    lockFileNames: [
        'bun.lock',
        'bun.lockb',
        'npm-shrinkwrap.json',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
    ],
} satisfies IgnoreRuleSet
