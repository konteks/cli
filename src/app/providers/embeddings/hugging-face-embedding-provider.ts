import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { EmbeddingProviderContract } from '@/app/contracts/services/embedding-provider'
import type { MineProgressReporter } from '@/app/contracts/services/progress'
import { env, pipeline } from '@/app/support/embedding'
import { mkdir, readFile, stat, writeFile } from '@/app/support/file-manager'
import { formatBytes } from '@/app/support/format'

export class HuggingFaceEmbeddingProvider implements EmbeddingProviderContract {
    readonly model = 'Xenova/all-MiniLM-L6-v2'
    readonly dimensions = 384

    private readonly onProgress?: MineProgressReporter

    private extractor:
        | ((text: string, options: Record<string, unknown>) => Promise<unknown>)
        | undefined

    constructor(options: { onProgress?: MineProgressReporter } = {}) {
        this.onProgress = options.onProgress
    }

    async embed(texts: string[]): Promise<Float32Array[]> {
        if (texts.length === 0) {
            return []
        }

        const extractor = await this.getExtractor()
        const vectors: Float32Array[] = []

        for (const text of texts) {
            const output = await extractor(text, {
                normalize: true,
                pooling: 'mean',
            })
            vectors.push(toFloat32Array(output))
        }

        return vectors
    }

    async prepare(): Promise<void> {
        await this.getExtractor()
    }

    private async getExtractor(): Promise<
        (text: string, options: Record<string, unknown>) => Promise<unknown>
    > {
        if (this.extractor) {
            return this.extractor
        }

        const cacheDir = resolveGlobalModelCacheDir()
        await mkdir(cacheDir, { recursive: true })
        env.cacheDir = cacheDir

        this.onProgress?.({
            message: `Loading embedding model ${this.model}`,
            phase: 'preparation',
            stage: 'prepare',
            status: 'progress',
        })
        this.extractor = (await pipeline('feature-extraction', this.model, {
            progress_callback: progress =>
                this.reportModelProgress(progress as ModelProgressInfo),
        })) as unknown as (
            text: string,
            options: Record<string, unknown>,
        ) => Promise<unknown>
        await writeModelCacheMetadata(cacheDir, {
            dimensions: this.dimensions,
            downloadedAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
            model: this.model,
        })
        return this.extractor
    }

    private reportModelProgress(progress: ModelProgressInfo): void {
        if (!this.onProgress) {
            return
        }

        if (progress.status === 'ready') {
            this.onProgress({
                message: `Embedding model ready: ${progress.model}`,
                phase: 'preparation',
                stage: 'prepare',
                status: 'progress',
            })
            return
        }

        if (progress.status === 'progress_total') {
            this.onProgress({
                downloadLoadedBytes: progress.loaded,
                downloadPercent: progress.progress,
                downloadTotalBytes: progress.total,
                message: `Loading embedding model files ${formatPercent(progress.progress)} (${formatBytes(progress.loaded)}/${formatBytes(progress.total)})`,
                phase: 'preparation',
                stage: 'prepare',
                status: 'progress',
            })
            return
        }

        if (progress.status === 'progress') {
            this.onProgress({
                downloadFile: progress.file,
                downloadLoadedBytes: progress.loaded,
                downloadPercent: progress.progress,
                downloadTotalBytes: progress.total,
                message: `Loading ${progress.file} ${formatPercent(progress.progress)} (${formatBytes(progress.loaded)}/${formatBytes(progress.total)})`,
                phase: 'preparation',
                stage: 'prepare',
                status: 'progress',
            })
            return
        }

        if (progress.status === 'download') {
            this.onProgress({
                downloadFile: progress.file,
                message: `Loading ${progress.file}`,
                phase: 'preparation',
                stage: 'prepare',
                status: 'progress',
            })
            return
        }

        if (progress.status === 'initiate') {
            this.onProgress({
                downloadFile: progress.file,
                message: `Preparing ${progress.file}`,
                phase: 'preparation',
                stage: 'prepare',
                status: 'progress',
            })
        }
    }
}

type ModelProgressInfo =
    | {
          file: string
          name: string
          status: 'download' | 'done' | 'initiate'
      }
    | {
          file: string
          loaded: number
          name: string
          progress: number
          status: 'progress'
          total: number
      }
    | {
          loaded: number
          name: string
          progress: number
          status: 'progress_total'
          total: number
      }
    | {
          model: string
          status: 'ready'
          task: string
      }

function resolveGlobalModelCacheDir(): string {
    if (process.env.KONTEKS_MODEL_CACHE_DIR) {
        return resolve(process.env.KONTEKS_MODEL_CACHE_DIR)
    }
    return join(homedir(), '.cache', 'konteks', 'models')
}

async function writeModelCacheMetadata(
    cacheDir: string,
    metadata: {
        dimensions: number
        downloadedAt: string
        lastUsedAt: string
        model: string
    },
): Promise<void> {
    const metadataPath = join(cacheDir, 'metadata.json')
    const previous = await readExistingMetadata(metadataPath)
    await writeFile(
        metadataPath,
        `${JSON.stringify(
            {
                ...previous,
                [metadata.model]: {
                    dimensions: metadata.dimensions,
                    downloaded_at:
                        previous[metadata.model]?.downloaded_at ??
                        metadata.downloadedAt,
                    last_used_at: metadata.lastUsedAt,
                    model: metadata.model,
                    size: await estimateCacheSize(cacheDir),
                },
            },
            null,
            2,
        )}\n`,
    )
}

async function readExistingMetadata(
    path: string,
): Promise<Record<string, Record<string, unknown>>> {
    try {
        return JSON.parse(await readFile(path, 'utf8')) as Record<
            string,
            Record<string, unknown>
        >
    } catch {
        return {}
    }
}

async function estimateCacheSize(path: string): Promise<number> {
    try {
        return (await stat(path)).size
    } catch {
        return 0
    }
}

function formatPercent(value: number): string {
    return `${Math.max(0, Math.min(100, value)).toFixed(1)}%`
}

function toFloat32Array(value: unknown): Float32Array {
    if (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        (value as { data: unknown }).data instanceof Float32Array
    ) {
        return (value as { data: Float32Array }).data
    }

    if (Array.isArray(value)) {
        const numeric = value
            .flat(Infinity)
            .filter(item => typeof item === 'number') as number[]
        return Float32Array.from(numeric)
    }

    throw new Error('Unsupported embedding output format from provider.')
}
