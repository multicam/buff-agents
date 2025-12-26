/**
 * Code Generation Tasks
 * 
 * Tasks that test an agent's ability to generate new code.
 */

import { readFile, access } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkTask } from '../types'

export const codeGenerationTasks: BenchmarkTask[] = [
    {
        id: 'gen-interface',
        name: 'Generate TypeScript interface',
        description: 'Generate an interface from a description',
        category: 'code-generation',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'api-client',
        prompt: `Create a new file src/types.ts with a TypeScript interface called "User" that has:
- id: string
- email: string
- name: string
- createdAt: Date
- updatedAt: Date
- isActive: boolean
- role: 'admin' | 'user' | 'guest'

Export the interface.`,
        maxSteps: 10,
        timeoutMs: 60000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/types.ts')
            try {
                await access(filePath)
                const content = await readFile(filePath, 'utf-8')
                
                const hasInterface = /export\s+interface\s+User/.test(content)
                const hasId = /id\s*:\s*string/.test(content)
                const hasEmail = /email\s*:\s*string/.test(content)
                const hasName = /name\s*:\s*string/.test(content)
                const hasCreatedAt = /createdAt\s*:\s*Date/.test(content)
                const hasUpdatedAt = /updatedAt\s*:\s*Date/.test(content)
                const hasIsActive = /isActive\s*:\s*boolean/.test(content)
                const hasRole = /role\s*:\s*['"]admin['"]\s*\|\s*['"]user['"]\s*\|\s*['"]guest['"]/.test(content) ||
                               /role\s*:\s*'admin'\s*\|\s*'user'\s*\|\s*'guest'/.test(content)
                
                const fields = [hasInterface, hasId, hasEmail, hasName, hasCreatedAt, hasUpdatedAt, hasIsActive, hasRole]
                const score = Math.round((fields.filter(Boolean).length / fields.length) * 100)
                
                return {
                    passed: score >= 80,
                    score,
                    message: `Interface fields: ${fields.filter(Boolean).length}/${fields.length}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'types.ts was not created',
                }
            }
        },
    },
    {
        id: 'gen-utility-function',
        name: 'Generate utility function',
        description: 'Generate a debounce utility function',
        category: 'code-generation',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'api-client',
        prompt: `Create a new file src/utils.ts with a debounce function that:
- Takes a function and a delay in milliseconds
- Returns a debounced version of the function
- Uses proper TypeScript generics to preserve the function's type
- Cancels pending calls when called again within the delay

Export the function.`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/utils.ts')
            try {
                await access(filePath)
                const content = await readFile(filePath, 'utf-8')
                
                const hasExport = /export\s+(function|const)\s+debounce/.test(content)
                const hasTimeout = /setTimeout/.test(content)
                const hasClear = /clearTimeout/.test(content)
                const hasGenerics = /<[^>]+>/.test(content) // Has some generic syntax
                const hasParameters = /fn\s*:|func\s*:|callback\s*:/.test(content) &&
                                     /delay\s*:|ms\s*:|wait\s*:/.test(content)
                
                let score = 0
                if (hasExport) score += 20
                if (hasTimeout) score += 25
                if (hasClear) score += 25
                if (hasGenerics) score += 15
                if (hasParameters) score += 15
                
                return {
                    passed: score >= 70,
                    score,
                    message: `Export: ${hasExport}, setTimeout: ${hasTimeout}, clearTimeout: ${hasClear}, Generics: ${hasGenerics}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'utils.ts was not created',
                }
            }
        },
    },
    {
        id: 'gen-test-file',
        name: 'Generate test file',
        description: 'Generate unit tests for the calculator',
        category: 'code-generation',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'openai-editor'],
        projectDir: 'calculator',
        prompt: `Create a test file src/calculator.test.ts that tests the add, subtract, multiply, and divide functions from calculator.ts.

Use simple assertions (you can use console.assert or throw errors for failed assertions).
Include at least 2 test cases per function, including edge cases like negative numbers and zero.`,
        maxSteps: 20,
        timeoutMs: 120000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/calculator.test.ts')
            try {
                await access(filePath)
                const content = await readFile(filePath, 'utf-8')
                
                const importsCalculator = /import.*from\s*['"]\.\/calculator['"]/.test(content) ||
                                         /require.*calculator/.test(content)
                const testsAdd = /add\s*\(/.test(content)
                const testsSubtract = /subtract\s*\(/.test(content)
                const testsMultiply = /multiply\s*\(/.test(content)
                const testsDivide = /divide\s*\(/.test(content)
                const hasAssertions = /assert|expect|===|!==|throw/.test(content)
                const hasEdgeCases = /-\d|\b0\b/.test(content) // Tests with negative or zero
                
                const checks = [importsCalculator, testsAdd, testsSubtract, testsMultiply, testsDivide, hasAssertions]
                let score = Math.round((checks.filter(Boolean).length / checks.length) * 80)
                if (hasEdgeCases) score += 20
                
                return {
                    passed: score >= 70,
                    score: Math.min(score, 100),
                    message: `Tests: add=${testsAdd}, subtract=${testsSubtract}, multiply=${testsMultiply}, divide=${testsDivide}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'calculator.test.ts was not created',
                }
            }
        },
    },
    {
        id: 'gen-class',
        name: 'Generate a class',
        description: 'Generate a Logger class',
        category: 'code-generation',
        difficulty: 'hard',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'api-client',
        prompt: `Create a new file src/logger.ts with a Logger class that:
- Has log levels: 'debug', 'info', 'warn', 'error'
- Has a constructor that accepts a minimum log level (default: 'info')
- Has methods: debug(), info(), warn(), error() that each take a message and optional context object
- Only logs messages at or above the minimum level
- Formats output as: [LEVEL] [timestamp] message {context}
- Is exported as both a class and a default singleton instance

Make it properly typed with TypeScript.`,
        maxSteps: 25,
        timeoutMs: 150000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/logger.ts')
            try {
                await access(filePath)
                const content = await readFile(filePath, 'utf-8')
                
                const hasClass = /export\s+class\s+Logger/.test(content)
                const hasLevelType = /type\s+LogLevel|'debug'\s*\|\s*'info'/.test(content)
                const hasConstructor = /constructor\s*\([^)]*level/.test(content)
                const hasDebug = /debug\s*\([^)]*message/.test(content)
                const hasInfo = /info\s*\([^)]*message/.test(content)
                const hasWarn = /warn\s*\([^)]*message/.test(content)
                const hasError = /error\s*\([^)]*message/.test(content)
                const hasTimestamp = /Date|timestamp|toISOString/.test(content)
                const hasDefaultExport = /export\s+default|export\s*{[^}]*default/.test(content) ||
                                        /export\s+const\s+\w+\s*=\s*new\s+Logger/.test(content)
                
                const checks = [hasClass, hasLevelType, hasConstructor, hasDebug, hasInfo, hasWarn, hasError, hasTimestamp, hasDefaultExport]
                const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
                
                return {
                    passed: score >= 70,
                    score,
                    message: `Class: ${hasClass}, Methods: debug=${hasDebug} info=${hasInfo} warn=${hasWarn} error=${hasError}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'logger.ts was not created',
                }
            }
        },
    },
]
