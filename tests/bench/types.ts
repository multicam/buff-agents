/**
 * Benchmark Types
 * 
 * Type definitions for the agent benchmarking infrastructure.
 */

import type { AgentDefinition } from '@/core'

/**
 * Categories of benchmark tasks
 */
export type TaskCategory = 
    | 'file-editing'
    | 'code-search'
    | 'multi-step'
    | 'bug-fixing'
    | 'code-generation'

/**
 * Difficulty levels for tasks
 */
export type TaskDifficulty = 'easy' | 'medium' | 'hard'

/**
 * Definition of a benchmark task
 */
export interface BenchmarkTask {
    /** Unique task identifier */
    readonly id: string
    /** Human-readable task name */
    readonly name: string
    /** Task description */
    readonly description: string
    /** Task category */
    readonly category: TaskCategory
    /** Difficulty level */
    readonly difficulty: TaskDifficulty
    /** Which agents can run this task */
    readonly targetAgents: string[]
    /** The prompt to send to the agent */
    readonly prompt: string
    /** Project directory to use (relative to tests/bench/projects/) */
    readonly projectDir: string
    /** Maximum steps allowed */
    readonly maxSteps?: number
    /** Timeout in milliseconds */
    readonly timeoutMs?: number
    /** Validation function to check if task succeeded */
    readonly validate: (context: ValidationContext) => Promise<ValidationResult>
    /** Optional setup function before running */
    readonly setup?: (projectPath: string) => Promise<void>
    /** Optional cleanup function after running */
    readonly cleanup?: (projectPath: string) => Promise<void>
}

/**
 * Context passed to validation functions
 */
export interface ValidationContext {
    /** Path to the project directory */
    readonly projectPath: string
    /** Agent output */
    readonly output: unknown
    /** Whether the agent completed without errors */
    readonly completed: boolean
    /** Number of steps taken */
    readonly stepsTaken: number
    /** Tool calls made during execution */
    readonly toolCalls: ToolCallRecord[]
}

/**
 * Result of task validation
 */
export interface ValidationResult {
    /** Whether the task passed */
    readonly passed: boolean
    /** Score from 0-100 (optional for partial credit) */
    readonly score?: number
    /** Explanation of the result */
    readonly message: string
    /** Detailed findings */
    readonly details?: Record<string, unknown>
}

/**
 * Record of a tool call during execution
 */
export interface ToolCallRecord {
    readonly toolName: string
    readonly input: Record<string, unknown>
    readonly output: unknown
    readonly durationMs: number
}

/**
 * Comprehensive metrics for a task run
 */
export interface TaskMetrics {
    /** Total execution time in ms */
    readonly durationMs: number
    /** Number of steps taken */
    readonly stepsTaken: number
    /** Number of tool calls */
    readonly toolCallCount: number
    /** Tool calls by name */
    readonly toolCallsByType: Record<string, number>
    /** Total tokens used (prompt + completion) */
    readonly totalTokens: number
    /** Prompt tokens */
    readonly promptTokens: number
    /** Completion tokens */
    readonly completionTokens: number
    /** Estimated cost in USD */
    readonly costUsd: number
}

/**
 * Result of running a single benchmark task
 */
export interface TaskResult {
    /** Task that was run */
    readonly task: BenchmarkTask
    /** Agent that ran the task */
    readonly agent: AgentDefinition
    /** Whether the task passed validation */
    readonly passed: boolean
    /** Validation score (0-100) */
    readonly score: number
    /** Validation message */
    readonly message: string
    /** Comprehensive metrics */
    readonly metrics: TaskMetrics
    /** Error if task failed to run */
    readonly error?: string
    /** Timestamp when run started */
    readonly startedAt: string
    /** Timestamp when run completed */
    readonly completedAt: string
}

/**
 * Summary of benchmark results for an agent
 */
export interface AgentSummary {
    /** Agent ID */
    readonly agentId: string
    /** Agent display name */
    readonly agentName: string
    /** Total tasks run */
    readonly totalTasks: number
    /** Tasks passed */
    readonly passedTasks: number
    /** Pass rate (0-100) */
    readonly passRate: number
    /** Average score */
    readonly averageScore: number
    /** Total cost */
    readonly totalCostUsd: number
    /** Total time */
    readonly totalDurationMs: number
    /** Average time per task */
    readonly avgDurationMs: number
    /** Results by category */
    readonly byCategory: Record<TaskCategory, CategorySummary>
    /** Results by difficulty */
    readonly byDifficulty: Record<TaskDifficulty, DifficultySummary>
}

export interface CategorySummary {
    readonly total: number
    readonly passed: number
    readonly passRate: number
    readonly avgScore: number
}

export interface DifficultySummary {
    readonly total: number
    readonly passed: number
    readonly passRate: number
    readonly avgScore: number
}

/**
 * Complete benchmark run results
 */
export interface BenchmarkResults {
    /** Benchmark run ID */
    readonly runId: string
    /** When the benchmark started */
    readonly startedAt: string
    /** When the benchmark completed */
    readonly completedAt: string
    /** Total duration */
    readonly durationMs: number
    /** Individual task results */
    readonly taskResults: TaskResult[]
    /** Summary by agent */
    readonly agentSummaries: AgentSummary[]
    /** Overall summary */
    readonly overallSummary: OverallSummary
    /** Benchmark configuration */
    readonly config: BenchmarkConfig
}

export interface OverallSummary {
    readonly totalTasks: number
    readonly totalPassed: number
    readonly overallPassRate: number
    readonly totalCostUsd: number
    readonly totalDurationMs: number
}

/**
 * Configuration for a benchmark run
 */
export interface BenchmarkConfig {
    /** Which agents to benchmark */
    readonly agents: string[]
    /** Which task categories to run */
    readonly categories?: TaskCategory[]
    /** Which difficulties to run */
    readonly difficulties?: TaskDifficulty[]
    /** Specific task IDs to run (if empty, run all matching) */
    readonly taskIds?: string[]
    /** Whether to run tasks in parallel */
    readonly parallel?: boolean
    /** Max concurrent tasks */
    readonly concurrency?: number
    /** Output directory for results */
    readonly outputDir?: string
    /** Whether to save detailed results */
    readonly saveResults?: boolean
}
