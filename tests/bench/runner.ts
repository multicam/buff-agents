/**
 * Benchmark Runner
 * 
 * Core infrastructure for running agent benchmarks.
 */

import { mkdir, cp, rm } from 'fs/promises'
import { join } from 'path'
import { loadConfig } from '@/config'
import { createLLMRegistry } from '@/llm'
import { ToolRegistry } from '@/tools'
import { builtinTools } from '@/tools/builtin'
import { createAgentRuntime } from '@/runtime'
import type { AgentDefinition } from '@/core'
import type { RuntimeEvent } from '@/runtime'
import type {
    BenchmarkTask,
    BenchmarkConfig,
    BenchmarkResults,
    TaskResult,
    TaskMetrics,
    ToolCallRecord,
    ValidationContext,
    AgentSummary,
    TaskCategory,
    TaskDifficulty,
} from './types'

const BENCH_DIR = join(import.meta.dir, '.')
const PROJECTS_DIR = join(BENCH_DIR, 'projects')
const WORKSPACE_DIR = '/tmp/buff-agents-bench-workspace'

export class BenchmarkRunner {
    private agents: Map<string, AgentDefinition> = new Map()
    private tasks: BenchmarkTask[] = []
    private config: BenchmarkConfig

    constructor(config: BenchmarkConfig) {
        this.config = {
            parallel: false,
            concurrency: 1,
            saveResults: true,
            outputDir: join(BENCH_DIR, 'results'),
            ...config,
        }
    }

    registerAgent(agent: AgentDefinition): void {
        this.agents.set(agent.id, agent)
    }

    registerAgents(agents: AgentDefinition[]): void {
        for (const agent of agents) {
            this.registerAgent(agent)
        }
    }

    registerTask(task: BenchmarkTask): void {
        this.tasks.push(task)
    }

    registerTasks(tasks: BenchmarkTask[]): void {
        for (const task of tasks) {
            this.registerTask(task)
        }
    }

    async run(): Promise<BenchmarkResults> {
        const runId = crypto.randomUUID()
        const startedAt = new Date().toISOString()
        const startTime = Date.now()

        console.log(`\n🚀 Starting benchmark run: ${runId}\n`)

        // Filter tasks based on config
        const tasksToRun = this.filterTasks()
        console.log(`📋 Tasks to run: ${tasksToRun.length}`)

        // Filter agents based on config
        const agentsToRun = this.filterAgents()
        console.log(`🤖 Agents to benchmark: ${agentsToRun.map(a => a.id).join(', ')}\n`)

        // Ensure workspace directory exists
        await mkdir(WORKSPACE_DIR, { recursive: true })

        const taskResults: TaskResult[] = []

        // Run each task for each agent
        for (const task of tasksToRun) {
            const targetAgents = agentsToRun.filter(
                a => task.targetAgents.includes(a.id) || task.targetAgents.includes('*')
            )

            for (const agent of targetAgents) {
                console.log(`\n─────────────────────────────────────────`)
                console.log(`📌 Task: ${task.name} (${task.category}/${task.difficulty})`)
                console.log(`🤖 Agent: ${agent.displayName}`)
                console.log(`─────────────────────────────────────────`)

                const result = await this.runTask(task, agent)
                taskResults.push(result)

                const status = result.passed ? '✅ PASSED' : '❌ FAILED'
                console.log(`\n${status} - Score: ${result.score}/100`)
                console.log(`   Time: ${result.metrics.durationMs}ms | Cost: $${result.metrics.costUsd.toFixed(4)}`)
                console.log(`   Steps: ${result.metrics.stepsTaken} | Tools: ${result.metrics.toolCallCount}`)
            }
        }

        const completedAt = new Date().toISOString()
        const durationMs = Date.now() - startTime

        // Generate summaries
        const agentSummaries = this.generateAgentSummaries(taskResults, agentsToRun)
        const overallSummary = this.generateOverallSummary(taskResults)

        const results: BenchmarkResults = {
            runId,
            startedAt,
            completedAt,
            durationMs,
            taskResults,
            agentSummaries,
            overallSummary,
            config: this.config,
        }

        // Cleanup workspace (verify path is in /tmp for safety)
        if (WORKSPACE_DIR.startsWith('/tmp/')) {
            await rm(WORKSPACE_DIR, { recursive: true, force: true })
        }

        return results
    }

    private filterTasks(): BenchmarkTask[] {
        return this.tasks.filter(task => {
            if (this.config.taskIds?.length && !this.config.taskIds.includes(task.id)) {
                return false
            }
            if (this.config.categories?.length && !this.config.categories.includes(task.category)) {
                return false
            }
            if (this.config.difficulties?.length && !this.config.difficulties.includes(task.difficulty)) {
                return false
            }
            return true
        })
    }

    private filterAgents(): AgentDefinition[] {
        return Array.from(this.agents.values()).filter(
            a => this.config.agents.includes(a.id) || this.config.agents.includes('*')
        )
    }

    private async runTask(task: BenchmarkTask, agent: AgentDefinition): Promise<TaskResult> {
        const taskStartedAt = new Date().toISOString()
        const startTime = Date.now()

        // Create isolated workspace for this task
        const workspacePath = join(WORKSPACE_DIR, `${task.id}-${agent.id}-${Date.now()}`)
        const sourceProjectPath = join(PROJECTS_DIR, task.projectDir)

        try {
            // Copy project to workspace
            await mkdir(workspacePath, { recursive: true })
            await cp(sourceProjectPath, workspacePath, { recursive: true })

            // Run setup if defined
            if (task.setup) {
                await task.setup(workspacePath)
            }

            // Create runtime
            const appConfig = await loadConfig()
            const anthropicKey = appConfig.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
            const openaiKey = appConfig.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY
            const xaiKey = appConfig.providers?.xai?.apiKey ?? process.env.XAI_API_KEY
            const perplexityKey = appConfig.providers?.perplexity?.apiKey ?? process.env.PERPLEXITY_API_KEY
            const openrouterKey = appConfig.providers?.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY

            const llmRegistry = await createLLMRegistry({
                anthropic: anthropicKey ? { apiKey: anthropicKey } : undefined,
                openai: openaiKey ? { apiKey: openaiKey } : undefined,
                xai: xaiKey ? { apiKey: xaiKey } : undefined,
                perplexity: perplexityKey ? { apiKey: perplexityKey } : undefined,
                openrouter: openrouterKey ? { apiKey: openrouterKey } : undefined,
            })

            const toolRegistry = new ToolRegistry()
            toolRegistry.registerAll(builtinTools)

            // Track metrics during execution
            const toolCalls: ToolCallRecord[] = []
            let stepsTaken = 0
            let promptTokens = 0
            let completionTokens = 0

            const runtime = createAgentRuntime({
                llmRegistry,
                toolRegistry,
                projectContext: {
                    projectRoot: workspacePath,
                    cwd: workspacePath,
                },
                maxSteps: task.maxSteps ?? 20,
                onEvent: (event: RuntimeEvent) => {
                    if (event.type === 'step_start') {
                        stepsTaken = event.stepNumber
                    } else if (event.type === 'tool_start') {
                        toolCalls.push({
                            toolName: event.toolName,
                            input: event.input as Record<string, unknown>,
                            output: null,
                            durationMs: 0,
                        })
                    } else if (event.type === 'tool_result') {
                        const lastCall = toolCalls[toolCalls.length - 1]
                        if (lastCall) {
                            (lastCall as { output: unknown }).output = event.result
                        }
                    }
                },
            })

            // Run agent with timeout
            const timeoutMs = task.timeoutMs ?? 120000 // 2 min default
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), timeoutMs)

            let runResult
            try {
                runResult = await runtime.run({
                    agent,
                    prompt: task.prompt,
                    signal: controller.signal,
                })
            } finally {
                clearTimeout(timeout)
            }

            // Extract token usage from result
            const totalCost = runResult.totalCost

            // Validate the result
            const validationContext: ValidationContext = {
                projectPath: workspacePath,
                output: runResult.output.data ?? runResult.output.message,
                completed: runResult.output.type === 'success',
                stepsTaken,
                toolCalls,
            }

            const validation = await task.validate(validationContext)

            // Run cleanup if defined
            if (task.cleanup) {
                await task.cleanup(workspacePath)
            }

            // Build metrics
            const durationMs = Date.now() - startTime
            const toolCallsByType: Record<string, number> = {}
            for (const tc of toolCalls) {
                toolCallsByType[tc.toolName] = (toolCallsByType[tc.toolName] ?? 0) + 1
            }

            const metrics: TaskMetrics = {
                durationMs,
                stepsTaken,
                toolCallCount: toolCalls.length,
                toolCallsByType,
                totalTokens: promptTokens + completionTokens,
                promptTokens,
                completionTokens,
                costUsd: totalCost,
            }

            return {
                task,
                agent,
                passed: validation.passed,
                score: validation.score ?? (validation.passed ? 100 : 0),
                message: validation.message,
                metrics,
                startedAt: taskStartedAt,
                completedAt: new Date().toISOString(),
            }
        } catch (error) {
            const durationMs = Date.now() - startTime
            const errorMessage = error instanceof Error ? error.message : String(error)

            return {
                task,
                agent,
                passed: false,
                score: 0,
                message: `Task failed with error: ${errorMessage}`,
                metrics: {
                    durationMs,
                    stepsTaken: 0,
                    toolCallCount: 0,
                    toolCallsByType: {},
                    totalTokens: 0,
                    promptTokens: 0,
                    completionTokens: 0,
                    costUsd: 0,
                },
                error: errorMessage,
                startedAt: taskStartedAt,
                completedAt: new Date().toISOString(),
            }
        } finally {
            // Cleanup workspace (verify path is in /tmp for safety)
            if (workspacePath.startsWith('/tmp/')) {
                await rm(workspacePath, { recursive: true, force: true }).catch(() => {})
            }
        }
    }

    private generateAgentSummaries(
        results: TaskResult[],
        agents: AgentDefinition[]
    ): AgentSummary[] {
        return agents.map(agent => {
            const agentResults = results.filter(r => r.agent.id === agent.id)
            const passedResults = agentResults.filter(r => r.passed)

            const byCategory = this.summarizeByCategory(agentResults)
            const byDifficulty = this.summarizeByDifficulty(agentResults)

            return {
                agentId: agent.id,
                agentName: agent.displayName,
                totalTasks: agentResults.length,
                passedTasks: passedResults.length,
                passRate: agentResults.length > 0
                    ? (passedResults.length / agentResults.length) * 100
                    : 0,
                averageScore: agentResults.length > 0
                    ? agentResults.reduce((sum, r) => sum + r.score, 0) / agentResults.length
                    : 0,
                totalCostUsd: agentResults.reduce((sum, r) => sum + r.metrics.costUsd, 0),
                totalDurationMs: agentResults.reduce((sum, r) => sum + r.metrics.durationMs, 0),
                avgDurationMs: agentResults.length > 0
                    ? agentResults.reduce((sum, r) => sum + r.metrics.durationMs, 0) / agentResults.length
                    : 0,
                byCategory,
                byDifficulty,
            }
        })
    }

    private summarizeByCategory(results: TaskResult[]): Record<TaskCategory, { total: number; passed: number; passRate: number; avgScore: number }> {
        const categories: TaskCategory[] = ['file-editing', 'code-search', 'multi-step', 'bug-fixing', 'code-generation']
        const summary: Record<string, { total: number; passed: number; passRate: number; avgScore: number }> = {}

        for (const cat of categories) {
            const catResults = results.filter(r => r.task.category === cat)
            const passed = catResults.filter(r => r.passed)
            summary[cat] = {
                total: catResults.length,
                passed: passed.length,
                passRate: catResults.length > 0 ? (passed.length / catResults.length) * 100 : 0,
                avgScore: catResults.length > 0
                    ? catResults.reduce((sum, r) => sum + r.score, 0) / catResults.length
                    : 0,
            }
        }

        return summary as Record<TaskCategory, { total: number; passed: number; passRate: number; avgScore: number }>
    }

    private summarizeByDifficulty(results: TaskResult[]): Record<TaskDifficulty, { total: number; passed: number; passRate: number; avgScore: number }> {
        const difficulties: TaskDifficulty[] = ['easy', 'medium', 'hard']
        const summary: Record<string, { total: number; passed: number; passRate: number; avgScore: number }> = {}

        for (const diff of difficulties) {
            const diffResults = results.filter(r => r.task.difficulty === diff)
            const passed = diffResults.filter(r => r.passed)
            summary[diff] = {
                total: diffResults.length,
                passed: passed.length,
                passRate: diffResults.length > 0 ? (passed.length / diffResults.length) * 100 : 0,
                avgScore: diffResults.length > 0
                    ? diffResults.reduce((sum, r) => sum + r.score, 0) / diffResults.length
                    : 0,
            }
        }

        return summary as Record<TaskDifficulty, { total: number; passed: number; passRate: number; avgScore: number }>
    }

    private generateOverallSummary(results: TaskResult[]) {
        const passed = results.filter(r => r.passed)
        return {
            totalTasks: results.length,
            totalPassed: passed.length,
            overallPassRate: results.length > 0 ? (passed.length / results.length) * 100 : 0,
            totalCostUsd: results.reduce((sum, r) => sum + r.metrics.costUsd, 0),
            totalDurationMs: results.reduce((sum, r) => sum + r.metrics.durationMs, 0),
        }
    }
}

export function createBenchmarkRunner(config: BenchmarkConfig): BenchmarkRunner {
    return new BenchmarkRunner(config)
}
