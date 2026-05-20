const maxChunkContentChars = 3000
const maxEmbeddingTextChars = 2500
const maxFtsTextChars = 6000

export function buildChunkRetrievalTexts(input: {
    anchor?: string
    content: string
    language: string
    path: string
    sourceRole: string
    summary: string
    topics: string[]
}): { embeddingText: string; ftsText: string } {
    const topicText = input.topics.join(', ')
    const location = input.anchor ? `${input.path}#${input.anchor}` : input.path
    const metadata = [
        `path: ${location}`,
        `role: ${input.sourceRole}`,
        `language: ${input.language}`,
        input.anchor ? `anchor: ${input.anchor}` : '',
        topicText ? `topics: ${topicText}` : '',
        `summary: ${input.summary}`,
    ]
        .filter(Boolean)
        .join('\n')
    const contentExcerpt = input.content.slice(0, maxChunkContentChars)

    return {
        embeddingText: [metadata, contentExcerpt]
            .join('\n\n')
            .slice(0, maxEmbeddingTextChars),
        ftsText: [metadata, input.content].join('\n\n').slice(0, maxFtsTextChars),
    }
}
