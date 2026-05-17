import EventLogStore from './event-log-store'
import type { KonteksDatabase, SqliteAdapter } from './sqlite-adapter'
import ChunkStore from './stores/chunk-store'
import GraphStore from './stores/graph-store'
import ModuleStore from './stores/module-store'
import ObservationStore from './stores/observation-store'
import SourceStore from './stores/source-store'
import TaxonomyStore from './stores/taxonomy-store'

export default class DatabaseService {
    public readonly events: EventLogStore
    public readonly chunks: ChunkStore
    public readonly observations: ObservationStore
    public readonly sources: SourceStore
    public readonly modules: ModuleStore
    public readonly graph: GraphStore
    public readonly taxonomy: TaxonomyStore

    public constructor(
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

    public async transaction<T>(
        operation: (tx: DatabaseService) => Promise<T>,
    ): Promise<T> {
        return this.adapter.transaction(async () => {
            return operation(this)
        })
    }

    public async close(): Promise<void> {
        await this.adapter.close()
    }
}
