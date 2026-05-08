export type ProjectContext = {
    projectRoot: string
    memoryDir: string
    configPath: string
}

export type KonteksConfig = {
    projectRoot: string
    storage: {
        inlinePayloadMaxBytes: number
        memoryDir: string
    }
    recall: {
        maxTokens: number
    }
}

export type LoadedProjectContext = ProjectContext & {
    config: KonteksConfig
    configExists: boolean
}
