/**
 * Benchmark Reporter
 * 
 * Formats and outputs benchmark results.
 */

import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import type { BenchmarkResults, TaskResult, AgentSummary } from './types'
import type { ComparisonResult, MetricDelta } from './compare'
import { formatDeltaWithColor } from './compare'

export class BenchmarkReporter {
    private results: BenchmarkResults
    private comparison?: ComparisonResult

    constructor(results: BenchmarkResults, comparison?: ComparisonResult) {
        this.results = results
        this.comparison = comparison
    }

    /**
     * Set comparison data
     */
    setComparison(comparison: ComparisonResult): void {
        this.comparison = comparison
    }

    /**
     * Print summary to console
     */
    printSummary(): void {
        const { overallSummary, agentSummaries, durationMs } = this.results

        console.log('\n')
        console.log('═'.repeat(60))
        console.log('  BENCHMARK RESULTS')
        console.log('═'.repeat(60))
        console.log(`\n  Run ID: ${this.results.runId}`)
        console.log(`  Duration: ${this.formatDuration(durationMs)}`)
        console.log(`  Started: ${this.results.startedAt}`)
        console.log(`  Completed: ${this.results.completedAt}`)

        // Overall Summary
        console.log('\n' + '─'.repeat(60))
        console.log('  OVERALL SUMMARY')
        console.log('─'.repeat(60))
        console.log(`  Total Tasks:     ${overallSummary.totalTasks}`)
        console.log(`  Passed:          ${overallSummary.totalPassed} (${overallSummary.overallPassRate.toFixed(1)}%)`)
        console.log(`  Failed:          ${overallSummary.totalTasks - overallSummary.totalPassed}`)
        console.log(`  Total Cost:      $${overallSummary.totalCostUsd.toFixed(4)}`)
        console.log(`  Total Time:      ${this.formatDuration(overallSummary.totalDurationMs)}`)

        // Per-Agent Summary
        if (agentSummaries.length > 0) {
            console.log('\n' + '─'.repeat(60))
            console.log('  PER-AGENT RESULTS')
            console.log('─'.repeat(60))

            for (const agent of agentSummaries) {
                this.printAgentSummary(agent)
            }
        }

        // Comparison Summary (if available)
        if (this.comparison) {
            this.printComparisonSummary()
        }

        // Failed Tasks
        const failedTasks = this.results.taskResults.filter(r => !r.passed)
        if (failedTasks.length > 0) {
            console.log('\n' + '─'.repeat(60))
            console.log('  FAILED TASKS')
            console.log('─'.repeat(60))
            for (const result of failedTasks) {
                console.log(`\n  ❌ ${result.task.name} (${result.agent.id})`)
                console.log(`     ${result.message}`)
                if (result.error) {
                    console.log(`     Error: ${result.error}`)
                }
            }
        }

        console.log('\n' + '═'.repeat(60))
        console.log('')
    }

    /**
     * Print comparison summary
     */
    private printComparisonSummary(): void {
        if (!this.comparison) return

        const { summary, improvements, regressions, agentComparisons } = this.comparison

        console.log('\n' + '─'.repeat(60))
        console.log('  COMPARISON WITH PREVIOUS RUN')
        console.log('─'.repeat(60))
        console.log(`  Previous: ${summary.previousRunId.slice(0, 8)}... (${this.formatDate(summary.previousDate)})`)
        console.log(`  Current:  ${summary.currentRunId.slice(0, 8)}... (${this.formatDate(summary.currentDate)})`)
        console.log('')
        console.log(`  Pass Rate: ${formatDeltaWithColor(summary.overallPassRate, '%')}`)
        console.log(`  Total Cost: ${this.formatCostDelta(summary.totalCost)}`)
        console.log(`  Duration: ${this.formatDurationDelta(summary.totalDuration)}`)
        console.log('')
        console.log(`  Tasks Improved:  ${improvements.length} ✅`)
        console.log(`  Tasks Regressed: ${regressions.length} ❌`)
        console.log(`  Tasks Unchanged: ${summary.tasksUnchanged}`)
        if (summary.newTasks > 0) {
            console.log(`  New Tasks:       ${summary.newTasks}`)
        }
        if (summary.removedTasks > 0) {
            console.log(`  Removed Tasks:   ${summary.removedTasks}`)
        }

        // Show improvements
        if (improvements.length > 0) {
            console.log('\n  Improvements:')
            for (const task of improvements.slice(0, 5)) {
                console.log(`    ✅ ${task.taskName} (${task.agentId}): score ${task.previousScore}→${task.currentScore}`)
            }
            if (improvements.length > 5) {
                console.log(`    ... and ${improvements.length - 5} more`)
            }
        }

        // Show regressions
        if (regressions.length > 0) {
            console.log('\n  Regressions:')
            for (const task of regressions.slice(0, 5)) {
                console.log(`    ❌ ${task.taskName} (${task.agentId}): score ${task.previousScore}→${task.currentScore}`)
            }
            if (regressions.length > 5) {
                console.log(`    ... and ${regressions.length - 5} more`)
            }
        }

        // Per-agent comparison
        if (agentComparisons.length > 0) {
            console.log('\n  Per-Agent Changes:')
            for (const agent of agentComparisons) {
                const passRateChange = this.formatMetricChange(agent.passRate)
                console.log(`    ${agent.agentName}: ${passRateChange}`)
            }
        }
    }

    private formatDate(isoDate: string): string {
        return new Date(isoDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    private formatCostDelta(delta: MetricDelta): string {
        const sign = delta.delta >= 0 ? '+' : ''
        const icon = delta.direction === 'improved' ? '✅' : delta.direction === 'regressed' ? '❌' : '➖'
        return `$${delta.current.toFixed(4)} (${sign}$${delta.delta.toFixed(4)}) ${icon}`
    }

    private formatDurationDelta(delta: MetricDelta): string {
        const sign = delta.delta >= 0 ? '+' : ''
        const icon = delta.direction === 'improved' ? '✅' : delta.direction === 'regressed' ? '❌' : '➖'
        return `${this.formatDuration(delta.current)} (${sign}${this.formatDuration(Math.abs(delta.delta))}) ${icon}`
    }

    private formatMetricChange(delta: MetricDelta): string {
        if (delta.direction === 'unchanged') {
            return `${delta.current.toFixed(1)}% (unchanged)`
        }
        const sign = delta.delta >= 0 ? '+' : ''
        const icon = delta.direction === 'improved' ? '↑' : '↓'
        return `${delta.current.toFixed(1)}% (${sign}${delta.delta.toFixed(1)}% ${icon})`
    }

    private printAgentSummary(agent: AgentSummary): void {
        console.log(`\n  🤖 ${agent.agentName} (${agent.agentId})`)
        console.log(`     Pass Rate:    ${agent.passRate.toFixed(1)}% (${agent.passedTasks}/${agent.totalTasks})`)
        console.log(`     Avg Score:    ${agent.averageScore.toFixed(1)}/100`)
        console.log(`     Total Cost:   $${agent.totalCostUsd.toFixed(4)}`)
        console.log(`     Avg Time:     ${this.formatDuration(agent.avgDurationMs)}`)

        // By category
        const catResults = Object.entries(agent.byCategory)
            .filter(([_, v]) => v.total > 0)
        if (catResults.length > 0) {
            console.log('     By Category:')
            for (const [cat, stats] of catResults) {
                console.log(`       ${cat}: ${stats.passRate.toFixed(0)}% (${stats.passed}/${stats.total})`)
            }
        }

        // By difficulty
        const diffResults = Object.entries(agent.byDifficulty)
            .filter(([_, v]) => v.total > 0)
        if (diffResults.length > 0) {
            console.log('     By Difficulty:')
            for (const [diff, stats] of diffResults) {
                console.log(`       ${diff}: ${stats.passRate.toFixed(0)}% (${stats.passed}/${stats.total})`)
            }
        }
    }

    /**
     * Generate markdown report
     */
    toMarkdown(): string {
        const { overallSummary, agentSummaries } = this.results
        const lines: string[] = []

        lines.push('# Benchmark Results')
        lines.push('')
        lines.push(`**Run ID:** ${this.results.runId}`)
        lines.push(`**Date:** ${this.results.startedAt}`)
        lines.push(`**Duration:** ${this.formatDuration(this.results.durationMs)}`)
        lines.push('')

        // Overall Summary
        lines.push('## Overall Summary')
        lines.push('')
        lines.push('| Metric | Value |')
        lines.push('|--------|-------|')
        lines.push(`| Total Tasks | ${overallSummary.totalTasks} |`)
        lines.push(`| Passed | ${overallSummary.totalPassed} |`)
        lines.push(`| Pass Rate | ${overallSummary.overallPassRate.toFixed(1)}% |`)
        lines.push(`| Total Cost | $${overallSummary.totalCostUsd.toFixed(4)} |`)
        lines.push(`| Total Time | ${this.formatDuration(overallSummary.totalDurationMs)} |`)
        lines.push('')

        // Agent Results
        if (agentSummaries.length > 0) {
            lines.push('## Agent Results')
            lines.push('')
            lines.push('| Agent | Pass Rate | Avg Score | Cost | Avg Time |')
            lines.push('|-------|-----------|-----------|------|----------|')
            for (const agent of agentSummaries) {
                lines.push(
                    `| ${agent.agentName} | ${agent.passRate.toFixed(1)}% | ${agent.averageScore.toFixed(1)} | $${agent.totalCostUsd.toFixed(4)} | ${this.formatDuration(agent.avgDurationMs)} |`
                )
            }
            lines.push('')
        }

        // Task Details
        lines.push('## Task Details')
        lines.push('')
        lines.push('| Task | Agent | Status | Score | Time | Cost |')
        lines.push('|------|-------|--------|-------|------|------|')
        for (const result of this.results.taskResults) {
            const status = result.passed ? '✅' : '❌'
            lines.push(
                `| ${result.task.name} | ${result.agent.id} | ${status} | ${result.score} | ${this.formatDuration(result.metrics.durationMs)} | $${result.metrics.costUsd.toFixed(4)} |`
            )
        }
        lines.push('')

        // Failed Task Details
        const failedTasks = this.results.taskResults.filter(r => !r.passed)
        if (failedTasks.length > 0) {
            lines.push('## Failed Tasks')
            lines.push('')
            for (const result of failedTasks) {
                lines.push(`### ${result.task.name} (${result.agent.id})`)
                lines.push('')
                lines.push(`**Message:** ${result.message}`)
                if (result.error) {
                    lines.push(`**Error:** ${result.error}`)
                }
                lines.push('')
            }
        }

        // Comparison section
        if (this.comparison) {
            lines.push(this.comparisonToMarkdown())
        }

        return lines.join('\n')
    }

    /**
     * Generate markdown for comparison
     */
    private comparisonToMarkdown(): string {
        if (!this.comparison) return ''

        const { summary, improvements, regressions, agentComparisons, categoryChanges, difficultyChanges } = this.comparison
        const lines: string[] = []

        lines.push('## Comparison with Previous Run')
        lines.push('')
        lines.push(`**Previous Run:** ${summary.previousRunId} (${summary.previousDate})`)
        lines.push(`**Current Run:** ${summary.currentRunId} (${summary.currentDate})`)
        lines.push('')

        // Summary table
        lines.push('### Summary')
        lines.push('')
        lines.push('| Metric | Previous | Current | Change |')
        lines.push('|--------|----------|---------|--------|')
        lines.push(`| Pass Rate | ${summary.overallPassRate.previous.toFixed(1)}% | ${summary.overallPassRate.current.toFixed(1)}% | ${this.formatMarkdownDelta(summary.overallPassRate, '%')} |`)
        lines.push(`| Total Cost | $${summary.totalCost.previous.toFixed(4)} | $${summary.totalCost.current.toFixed(4)} | ${this.formatMarkdownDelta(summary.totalCost, '', true)} |`)
        lines.push(`| Duration | ${this.formatDuration(summary.totalDuration.previous)} | ${this.formatDuration(summary.totalDuration.current)} | ${this.formatDurationChange(summary.totalDuration)} |`)
        lines.push('')

        lines.push('### Task Changes')
        lines.push('')
        lines.push(`- **Improved:** ${improvements.length}`)
        lines.push(`- **Regressed:** ${regressions.length}`)
        lines.push(`- **Unchanged:** ${summary.tasksUnchanged}`)
        lines.push(`- **New:** ${summary.newTasks}`)
        lines.push(`- **Removed:** ${summary.removedTasks}`)
        lines.push('')

        // Improvements
        if (improvements.length > 0) {
            lines.push('### Improvements ✅')
            lines.push('')
            lines.push('| Task | Agent | Previous Score | Current Score |')
            lines.push('|------|-------|----------------|---------------|')
            for (const task of improvements) {
                lines.push(`| ${task.taskName} | ${task.agentId} | ${task.previousScore} | ${task.currentScore} |`)
            }
            lines.push('')
        }

        // Regressions
        if (regressions.length > 0) {
            lines.push('### Regressions ❌')
            lines.push('')
            lines.push('| Task | Agent | Previous Score | Current Score |')
            lines.push('|------|-------|----------------|---------------|')
            for (const task of regressions) {
                lines.push(`| ${task.taskName} | ${task.agentId} | ${task.previousScore} | ${task.currentScore} |`)
            }
            lines.push('')
        }

        // Agent comparison
        if (agentComparisons.length > 0) {
            lines.push('### Agent Comparison')
            lines.push('')
            lines.push('| Agent | Pass Rate Change | Score Change | Cost Change |')
            lines.push('|-------|------------------|--------------|-------------|')
            for (const agent of agentComparisons) {
                lines.push(`| ${agent.agentName} | ${this.formatMarkdownDelta(agent.passRate, '%')} | ${this.formatMarkdownDelta(agent.avgScore)} | ${this.formatMarkdownDelta(agent.totalCost, '', true)} |`)
            }
            lines.push('')
        }

        // Category changes
        lines.push('### Changes by Category')
        lines.push('')
        lines.push('| Category | Previous | Current | Change |')
        lines.push('|----------|----------|---------|--------|')
        for (const [cat, delta] of Object.entries(categoryChanges)) {
            lines.push(`| ${cat} | ${delta.previous.toFixed(1)}% | ${delta.current.toFixed(1)}% | ${this.formatMarkdownDelta(delta, '%')} |`)
        }
        lines.push('')

        // Difficulty changes
        lines.push('### Changes by Difficulty')
        lines.push('')
        lines.push('| Difficulty | Previous | Current | Change |')
        lines.push('|------------|----------|---------|--------|')
        for (const [diff, delta] of Object.entries(difficultyChanges)) {
            lines.push(`| ${diff} | ${delta.previous.toFixed(1)}% | ${delta.current.toFixed(1)}% | ${this.formatMarkdownDelta(delta, '%')} |`)
        }
        lines.push('')

        return lines.join('\n')
    }

    private formatMarkdownDelta(delta: MetricDelta, suffix: string = '', lowerIsBetter: boolean = false): string {
        const sign = delta.delta >= 0 ? '+' : ''
        let emoji: string
        if (delta.direction === 'unchanged') {
            emoji = '➖'
        } else if (delta.direction === 'improved') {
            emoji = '✅'
        } else {
            emoji = '❌'
        }
        return `${sign}${delta.delta.toFixed(2)}${suffix} ${emoji}`
    }

    private formatDurationChange(delta: MetricDelta): string {
        const sign = delta.delta >= 0 ? '+' : '-'
        const emoji = delta.direction === 'improved' ? '✅' : delta.direction === 'regressed' ? '❌' : '➖'
        return `${sign}${this.formatDuration(Math.abs(delta.delta))} ${emoji}`
    }

    /**
     * Generate JSON report
     */
    toJSON(): string {
        return JSON.stringify(this.results, null, 2)
    }

    /**
     * Save results to files
     */
    async saveResults(outputDir: string): Promise<void> {
        await mkdir(outputDir, { recursive: true })

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const baseFilename = `benchmark-${timestamp}`

        // Save JSON
        await writeFile(
            join(outputDir, `${baseFilename}.json`),
            this.toJSON(),
            'utf-8'
        )

        // Save Markdown
        await writeFile(
            join(outputDir, `${baseFilename}.md`),
            this.toMarkdown(),
            'utf-8'
        )

        // Save latest results
        await writeFile(
            join(outputDir, 'latest.json'),
            this.toJSON(),
            'utf-8'
        )
        await writeFile(
            join(outputDir, 'latest.md'),
            this.toMarkdown(),
            'utf-8'
        )

        console.log(`\n📁 Results saved to: ${outputDir}`)
        console.log(`   - ${baseFilename}.json`)
        console.log(`   - ${baseFilename}.md`)
    }

    private formatDuration(ms: number): string {
        if (ms < 1000) return `${ms}ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
        const mins = Math.floor(ms / 60000)
        const secs = ((ms % 60000) / 1000).toFixed(0)
        return `${mins}m ${secs}s`
    }
}

export function createReporter(results: BenchmarkResults, comparison?: ComparisonResult): BenchmarkReporter {
    return new BenchmarkReporter(results, comparison)
}
