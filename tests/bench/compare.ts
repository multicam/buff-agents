/**
 * Benchmark Comparison
 * 
 * Compares benchmark results to identify improvements and regressions.
 */

import type { BenchmarkResults, AgentSummary, TaskResult, TaskCategory, TaskDifficulty } from './types'

/**
 * Direction of change
 */
export type ChangeDirection = 'improved' | 'regressed' | 'unchanged'

/**
 * Significance level of change
 */
export type Significance = 'none' | 'minor' | 'moderate' | 'major'

/**
 * Delta with direction indicator
 */
export interface MetricDelta {
    previous: number
    current: number
    delta: number
    percentChange: number
    direction: ChangeDirection
    significance: Significance
}

/**
 * Comparison of a single task across runs
 */
export interface TaskComparison {
    taskId: string
    taskName: string
    agentId: string
    previousPassed: boolean
    currentPassed: boolean
    previousScore: number
    currentScore: number
    scoreDelta: number
    previousDurationMs: number
    currentDurationMs: number
    durationDelta: number
    previousCostUsd: number
    currentCostUsd: number
    costDelta: number
    status: 'new_pass' | 'new_fail' | 'still_pass' | 'still_fail' | 'new_task'
}

/**
 * Comparison of agent performance across runs
 */
export interface AgentComparison {
    agentId: string
    agentName: string
    passRate: MetricDelta
    avgScore: MetricDelta
    totalCost: MetricDelta
    avgDuration: MetricDelta
    taskCount: MetricDelta
}

/**
 * Overall comparison summary
 */
export interface ComparisonSummary {
    previousRunId: string
    currentRunId: string
    previousDate: string
    currentDate: string
    overallPassRate: MetricDelta
    totalCost: MetricDelta
    totalDuration: MetricDelta
    totalTasks: MetricDelta
    tasksImproved: number
    tasksRegressed: number
    tasksUnchanged: number
    newTasks: number
    removedTasks: number
}

/**
 * Complete comparison result
 */
export interface ComparisonResult {
    summary: ComparisonSummary
    agentComparisons: AgentComparison[]
    taskComparisons: TaskComparison[]
    improvements: TaskComparison[]
    regressions: TaskComparison[]
    categoryChanges: Record<TaskCategory, MetricDelta>
    difficultyChanges: Record<TaskDifficulty, MetricDelta>
}

/**
 * Configuration thresholds for significance
 */
export interface ComparisonThresholds {
    minorChangePercent: number
    moderateChangePercent: number
    majorChangePercent: number
}

const DEFAULT_THRESHOLDS: ComparisonThresholds = {
    minorChangePercent: 5,
    moderateChangePercent: 15,
    majorChangePercent: 30,
}

/**
 * Compare two benchmark results
 */
export function compareBenchmarkResults(
    previous: BenchmarkResults,
    current: BenchmarkResults,
    thresholds: ComparisonThresholds = DEFAULT_THRESHOLDS
): ComparisonResult {
    const taskComparisons = compareTaskResults(previous.taskResults, current.taskResults)
    const agentComparisons = compareAgentSummaries(previous.agentSummaries, current.agentSummaries, thresholds)
    
    const improvements = taskComparisons.filter(t => t.status === 'new_pass')
    const regressions = taskComparisons.filter(t => t.status === 'new_fail')

    const summary = createComparisonSummary(previous, current, taskComparisons, thresholds)
    const categoryChanges = compareCategoryResults(previous, current, thresholds)
    const difficultyChanges = compareDifficultyResults(previous, current, thresholds)

    return {
        summary,
        agentComparisons,
        taskComparisons,
        improvements,
        regressions,
        categoryChanges,
        difficultyChanges,
    }
}

function compareTaskResults(
    previous: TaskResult[],
    current: TaskResult[]
): TaskComparison[] {
    const comparisons: TaskComparison[] = []
    const previousMap = new Map(previous.map(t => [`${t.task.id}:${t.agent.id}`, t]))
    const currentMap = new Map(current.map(t => [`${t.task.id}:${t.agent.id}`, t]))

    // Compare tasks present in both runs
    for (const [key, currentTask] of currentMap) {
        const previousTask = previousMap.get(key)

        if (previousTask) {
            let status: TaskComparison['status']
            if (previousTask.passed && currentTask.passed) status = 'still_pass'
            else if (!previousTask.passed && !currentTask.passed) status = 'still_fail'
            else if (!previousTask.passed && currentTask.passed) status = 'new_pass'
            else status = 'new_fail'

            comparisons.push({
                taskId: currentTask.task.id,
                taskName: currentTask.task.name,
                agentId: currentTask.agent.id,
                previousPassed: previousTask.passed,
                currentPassed: currentTask.passed,
                previousScore: previousTask.score,
                currentScore: currentTask.score,
                scoreDelta: currentTask.score - previousTask.score,
                previousDurationMs: previousTask.metrics.durationMs,
                currentDurationMs: currentTask.metrics.durationMs,
                durationDelta: currentTask.metrics.durationMs - previousTask.metrics.durationMs,
                previousCostUsd: previousTask.metrics.costUsd,
                currentCostUsd: currentTask.metrics.costUsd,
                costDelta: currentTask.metrics.costUsd - previousTask.metrics.costUsd,
                status,
            })
        } else {
            // New task in current run
            comparisons.push({
                taskId: currentTask.task.id,
                taskName: currentTask.task.name,
                agentId: currentTask.agent.id,
                previousPassed: false,
                currentPassed: currentTask.passed,
                previousScore: 0,
                currentScore: currentTask.score,
                scoreDelta: currentTask.score,
                previousDurationMs: 0,
                currentDurationMs: currentTask.metrics.durationMs,
                durationDelta: currentTask.metrics.durationMs,
                previousCostUsd: 0,
                currentCostUsd: currentTask.metrics.costUsd,
                costDelta: currentTask.metrics.costUsd,
                status: 'new_task',
            })
        }
    }

    return comparisons
}

function compareAgentSummaries(
    previous: AgentSummary[],
    current: AgentSummary[],
    thresholds: ComparisonThresholds
): AgentComparison[] {
    const comparisons: AgentComparison[] = []
    const previousMap = new Map(previous.map(a => [a.agentId, a]))

    for (const currentAgent of current) {
        const previousAgent = previousMap.get(currentAgent.agentId)

        if (previousAgent) {
            comparisons.push({
                agentId: currentAgent.agentId,
                agentName: currentAgent.agentName,
                passRate: createMetricDelta(previousAgent.passRate, currentAgent.passRate, thresholds, true),
                avgScore: createMetricDelta(previousAgent.averageScore, currentAgent.averageScore, thresholds, true),
                totalCost: createMetricDelta(previousAgent.totalCostUsd, currentAgent.totalCostUsd, thresholds, false),
                avgDuration: createMetricDelta(previousAgent.avgDurationMs, currentAgent.avgDurationMs, thresholds, false),
                taskCount: createMetricDelta(previousAgent.totalTasks, currentAgent.totalTasks, thresholds, true),
            })
        } else {
            // New agent
            comparisons.push({
                agentId: currentAgent.agentId,
                agentName: currentAgent.agentName,
                passRate: createMetricDelta(0, currentAgent.passRate, thresholds, true),
                avgScore: createMetricDelta(0, currentAgent.averageScore, thresholds, true),
                totalCost: createMetricDelta(0, currentAgent.totalCostUsd, thresholds, false),
                avgDuration: createMetricDelta(0, currentAgent.avgDurationMs, thresholds, false),
                taskCount: createMetricDelta(0, currentAgent.totalTasks, thresholds, true),
            })
        }
    }

    return comparisons
}

function createMetricDelta(
    previous: number,
    current: number,
    thresholds: ComparisonThresholds,
    higherIsBetter: boolean
): MetricDelta {
    const delta = current - previous
    const percentChange = previous !== 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0)
    
    let direction: ChangeDirection = 'unchanged'
    if (Math.abs(percentChange) >= thresholds.minorChangePercent) {
        if (higherIsBetter) {
            direction = delta > 0 ? 'improved' : 'regressed'
        } else {
            direction = delta < 0 ? 'improved' : 'regressed'
        }
    }

    const absPercent = Math.abs(percentChange)
    let significance: Significance = 'none'
    if (absPercent >= thresholds.majorChangePercent) significance = 'major'
    else if (absPercent >= thresholds.moderateChangePercent) significance = 'moderate'
    else if (absPercent >= thresholds.minorChangePercent) significance = 'minor'

    return {
        previous,
        current,
        delta,
        percentChange,
        direction,
        significance,
    }
}

function createComparisonSummary(
    previous: BenchmarkResults,
    current: BenchmarkResults,
    taskComparisons: TaskComparison[],
    thresholds: ComparisonThresholds
): ComparisonSummary {
    const prevSummary = previous.overallSummary
    const currSummary = current.overallSummary

    const previousTaskKeys = new Set(previous.taskResults.map(t => `${t.task.id}:${t.agent.id}`))
    const currentTaskKeys = new Set(current.taskResults.map(t => `${t.task.id}:${t.agent.id}`))

    let removedTasks = 0
    for (const key of previousTaskKeys) {
        if (!currentTaskKeys.has(key)) removedTasks++
    }

    return {
        previousRunId: previous.runId,
        currentRunId: current.runId,
        previousDate: previous.startedAt,
        currentDate: current.startedAt,
        overallPassRate: createMetricDelta(prevSummary.overallPassRate, currSummary.overallPassRate, thresholds, true),
        totalCost: createMetricDelta(prevSummary.totalCostUsd, currSummary.totalCostUsd, thresholds, false),
        totalDuration: createMetricDelta(prevSummary.totalDurationMs, currSummary.totalDurationMs, thresholds, false),
        totalTasks: createMetricDelta(prevSummary.totalTasks, currSummary.totalTasks, thresholds, true),
        tasksImproved: taskComparisons.filter(t => t.status === 'new_pass').length,
        tasksRegressed: taskComparisons.filter(t => t.status === 'new_fail').length,
        tasksUnchanged: taskComparisons.filter(t => t.status === 'still_pass' || t.status === 'still_fail').length,
        newTasks: taskComparisons.filter(t => t.status === 'new_task').length,
        removedTasks,
    }
}

function compareCategoryResults(
    previous: BenchmarkResults,
    current: BenchmarkResults,
    thresholds: ComparisonThresholds
): Record<TaskCategory, MetricDelta> {
    const categories: TaskCategory[] = ['file-editing', 'code-search', 'multi-step', 'bug-fixing', 'code-generation']
    const result: Record<string, MetricDelta> = {}

    for (const cat of categories) {
        const prevTasks = previous.taskResults.filter(t => t.task.category === cat)
        const currTasks = current.taskResults.filter(t => t.task.category === cat)

        const prevPassRate = prevTasks.length > 0 
            ? (prevTasks.filter(t => t.passed).length / prevTasks.length) * 100 
            : 0
        const currPassRate = currTasks.length > 0 
            ? (currTasks.filter(t => t.passed).length / currTasks.length) * 100 
            : 0

        result[cat] = createMetricDelta(prevPassRate, currPassRate, thresholds, true)
    }

    return result as Record<TaskCategory, MetricDelta>
}

function compareDifficultyResults(
    previous: BenchmarkResults,
    current: BenchmarkResults,
    thresholds: ComparisonThresholds
): Record<TaskDifficulty, MetricDelta> {
    const difficulties: TaskDifficulty[] = ['easy', 'medium', 'hard']
    const result: Record<string, MetricDelta> = {}

    for (const diff of difficulties) {
        const prevTasks = previous.taskResults.filter(t => t.task.difficulty === diff)
        const currTasks = current.taskResults.filter(t => t.task.difficulty === diff)

        const prevPassRate = prevTasks.length > 0 
            ? (prevTasks.filter(t => t.passed).length / prevTasks.length) * 100 
            : 0
        const currPassRate = currTasks.length > 0 
            ? (currTasks.filter(t => t.passed).length / currTasks.length) * 100 
            : 0

        result[diff] = createMetricDelta(prevPassRate, currPassRate, thresholds, true)
    }

    return result as Record<TaskDifficulty, MetricDelta>
}

/**
 * Format a metric delta for display
 */
export function formatDelta(delta: MetricDelta, suffix: string = ''): string {
    const sign = delta.delta >= 0 ? '+' : ''
    const arrow = delta.direction === 'improved' ? '↑' : delta.direction === 'regressed' ? '↓' : '→'
    return `${delta.current.toFixed(1)}${suffix} (${sign}${delta.delta.toFixed(1)}${suffix} ${arrow})`
}

/**
 * Format delta with color indicators for terminal
 */
export function formatDeltaWithColor(delta: MetricDelta, suffix: string = ''): string {
    const sign = delta.delta >= 0 ? '+' : ''
    let icon: string
    
    if (delta.direction === 'improved') {
        icon = '✅'
    } else if (delta.direction === 'regressed') {
        icon = '❌'
    } else {
        icon = '➖'
    }

    return `${delta.current.toFixed(1)}${suffix} (${sign}${delta.delta.toFixed(1)}${suffix}) ${icon}`
}
