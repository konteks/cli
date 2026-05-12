#!/usr/bin/env node
import { createCliProgram } from '@/app/controllers/cli/program'

await createCliProgram().parseAsync(process.argv)
