/**
 * Bug Fixing Tasks
 * 
 * Tasks that test an agent's ability to identify and fix bugs.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkTask } from '../types'

export const bugFixingTasks: BenchmarkTask[] = [
    {
        id: 'bug-capitalize',
        name: 'Fix capitalize function',
        description: 'Fix the capitalize function to handle single characters',
        category: 'bug-fixing',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'code-reviewer'],
        projectDir: 'buggy-utils',
        prompt: `The capitalize function in src/strings.ts has a bug: it returns an empty string for single-character inputs instead of capitalizing them. Fix this bug so that capitalize("a") returns "A".`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/strings.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                // Check that the length <= 1 bug is removed
                const stillHasBug = /str\.length\s*<=?\s*1/.test(content) &&
                                   /return\s*['"]['"]/s.test(content)
                
                // Check for proper single char handling
                const handlesSingleChar = /str\.length\s*===?\s*0/.test(content) ||
                                         /!str\.length/.test(content) ||
                                         /str\s*===?\s*['"]['"']/.test(content) ||
                                         /!str/.test(content)
                
                if (!stillHasBug) {
                    return {
                        passed: true,
                        score: 100,
                        message: 'Bug fixed - capitalize now handles single characters',
                    }
                }
                
                return {
                    passed: false,
                    score: handlesSingleChar ? 50 : 0,
                    message: 'Bug still present - single characters return empty string',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read strings.ts',
                }
            }
        },
    },
    {
        id: 'bug-palindrome',
        name: 'Fix isPalindrome case sensitivity',
        description: 'Make isPalindrome case-insensitive',
        category: 'bug-fixing',
        difficulty: 'easy',
        targetAgents: ['simple-editor', 'code-reviewer'],
        projectDir: 'buggy-utils',
        prompt: `The isPalindrome function in src/strings.ts has a bug: it's case-sensitive, so isPalindrome("Racecar") returns false. Fix it to be case-insensitive.`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/strings.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                // Check for toLowerCase or toUpperCase in isPalindrome
                const isPalindromeFn = content.match(/function\s+isPalindrome[\s\S]*?return[^}]+/)
                
                if (isPalindromeFn) {
                    const fnContent = isPalindromeFn[0]
                    const hasCaseConversion = /toLowerCase|toUpperCase/.test(fnContent)
                    
                    if (hasCaseConversion) {
                        return {
                            passed: true,
                            score: 100,
                            message: 'Bug fixed - isPalindrome is now case-insensitive',
                        }
                    }
                }
                
                return {
                    passed: false,
                    score: 0,
                    message: 'isPalindrome is still case-sensitive',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read strings.ts',
                }
            }
        },
    },
    {
        id: 'bug-truncate',
        name: 'Fix truncate off-by-one',
        description: 'Fix the off-by-one error in truncate',
        category: 'bug-fixing',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'code-reviewer'],
        projectDir: 'buggy-utils',
        prompt: `The truncate function in src/strings.ts has an off-by-one error. When maxLength is 10, it should return a string of exactly 10 characters (including the "..."). Currently truncate("hello world", 10) returns 9 characters. Fix this bug.`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/strings.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                // The fix should change maxLength - 1 to maxLength - 3
                // or use a different approach that results in correct length
                const truncateFn = content.match(/function\s+truncate[\s\S]*?^\}/m)
                
                if (truncateFn) {
                    const fnContent = truncateFn[0]
                    // Should slice to maxLength - 3 (for "...")
                    const hasCorrectSlice = /slice\s*\(\s*0\s*,\s*maxLength\s*-\s*3\s*\)/.test(fnContent) ||
                                           /substring\s*\(\s*0\s*,\s*maxLength\s*-\s*3\s*\)/.test(fnContent)
                    // Or compares with maxLength correctly
                    const hasCorrectComparison = /str\.length\s*<=\s*maxLength/.test(fnContent)
                    
                    if (hasCorrectSlice || (hasCorrectComparison && !fnContent.includes('maxLength - 1'))) {
                        return {
                            passed: true,
                            score: 100,
                            message: 'Bug fixed - truncate now produces correct length',
                        }
                    }
                }
                
                return {
                    passed: false,
                    score: 0,
                    message: 'Off-by-one error still present',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read strings.ts',
                }
            }
        },
    },
    {
        id: 'bug-average-divzero',
        name: 'Fix division by zero',
        description: 'Fix the average function to handle empty arrays',
        category: 'bug-fixing',
        difficulty: 'medium',
        targetAgents: ['simple-editor', 'code-reviewer'],
        projectDir: 'buggy-utils',
        prompt: `The average function in src/arrays.ts has a bug: it divides by zero for empty arrays, returning NaN. Fix it to throw an Error with message "Cannot calculate average of empty array" when given an empty array.`,
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            const filePath = join(ctx.projectPath, 'src/arrays.ts')
            try {
                const content = await readFile(filePath, 'utf-8')
                
                const averageFn = content.match(/function\s+average[\s\S]*?^\}/m)
                
                if (averageFn) {
                    const fnContent = averageFn[0]
                    const checksEmpty = /arr\.length\s*===?\s*0|!arr\.length|arr\.length\s*<\s*1/.test(fnContent)
                    const throwsError = /throw\s+new\s+Error/.test(fnContent)
                    const hasMessage = /empty\s*array/i.test(fnContent)
                    
                    let score = 0
                    if (checksEmpty) score += 40
                    if (throwsError) score += 40
                    if (hasMessage) score += 20
                    
                    return {
                        passed: score >= 80,
                        score,
                        message: `Checks empty: ${checksEmpty}, Throws: ${throwsError}, Has message: ${hasMessage}`,
                    }
                }
                
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not find average function',
                }
            } catch {
                return {
                    passed: false,
                    score: 0,
                    message: 'Could not read arrays.ts',
                }
            }
        },
    },
]
