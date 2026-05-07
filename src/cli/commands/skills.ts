import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveProjectContext } from '../../project/context.js'

type InstallSkillOptions = {
    global?: boolean
    homeDir?: string
    project?: string
}

export async function skillsInstallCommand(
    options: InstallSkillOptions,
): Promise<void> {
    const skillsDir = options.global
        ? join(options.homeDir ?? homedir(), '.agents', 'skills')
        : join(
              (await resolveProjectContext(options.project)).projectRoot,
              '.agents',
              'skills',
          )
    await mkdir(skillsDir, { recursive: true })

    const skillSourceRoot = await resolveSkillSourceRoot()
    const skillNames: string[] = []
    const candidates = await readdir(skillSourceRoot)
    for (const skillName of candidates) {
        const sourceDir = join(skillSourceRoot, skillName)
        if (!(await stat(sourceDir)).isDirectory()) {
            continue
        }
        if (!(await pathExists(join(sourceDir, 'SKILL.md')))) {
            continue
        }
        skillNames.push(skillName)
        await copySkillDirectory(sourceDir, join(skillsDir, skillName))
    }

    console.log(`Installed ${skillNames.length} Konteks skills at ${skillsDir}`)
}

async function pathExists(path: string): Promise<boolean> {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}

async function copySkillDirectory(
    sourceDir: string,
    targetDir: string,
): Promise<void> {
    await mkdir(targetDir, { recursive: true })

    const files = await readdir(sourceDir)
    for (const fileName of files) {
        const sourcePath = join(sourceDir, fileName)
        const content = await readFile(sourcePath, 'utf8')
        await writeFile(join(targetDir, fileName), content)
    }
}

async function resolveSkillSourceRoot(): Promise<string> {
    const currentDir = dirname(fileURLToPath(import.meta.url))
    const candidates = [
        join(currentDir, 'skills'),
        join(currentDir, '..', 'skills'),
        join(currentDir, '..', '..', '..', 'dist', 'skills'),
    ]

    for (const candidate of candidates) {
        try {
            if ((await stat(candidate)).isDirectory()) {
                return candidate
            }
        } catch {
            // Try the next runtime layout.
        }
    }

    throw new Error('Konteks skills are missing from this build.')
}
