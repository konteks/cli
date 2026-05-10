import { EventLogStore } from './event-log.js'
import type { KonteksDatabase, SqliteAdapter } from './sqlite-adapter.js'
import { ChunkStore } from './stores/chunk-store.js'
import { GraphStore } from './stores/graph-store.js'
import { ModuleStore } from './stores/module-store.js'
import { ObservationStore } from './stores/observation-store.js'
import { SourceStore } from './stores/source-store.js'
import { TaxonomyStore } from './stores/taxonomy-store.js'

export class DatabaseService {
    readonly events: EventLogStore
    readonly chunks: ChunkStore
    readonly observations: ObservationStore
    readonly sources: SourceStore
    readonly modules: ModuleStore
    readonly graph: GraphStore
    readonly taxonomy: TaxonomyStore

    constructor(
        public readonly adapter: SqliteAdapter,
        public readonly db: KonteksDatabase,
    ) {
        this.events = new EventLogStore(db)
        this.chunks = new ChunkStore(adapter, db)
        this.observations = new ObservationStore(adapter, db)
        this.sources = new SourceStore(adapter, db)
        this.modules = new ModuleStore(adapter, db)
        this.graph = new GraphStore(adapter, db)
        this.taxonomy = new TaxonomyStore(adapter)
    }

    async transaction<T>(
        operation: (tx: DatabaseService) => Promise<T>,
    ): Promise<T> {
        return this.adapter.transaction(async () => {
            return operation(this)
        })
    }

    async close(): Promise<void> {
        await this.adapter.close()
    }
}
