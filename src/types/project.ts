export type ProjectContext = {
    projectRoot: string
    memoryDir: string
    configPath: string
}

export type KonteksConfig = {
    extraction: {
        grammars: {
            selected: string[]
            updateTtlHours: number
        }
    }
    storage: {
        inlinePayloadMaxBytes: number
    }
    recall: {
        maxTokens: number
    }
}

export type Project = ProjectContext & {
    config: KonteksConfig
    configExists: boolean
}

export type LoadedProjectContext = Project
