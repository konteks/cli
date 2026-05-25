import { afterEach, describe, expect, it } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import extractProjectMetadata from '@/modules/extraction/engine/extract-project-metadata'
import { scanProjectFilesWithDiagnostics } from '@/modules/extraction/engine/file-scan'

const tempDirs: string[] = []

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map(path => rm(path, { force: true, recursive: true })),
    )
})

describe('extractProjectMetadata', () => {
    it('extracts package, dependency, and workspace metadata', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'packages', 'app'), { recursive: true })
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify(
                {
                    dependencies: { react: '^19.0.0' },
                    devDependencies: { typescript: '^6.0.0' },
                    name: 'workspace-fixture',
                    optionalDependencies: { sharp: '^1.0.0' },
                    packageManager: 'bun@1.3.12',
                    peerDependencies: { zod: '^4.0.0' },
                    scripts: { test: 'bun test' },
                    workspaces: ['packages/*'],
                },
                null,
                2,
            ),
        )
        await writeFile(join(projectRoot, 'turbo.json'), '{}\n')
        await writeFile(join(projectRoot, 'packages', 'app', 'index.ts'), '')

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata).toMatchObject({
            dependencies: ['react'],
            devDependencies: ['typescript'],
            name: 'workspace-fixture',
            optionalDependencies: ['sharp'],
            packageManager: 'bun@1.3.12',
            peerDependencies: ['zod'],
            scripts: ['test'],
            workspaceGlobs: ['packages/*'],
            workspaceManager: 'turbo',
        })
        expect(metadata.packageManifests).toEqual([
            expect.objectContaining({
                manager: 'bun@1.3.12',
                path: 'package.json',
            }),
        ])
    })

    it('extracts Composer and PHP framework metadata', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'public'), { recursive: true })
        await writeFile(
            join(projectRoot, 'composer.json'),
            JSON.stringify({
                description: 'A Laravel API.',
                name: 'acme/api',
                require: {
                    'laravel/framework': '^12.0',
                    php: '^8.3',
                },
                'require-dev': {
                    phpunit: '^11.0',
                },
            }),
        )
        await writeFile(join(projectRoot, 'artisan'), '#!/usr/bin/env php\n')
        await writeFile(join(projectRoot, 'public', 'index.php'), '<?php\n')

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata).toMatchObject({
            dependencies: ['laravel/framework'],
            description: 'A Laravel API.',
            devDependencies: ['phpunit'],
            entryPoints: ['artisan', 'public/index.php'],
            name: 'acme/api',
            packageManager: 'composer',
            packagePath: 'composer.json',
            technologies: ['composer', 'laravel', 'php'],
        })
    })

    it('prefers Composer descriptions over README setup bullets in Laravel Inertia apps', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'public'), { recursive: true })
        await writeFile(
            join(projectRoot, 'composer.json'),
            JSON.stringify({
                description: 'A Laravel Inertia application.',
                name: 'acme/inertia-app',
                require: {
                    'inertiajs/inertia-laravel': '^2.0',
                    'laravel/framework': '^12.0',
                    php: '^8.3',
                },
            }),
        )
        await writeFile(
            join(projectRoot, 'package.json'),
            JSON.stringify({
                dependencies: {
                    '@inertiajs/vue3': '^2.0.0',
                    vite: '^6.0.0',
                    vue: '^3.5.0',
                },
                scripts: { build: 'vite build' },
            }),
        )
        await writeFile(
            join(projectRoot, 'README.md'),
            ['# Setup', '', '- git clone.', '- composer install.', ''].join(
                '\n',
            ),
        )
        await writeFile(join(projectRoot, 'artisan'), '#!/usr/bin/env php\n')
        await writeFile(join(projectRoot, 'public', 'index.php'), '<?php\n')

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata).toMatchObject({
            description: 'A Laravel Inertia application.',
            name: 'acme/inertia-app',
            packageManager: 'npm',
            packagePath: 'package.json',
        })
        expect(metadata.dependencies).toEqual(
            expect.arrayContaining([
                '@inertiajs/vue3',
                'inertiajs/inertia-laravel',
                'laravel/framework',
            ]),
        )
    })

    it('extracts Flutter pubspec metadata', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'lib'), { recursive: true })
        await writeFile(
            join(projectRoot, 'pubspec.yaml'),
            [
                'name: mobile_app',
                'description: Flutter client.',
                'dependencies:',
                '  flutter:',
                '    sdk: flutter',
                '  provider: ^6.0.0',
                'dev_dependencies:',
                '  flutter_test:',
                '    sdk: flutter',
                'flutter:',
                '  uses-material-design: true',
                '',
            ].join('\n'),
        )
        await writeFile(
            join(projectRoot, 'lib', 'main.dart'),
            'void main() {}\n',
        )

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata).toMatchObject({
            dependencies: ['flutter', 'provider'],
            description: 'Flutter client.',
            devDependencies: ['flutter_test'],
            entryPoints: ['lib/main.dart'],
            name: 'mobile_app',
            packageManager: 'pub',
            packagePath: 'pubspec.yaml',
            technologies: ['dart', 'flutter', 'pub'],
        })
    })

    it('extracts common non-Node project manifests', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'cmd', 'app'), { recursive: true })
        await mkdir(join(projectRoot, 'src'), { recursive: true })
        await writeFile(
            join(projectRoot, 'pyproject.toml'),
            [
                '[project]',
                'name = "service"',
                'description = "Python service."',
                'dependencies = ["fastapi", "uvicorn"]',
                '',
            ].join('\n'),
        )
        await writeFile(
            join(projectRoot, 'go.mod'),
            'module example.com/service\n\nrequire github.com/spf13/cobra v1.8.0\n',
        )
        await writeFile(
            join(projectRoot, 'Cargo.toml'),
            '[package]\nname = "worker"\n\n[dependencies]\nserde = "1"\n',
        )
        await writeFile(
            join(projectRoot, 'cmd', 'app', 'main.go'),
            'package main\n',
        )
        await writeFile(join(projectRoot, 'src', 'main.rs'), 'fn main() {}\n')

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata.packageManifests).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    manager: 'pyproject',
                    path: 'pyproject.toml',
                }),
                expect.objectContaining({
                    manager: 'go modules',
                    path: 'go.mod',
                }),
                expect.objectContaining({
                    manager: 'cargo',
                    path: 'Cargo.toml',
                }),
            ]),
        )
        expect(metadata.dependencies).toEqual(
            expect.arrayContaining([
                'fastapi',
                'github.com/spf13/cobra',
                'serde',
                'uvicorn',
            ]),
        )
        expect(metadata.entryPoints).toEqual(
            expect.arrayContaining(['cmd/app/main.go', 'src/main.rs']),
        )
        expect(metadata.technologies).toEqual(
            expect.arrayContaining([
                'cargo',
                'fastapi',
                'go',
                'python',
                'rust',
            ]),
        )
    })

    it('extracts JVM, Ruby, Swift, and .NET manifests', async () => {
        const projectRoot = await mkdtemp(join(tmpdir(), 'konteks-meta-test-'))
        tempDirs.push(projectRoot)
        await mkdir(join(projectRoot, 'src', 'main', 'java'), {
            recursive: true,
        })
        await writeFile(
            join(projectRoot, 'build.gradle'),
            'dependencies { implementation("org.springframework.boot:spring-boot-starter-web:3.0.0") }\n',
        )
        await writeFile(join(projectRoot, 'Gemfile'), 'gem "rails"\n')
        await writeFile(
            join(projectRoot, 'Package.swift'),
            [
                'let package = Package(',
                '  name: "ios-client",',
                '  dependencies: [.package(url: "https://github.com/apple/example", from: "1.0.0")]',
                ')',
                '',
            ].join('\n'),
        )
        await writeFile(
            join(projectRoot, 'app.csproj'),
            '<Project><ItemGroup><PackageReference Include="Newtonsoft.Json" Version="13.0.0" /></ItemGroup></Project>\n',
        )
        await writeFile(
            join(projectRoot, 'src', 'main', 'java', 'App.java'),
            'class App {}\n',
        )

        const scan = await scanProjectFilesWithDiagnostics(projectRoot)
        const metadata = await extractProjectMetadata(projectRoot, scan.files)

        expect(metadata.packageManifests).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    manager: 'gradle',
                    path: 'build.gradle',
                }),
                expect.objectContaining({
                    manager: 'bundler',
                    path: 'Gemfile',
                }),
                expect.objectContaining({
                    manager: 'swift package manager',
                    path: 'Package.swift',
                }),
                expect.objectContaining({
                    manager: 'dotnet',
                    path: 'app.csproj',
                }),
            ]),
        )
        expect(metadata.dependencies).toEqual(
            expect.arrayContaining([
                'Newtonsoft.Json',
                'https://github.com/apple/example',
                'org.springframework.boot:spring-boot-starter-web',
                'rails',
            ]),
        )
        expect(metadata.technologies).toEqual(
            expect.arrayContaining([
                'bundler',
                'csharp',
                'dotnet',
                'gradle',
                'java',
                'rails',
                'ruby',
                'swift',
            ]),
        )
    })
})
