import { modules } from '@/providers/persistence/sqlite/schema'
import db from './_db'

export async function clearModules(): Promise<void> {
    await db.ensureActionDatabase()
    await db.delete(modules)
}
