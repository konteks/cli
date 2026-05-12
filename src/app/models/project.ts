type ProjectContext = {
    projectRoot: string
    memoryDir: string
    configPath: string
}

type KonteksConfig = {
    projectRoot: string
    storage: {
        inlinePayloadMaxBytes: number
        memoryDir: string
    }
    recall: {
        maxTokens: number
    }
}

export type Project = ProjectContext & {
    config: KonteksConfig
    configExists: boolean
}
