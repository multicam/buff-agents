/**
 * Multi-Step Tasks
 * 
 * Tasks that require multiple steps and planning.
 */

import { readFile, access } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkTask } from '../types'

export const multiStepTasks: BenchmarkTask[] = [
    {
        id: 'multi-add-feature',
        name: 'Add a complete feature',
        description: 'Add priority support to the todo store',
        category: 'multi-step',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'orchestrator'],
        projectDir: 'todo-app',
        prompt: `Add a setPriority method to the TodoStore class in src/store.ts that:
1. Takes listId, todoId, and priority ('low' | 'medium' | 'high') as parameters
2. Sets the priority on the specified todo
3. Updates the updatedAt timestamp
4. Returns true if successful, false if the todo was not found

Make sure to handle the case where the list or todo doesn't exist.`,
        maxSteps: 20,
        timeoutMs: 120000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/store.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                const hasMethod = /setPriority\s*\([^)]*listId[^)]*todoId[^)]*priority/.test(content)
                const hasPriorityParam = /priority\s*:\s*['"]?(low|medium|high)['"]?/.test(content) ||
                                        /priority:\s*Todo\['priority'\]/.test(content) ||
                                        /'low'\s*\|\s*'medium'\s*\|\s*'high'/.test(content)
                const updatesTimestamp = /updatedAt\s*=/.test(content)
                const returnsBoolean = /return\s+(true|false)/.test(content)
                
                let score = 0
                if (hasMethod) score += 40
                if (hasPriorityParam) score += 20
                if (updatesTimestamp) score += 20
                if (returnsBoolean) score += 20
                
                return {
                    passed: score >= 80,
                    score,
                    message: `Method: ${hasMethod}, Priority type: ${hasPriorityParam}, Updates timestamp: ${updatesTimestamp}, Returns boolean: ${returnsBoolean}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read store.ts',
                }
            }
        },
    },
    {
        id: 'multi-create-module',
        name: 'Create a new module',
        description: 'Create a statistics module for calculator',
        category: 'multi-step',
        difficulty: 'hard',
        targetAgents: ['simple-editor', 'orchestrator'],
        projectDir: 'calculator',
        prompt: `Create a new file src/statistics.ts with the following functions:
1. mean(numbers: number[]): number - calculates the average
2. median(numbers: number[]): number - calculates the median value
3. mode(numbers: number[]): number - finds the most common value
4. standardDeviation(numbers: number[]): number - calculates standard deviation

All functions should handle edge cases (empty arrays, etc.) appropriately.
Then update src/index.ts to export these new functions.`,
        maxSteps: 25,
        timeoutMs: 180000,
        validate: async (ctx) => {
            const statsPath = join(ctx.projectPath, 'src/statistics.ts')
            const indexPath = join(ctx.projectPath, 'src/index.ts')
            
            try {
                await access(statsPath)
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'statistics.ts was not created',
                }
            }
            
            const statsContent = await readFile(statsPath, 'utf-8')
            const indexContent = await readFile(indexPath, 'utf-8')
            
            const functions = ['mean', 'median', 'mode', 'standardDeviation']
            const foundFunctions = functions.filter(fn => 
                new RegExp(`export\\s+(function|const)\\s+${fn}`).test(statsContent)
            )
            
            const indexExportsStats = /statistics|mean|median|mode|standardDeviation/.test(indexContent)
            
            let score = Math.round((foundFunctions.length / functions.length) * 80)
            if (indexExportsStats) score += 20
            
            return {
                passed: score >= 80,
                score,
                message: `Found ${foundFunctions.length}/${functions.length} functions, index exports: ${indexExportsStats}`,
            }
        },
    },
    {
        id: 'multi-refactor-class',
        name: 'Refactor to use dependency injection',
        description: 'Refactor ApiClient to accept a fetcher',
        category: 'multi-step',
        difficulty: 'hard',
        targetAgents: ['simple-editor', 'orchestrator'],
        projectDir: 'api-client',
        prompt: `Refactor src/client.ts to support dependency injection:
1. Create a Fetcher interface with a fetch method matching the standard fetch API signature
2. Modify ApiClient constructor to optionally accept a Fetcher implementation
3. Default to the global fetch if no fetcher is provided
4. Use the injected fetcher instead of global fetch in the request method

This will make the client testable with mock fetchers.`,
        maxSteps: 25,
        timeoutMs: 180000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/client.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                const hasFetcherInterface = /interface\s+Fetcher/.test(content) ||
                                           /type\s+Fetcher/.test(content)
                const constructorAcceptsFetcher = /constructor\s*\([^)]*fetcher/.test(content)
                const storesFetcher = /this\.fetcher\s*=/.test(content) ||
                                     /private\s+(readonly\s+)?fetcher/.test(content)
                const usesFetcher = /this\.fetcher/.test(content)
                
                let score = 0
                if (hasFetcherInterface) score += 30
                if (constructorAcceptsFetcher) score += 30
                if (storesFetcher) score += 20
                if (usesFetcher) score += 20
                
                return {
                    passed: score >= 80,
                    score,
                    message: `Interface: ${hasFetcherInterface}, Constructor param: ${constructorAcceptsFetcher}, Stored: ${storesFetcher}, Used: ${usesFetcher}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read client.ts',
                }
            }
        },
    },
]
