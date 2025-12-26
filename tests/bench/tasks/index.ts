/**
 * Benchmark Tasks
 * 
 * All benchmark task definitions.
 */

export * from './file-editing'
export * from './code-search'
export * from './multi-step'
export * from './bug-fixing'
export * from './code-generation'

import { fileEditingTasks } from './file-editing'
import { codeSearchTasks } from './code-search'
import { multiStepTasks } from './multi-step'
import { bugFixingTasks } from './bug-fixing'
import { codeGenerationTasks } from './code-generation'
import type { BenchmarkTask } from '../types'

export const allTasks: BenchmarkTask[] = [
    ...fileEditingTasks,
    ...codeSearchTasks,
    ...multiStepTasks,
    ...bugFixingTasks,
    ...codeGenerationTasks,
]
