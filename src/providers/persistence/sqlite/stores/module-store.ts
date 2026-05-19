import {
    executeSql,
    type KonteksDatabase,
    type SqliteExecutor,
} from '../libsql-helpers'
import { modules } from '../schema'

export type ModuleRow = {
    id: string
    path: string
    source_role: string | null
    package_name: string | null
    summary: string
    file_count: number
    chunk_count: number
    exported_symbols_json: string | null
    imports_json: string | null
    topics_json: string | null
    entities_json: string | null
    updated_at: string
}

export default class ModuleStore {
    public constructor(
        private readonly client: SqliteExecutor,
        private readonly db?: KonteksDatabase,
    ) {}

    public async clear(): Promise<void> {
        if (this.db) {
            await this.db.delete(modules)
            return
        }
        await executeSql(this.client, 'delete from modules')
    }

    public async insert(module: Omit<ModuleRow, 'updated_at'>): Promise<void> {
        const now = new Date().toISOString()

        if (this.db) {
            await this.db.insert(modules).values({
                ...module,
                chunkCount: module.chunk_count,
                entitiesJson: module.entities_json,
                exportedSymbolsJson: module.exported_symbols_json,
                fileCount: module.file_count,
                importsJson: module.imports_json,
                packageName: module.package_name,
                sourceRole: module.source_role,
                topicsJson: module.topics_json,
                updatedAt: now,
            })
            return
        }

        await executeSql(
            this.client,
            `
insert into modules (
    id, path, source_role, package_name, summary, file_count, chunk_count,
    exported_symbols_json, imports_json, topics_json, entities_json, updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`,
            [
                module.id,
                module.path,
                module.source_role,
                module.package_name,
                module.summary,
                module.file_count,
                module.chunk_count,
                module.exported_symbols_json,
                module.imports_json,
                module.topics_json,
                module.entities_json,
                now,
            ],
        )
    }
}
