import { readFileSync } from 'node:fs'

export {
    access,
    cp,
    mkdir,
    mkdtemp,
    readdir,
    readFile,
    rename,
    rm,
    stat,
    unlink,
    writeFile,
} from 'node:fs/promises'

export default class FileManager {
    public read(path: string): string {
        return readFileSync(path, 'utf8')
    }
}
