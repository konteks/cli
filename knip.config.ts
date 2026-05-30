import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    ignoreDependencies: ['node:sqlite'],
    ignoreFiles: ['tests/**/*.ts'],
}

export default knipConfig
