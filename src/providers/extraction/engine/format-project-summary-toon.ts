import type { ProjectMetadata } from './extract-project-metadata'
import type { ScannedFile } from './file-scan'

type ProjectSummaryInput = {
    projectRoot: string
    minedAt: string
    fileCount: number
    mode: string
    metadata: ProjectMetadata
    files: ScannedFile[]
}

export default function formatProjectSummaryToon(
    input: ProjectSummaryInput,
): string {
    const sourceFiles = input.files
        .slice(0, 200)
        .map(file => `  - path: ${file.path} | bytes: ${file.sizeBytes}`)
        .join('\n')

    return [
        'project:',
        `  root: ${input.projectRoot}`,
        `  mined_at: ${input.minedAt}`,
        `  mode: ${input.mode}`,
        `  file_count: ${input.fileCount}`,
        `  name: ${input.metadata.name ?? ''}`,
        `  package_manager: ${input.metadata.packageManager ?? ''}`,
        `  workspace_manager: ${input.metadata.workspaceManager ?? ''}`,
        `  workspace_globs: ${input.metadata.workspaceGlobs.join(', ')}`,
        `  technologies: ${input.metadata.technologies.join(', ')}`,
        `  scripts: ${input.metadata.scripts.join(', ')}`,
        `  dependencies: ${input.metadata.dependencies.join(', ')}`,
        `  dev_dependencies: ${input.metadata.devDependencies.join(', ')}`,
        `  peer_dependencies: ${input.metadata.peerDependencies.join(', ')}`,
        `  optional_dependencies: ${input.metadata.optionalDependencies.join(', ')}`,
        `  readmes: ${input.metadata.readmeFiles.join(', ')}`,
        'files:',
        sourceFiles,
        '',
    ].join('\n')
}
