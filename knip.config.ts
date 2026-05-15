import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    ignoreFiles: ['tests/**/*.test.ts', 'src/support/fake/**'],
}

export default knipConfig
