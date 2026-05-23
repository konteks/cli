import type { IgnoreRuleSet } from './types'

export default {
    binaryExtensions: ['.pyc', '.pyo'],
    directoryNames: [
        '.eggs',
        '.hypothesis',
        '.ipynb_checkpoints',
        '.mypy_cache',
        '.nox',
        '.pytest_cache',
        '.ruff_cache',
        '.tox',
        '.venv',
        '__pycache__',
        'eggs',
        'htmlcov',
        'pip-wheel-metadata',
        'site-packages',
        'venv',
    ],
    fileNames: ['.coverage', 'coverage.xml'],
    lockFileNames: ['pipfile.lock', 'poetry.lock', 'uv.lock'],
} satisfies IgnoreRuleSet
