export function buildSectionRetrievalTexts(input: {
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

    return {
        embeddingText: [metadata, input.content].join('\n\n'),
        ftsText: [metadata, input.content].join('\n\n'),
    }
}
