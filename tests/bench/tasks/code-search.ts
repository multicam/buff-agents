/**
 * Code Search Tasks
 * 
 * Tasks that test an agent's ability to search and analyze code.
 */

import type { BenchmarkTask } from '../types'

export const codeSearchTasks: BenchmarkTask[] = [
    {
        id: 'search-find-function',
        name: 'Find a specific function',
        description: 'Find all functions that return a number',
        category: 'code-search',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'file-explorer'],
        projectDir: 'calculator',
        prompt: `List all the exported functions in src/calculator.ts that return a number. Output the function names as a JSON array using set_output.`,
        maxSteps: 10,
        timeoutMs: 60000,
        validate: async (ctx) => {
            const expectedFunctions = ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt']
            
            let output = ctx.output
            if (typeof output === 'string') {
                try {
                    output = JSON.parse(output)
                } catch {
                    // Try to extract array from string
                    const match = output.match(/\[([^\]]+)\]/)
                    if (match) {
                        output = match[1].split(',').map((s: string) => s.trim().replace(/["']/g, ''))
                    }
                }
            }
            
            if (Array.isArray(output)) {
                const found = output.filter((fn: string) => expectedFunctions.includes(fn))
                const score = Math.round((found.length / expectedFunctions.length) * 100)
                return {
                    passed: found.length >= 5,
                    score,
                    message: `Found ${found.length}/${expectedFunctions.length} functions`,
                }
            }
            
            return {
                passed: false,
                score: 0,
                message: 'Output was not a valid array of function names',
            }
        },
    },
    {
        id: 'search-count-exports',
        name: 'Count exports',
        description: 'Count the number of exported items in a project',
        category: 'code-search',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'file-explorer'],
        projectDir: 'todo-app',
        prompt: `Count the total number of exported items (functions, classes, types, interfaces) across all .ts files in the src/ directory. Output as JSON: { "count": <number>, "breakdown": { "functions": <n>, "classes": <n>, "types": <n>, "interfaces": <n> } }`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            // Expected: TodoStore class, 3 types (Todo, TodoList, TodoFilter), various methods
            let output = ctx.output
            if (typeof output === 'string') {
                try {
                    output = JSON.parse(output)
                } catch {
                    return {
                        passed: false,
                        score: 0,
                        message: 'Output was not valid JSON',
                    }
                }
            }
            
            const result = output as Record<string, unknown>
            const count = typeof result.count === 'number' ? result.count : 0
            
            // Reasonable range: at least 4 exports (TodoStore, Todo, TodoList, TodoFilter)
            if (count >= 4 && count <= 20) {
                return {
                    passed: true,
                    score: 100,
                    message: `Found ${count} exports - reasonable count`,
                }
            } else if (count >= 2) {
                return {
                    passed: true,
                    score: 60,
                    message: `Found ${count} exports - partially correct`,
                }
            }
            
            return {
                passed: false,
                score: 0,
                message: `Count ${count} seems incorrect`,
            }
        },
    },
    {
        id: 'search-find-pattern',
        name: 'Find code pattern',
        description: 'Find all uses of a specific pattern',
        category: 'code-search',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'file-explorer'],
        projectDir: 'todo-app',
        prompt: `Find all methods in src/store.ts that return a boolean. List them as JSON: { "methods": ["methodName1", "methodName2"] }`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            // Expected: toggleTodo, deleteTodo both return boolean
            const expected = ['toggleTodo', 'deleteTodo']
            
            let output = ctx.output
            if (typeof output === 'string') {
                try {
                    output = JSON.parse(output)
                } catch {
                    return {
                        passed: false,
                        score: 0,
                        message: 'Output was not valid JSON',
                    }
                }
            }
            
            const result = output as Record<string, unknown>
            const methods = Array.isArray(result.methods) ? result.methods : []
            
            const found = expected.filter(m => methods.includes(m))
            const score = Math.round((found.length / expected.length) * 100)
            
            return {
                passed: found.length === expected.length,
                score,
                message: `Found ${found.length}/${expected.length}: ${found.join(', ')}`,
            }
        },
    },
]
