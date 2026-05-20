import { modules } from '@/database/schema'
import db from './_db'

export async function clearModules(): Promise<void> {
    await db.ensureActionDatabase()
    await db.delete(modules)
}
