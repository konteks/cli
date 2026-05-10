import recall from './prompts/konteks-recall.md?raw'
import save from './prompts/konteks-save.md?raw'
import warmUp from './prompts/konteks-warm-up.md?raw'
import workOnExisting from './prompts/konteks-work-on-existing.md?raw'
import workOnNew from './prompts/konteks-work-on-new.md?raw'

export const promptFiles = [
    {
        fileName: 'konteks-warm-up.md',
        raw: warmUp,
    },
    {
        fileName: 'konteks-recall.md',
        raw: recall,
    },
    {
        fileName: 'konteks-work-on-existing.md',
        raw: workOnExisting,
    },
    {
        fileName: 'konteks-work-on-new.md',
        raw: workOnNew,
    },
    {
        fileName: 'konteks-save.md',
        raw: save,
    },
] as const
