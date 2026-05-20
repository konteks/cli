import { modules } from '@/database/schema'
import getDb from './_db'

export default async function clearModules(): Promise<void> {
    const db = await getDb()
    await db.delete(modules)
}
