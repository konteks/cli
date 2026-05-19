import type { Client, Transaction } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import EventLogStore from './event-log-store'
import type { KonteksDatabase } from './libsql-helpers'
import * as schema from './schema'
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
        public readonly client: Client | Transaction,
        public readonly db: KonteksDatabase,
        private readonly ownsClient = true,
    ) {
        this.events = new EventLogStore(db)
        this.chunks = new ChunkStore(client, db)
        this.observations = new ObservationStore(client, db)
        this.sources = new SourceStore(client, db)
        this.modules = new ModuleStore(client, db)
        this.graph = new GraphStore(client, db)
        this.taxonomy = new TaxonomyStore(client)
    }

    public async transaction<T>(
        operation: (tx: DatabaseService) => Promise<T>,
    ): Promise<T> {
        if (!('transaction' in this.client)) {
            return operation(this)
        }

        const transaction = await this.client.transaction('write')
        const txDb = drizzle(transaction as unknown as Client, { schema })
        const txService = new DatabaseService(
            transaction,
            txDb as KonteksDatabase,
            false,
        )

        try {
            const result = await operation(txService)
            await transaction.commit()
            return result
        } catch (error) {
            await transaction.rollback()
            throw error
        }
    }

    public async close(): Promise<void> {
        if (this.ownsClient && 'close' in this.client) {
            this.client.close()
        }
    }
}
