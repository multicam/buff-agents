/**
 * File Editing Tasks
 * 
 * Tasks that test an agent's ability to read, create, and modify files.
 */

import { readFile, access } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkTask } from '../types'

export const fileEditingTasks: BenchmarkTask[] = [
    {
        id: 'edit-add-function',
        name: 'Add a new function',
        description: 'Add a modulo function to the calculator',
        category: 'file-editing',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'calculator',
        prompt: `Add a new function called "modulo" to src/calculator.ts that calculates the remainder of division (a % b). Make sure to export it.`,
        maxSteps: 10,
        timeoutMs: 60000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/calculator.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                const hasModuloFunction = /export\s+function\s+modulo\s*\(/.test(content)
                const hasCorrectImpl = content.includes('%')
                
                if (hasModuloFunction && hasCorrectImpl) {
                    return {
                        passed: true,
                        score: 100,
                        message: 'Successfully added modulo function',
                    }
                } else if (hasModuloFunction) {
                    return {
                        passed: true,
                        score: 70,
                        message: 'Added modulo function but implementation may be incorrect',
                    }
                }
                return {
                    passed: false,
                    score: 0,
                    message: 'Modulo function not found in file',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read calculator.ts',
                }
            }
        },
    },
    {
        id: 'edit-create-file',
        name: 'Create a new file',
        description: 'Create a new constants file',
        category: 'file-editing',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'calculator',
        prompt: `Create a new file src/constants.ts that exports mathematical constants: PI (3.14159), E (2.71828), and GOLDEN_RATIO (1.61803).`,
        maxSteps: 10,
        timeoutMs: 60000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/constants.ts')
            try {
                await access(filePath)
                const content = await readFile(filePath, 'utf-8')
                
                const hasPI = /export\s+(const|let|var)\s+PI/.test(content) && content.includes('3.14')
                const hasE = /export\s+(const|let|var)\s+E/.test(content) && content.includes('2.71')
                const hasGolden = /export\s+(const|let|var)\s+GOLDEN_RATIO/.test(content) && content.includes('1.61')
                
                const score = [hasPI, hasE, hasGolden].filter(Boolean).length * 33 + (hasPI && hasE && hasGolden ? 1 : 0)
                
                return {
                    passed: hasPI && hasE && hasGolden,
                    score,
                    message: `Found: PI=${hasPI}, E=${hasE}, GOLDEN_RATIO=${hasGolden}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'constants.ts file was not created',
                }
            }
        },
    },
    {
        id: 'edit-refactor-function',
        name: 'Refactor a function',
        description: 'Refactor divide to handle division by zero',
        category: 'file-editing',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'calculator',
        prompt: `Modify the divide function in src/calculator.ts to throw an Error with message "Division by zero" when the divisor (b) is zero.`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/calculator.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                const hasDivideFunction = /function\s+divide/.test(content)
                const hasZeroCheck = /b\s*===?\s*0|b\s*!==?\s*0|!b/.test(content)
                const hasThrow = /throw\s+new\s+Error/.test(content)
                const hasMessage = /["']Division by zero["']|["']division by zero["']/i.test(content)
                
                if (hasDivideFunction && hasZeroCheck && hasThrow && hasMessage) {
                    return {
                        passed: true,
                        score: 100,
                        message: 'Successfully added division by zero handling',
                    }
                } else if (hasDivideFunction && hasZeroCheck && hasThrow) {
                    return {
                        passed: true,
                        score: 80,
                        message: 'Added error handling but message may differ',
                    }
                } else if (hasDivideFunction && hasZeroCheck) {
                    return {
                        passed: false,
                        score: 40,
                        message: 'Has zero check but does not throw error',
                    }
                }
                return {
                    passed: false,
                    score: 0,
                    message: 'Division by zero handling not implemented',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read calculator.ts',
                }
            }
        },
    },
    {
        id: 'edit-update-exports',
        name: 'Update exports',
        description: 'Update index.ts to use named exports',
        category: 'file-editing',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'openai-editor', 'openrouter-editor', 'xai-editor'],
        projectDir: 'calculator',
        prompt: `Modify src/index.ts to individually export each function from calculator.ts (add, subtract, multiply, divide, power, sqrt) instead of using export *.`,
        maxSteps: 10,
        timeoutMs: 60000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/index.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                const functions = ['add', 'subtract', 'multiply', 'divide', 'power', 'sqrt']
                const exported = functions.filter(fn => 
                    new RegExp(`export\\s*\\{[^}]*${fn}[^}]*\\}`).test(content) ||
                    new RegExp(`export\\s+\\{\\s*${fn}`).test(content)
                )
                
                const score = Math.round((exported.length / functions.length) * 100)
                
                return {
                    passed: exported.length === functions.length,
                    score,
                    message: `Exported ${exported.length}/${functions.length} functions: ${exported.join(', ')}`,
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read index.ts',
                }
            }
        },
    },
]
