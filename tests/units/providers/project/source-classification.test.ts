import { describe, expect, it } from 'bun:test'
import {
    classifySourceRole,
    detectLanguage,
} from '@/modules/project/source-classification'

describe('detectLanguage', () => {
    it('detects supported languages from extensions', () => {
        expect(detectLanguage('src/index.ts')).toBe('typescript')
        expect(detectLanguage('src/view.tsx')).toBe('tsx')
        expect(detectLanguage('src/index.js')).toBe('javascript')
        expect(detectLanguage('src/component.jsx')).toBe('javascript')
        expect(detectLanguage('lib/main.dart')).toBe('dart')
        expect(detectLanguage('README.md')).toBe('markdown')
        expect(detectLanguage('package.json')).toBe('json')
        expect(detectLanguage('index.html')).toBe('html')
        expect(detectLanguage('index.php')).toBe('php')
        expect(detectLanguage('api.jsdoc')).toBe('jsdoc')
        expect(detectLanguage('docker-compose.yaml')).toBe('yaml')
        expect(detectLanguage('src/types.d.ts')).toBe('typescript_declaration')
        expect(detectLanguage('Sources/App.swift')).toBe('swift')
        expect(detectLanguage('schema.sql')).toBe('unknown')
        expect(detectLanguage('Makefile')).toBe('unknown')
    })
})

describe('classifySourceRole', () => {
    it('classifies known project paths by retrieval role', () => {
        expect(classifySourceRole('src/index.ts')).toBe('app_code')
        expect(classifySourceRole('src/index.test.ts')).toBe('test_code')
        expect(classifySourceRole('README.md')).toBe('product_doc')
        expect(classifySourceRole('package.json')).toBe('package_config')
        expect(classifySourceRole('composer.json')).toBe('package_config')
        expect(classifySourceRole('pubspec.yaml')).toBe('package_config')
        expect(classifySourceRole('pyproject.toml')).toBe('package_config')
        expect(classifySourceRole('go.mod')).toBe('package_config')
        expect(classifySourceRole('Cargo.toml')).toBe('package_config')
        expect(classifySourceRole('Gemfile')).toBe('package_config')
        expect(classifySourceRole('Package.swift')).toBe('package_config')
        expect(classifySourceRole('app.csproj')).toBe('package_config')
        expect(classifySourceRole('biome.json')).toBe('tooling_config')
        expect(classifySourceRole('analysis_options.yaml')).toBe(
            'tooling_config',
        )
        expect(classifySourceRole('.github/workflows/ci.yml')).toBe(
            'tooling_config',
        )
        expect(classifySourceRole('.agents/skills/foo/SKILL.md')).toBe(
            'agent_reference',
        )
        expect(classifySourceRole('.agents/config.json')).toBe('agent_config')
        expect(
            classifySourceRole('.specs/EXTRACTION_IMPROVEMENT_PLAN.md'),
        ).toBe('implementation_plan')
        expect(classifySourceRole('src/generated/client.ts')).toBe('generated')
        expect(classifySourceRole('Sources/App.swift')).toBe('app_code')
        expect(classifySourceRole('notes.unknown')).toBe('unknown')
    })
})
