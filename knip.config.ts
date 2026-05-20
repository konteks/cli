import type { KnipConfig } from 'knip'

const knipConfig: KnipConfig = {
    ignoreFiles: ['tests/**/*.ts'],
    ignoreIssues: {
        'src/database/services/graph.ts': ['exports', 'types'],
        'src/database/services/taxonomy.ts': ['exports', 'types'],
    },
}

export default knipConfig
