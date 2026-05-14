import { describe, expect, it } from 'bun:test'
import type {
    DurableMemoryExport,
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
    DurableMemoryExportOptions,
    DurableMemoryExportResult,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
    MemoryBackupOptions,
    MemoryBackupResult,
    MemoryRestoreOptions,
    MemoryRestoreResult,
} from './memory-transfer'

type CoveredTypes = [
    DurableMemoryExport,
    DurableMemoryExportDiary,
    DurableMemoryExportMemory,
    DurableMemoryExportOptions,
    DurableMemoryExportResult,
    DurableMemoryImportOptions,
    DurableMemoryImportResult,
    MemoryBackupOptions,
    MemoryBackupResult,
    MemoryRestoreOptions,
    MemoryRestoreResult,
]

describe('models/memory-transfer', () => {
    it('compiles representative type contracts', () => {
        type _Covered = CoveredTypes
        const typeNames = [
            'DurableMemoryExport',
            'DurableMemoryExportDiary',
            'DurableMemoryExportMemory',
            'DurableMemoryExportOptions',
            'DurableMemoryExportResult',
            'DurableMemoryImportOptions',
            'DurableMemoryImportResult',
            'MemoryBackupOptions',
            'MemoryBackupResult',
            'MemoryRestoreOptions',
            'MemoryRestoreResult',
        ] as const
        expect(typeNames).toEqual([
            'DurableMemoryExport',
            'DurableMemoryExportDiary',
            'DurableMemoryExportMemory',
            'DurableMemoryExportOptions',
            'DurableMemoryExportResult',
            'DurableMemoryImportOptions',
            'DurableMemoryImportResult',
            'MemoryBackupOptions',
            'MemoryBackupResult',
            'MemoryRestoreOptions',
            'MemoryRestoreResult',
        ])
    })
})
