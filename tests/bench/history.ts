/**
 * Benchmark History Storage
 * 
 * Saves and loads historical benchmark results for comparison.
 */

import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import type { BenchmarkResults } from './types'

const HISTORY_DIR = join(import.meta.dir, 'results', 'history')
const BASELINES_DIR = join(import.meta.dir, 'results', 'baselines')

export interface HistoryEntry {
    runId: string
    startedAt: string
    completedAt: string
    passRate: number
    totalTasks: number
    totalPassed: number
    totalCostUsd: number
    totalDurationMs: number
    agents: string[]
    filename: string
}

export interface BaselineInfo {
    name: string
    runId: string
    createdAt: string
    passRate: number
    totalTasks: number
    filename: string
}

export class BenchmarkHistory {
    private historyDir: string
    private baselinesDir: string

    constructor(options?: { historyDir?: string; baselinesDir?: string }) {
        this.historyDir = options?.historyDir ?? HISTORY_DIR
        this.baselinesDir = options?.baselinesDir ?? BASELINES_DIR
    }

    /**
     * Save benchmark results to history
     */
    async saveToHistory(results: BenchmarkResults): Promise<string> {
        await mkdir(this.historyDir, { recursive: true })

        const filename = `run-${results.runId}.json`
        const filepath = join(this.historyDir, filename)

        await writeFile(filepath, JSON.stringify(results, null, 2), 'utf-8')

        return filepath
    }

    /**
     * Load a specific run from history
     */
    async loadFromHistory(runId: string): Promise<BenchmarkResults | null> {
        try {
            const filepath = join(this.historyDir, `run-${runId}.json`)
            const content = await readFile(filepath, 'utf-8')
            return JSON.parse(content) as BenchmarkResults
        } catch {
            return null
        }
    }

    /**
     * Get list of all historical runs
     */
    async listHistory(limit?: number): Promise<HistoryEntry[]> {
        try {
            await mkdir(this.historyDir, { recursive: true })
            const files = await readdir(this.historyDir)
            const jsonFiles = files.filter(f => f.startsWith('run-') && f.endsWith('.json'))

            const entries: HistoryEntry[] = []

            for (const file of jsonFiles) {
                try {
                    const content = await readFile(join(this.historyDir, file), 'utf-8')
                    const results = JSON.parse(content) as BenchmarkResults
                    entries.push({
                        runId: results.runId,
                        startedAt: results.startedAt,
                        completedAt: results.completedAt,
                        passRate: results.overallSummary.overallPassRate,
                        totalTasks: results.overallSummary.totalTasks,
                        totalPassed: results.overallSummary.totalPassed,
                        totalCostUsd: results.overallSummary.totalCostUsd,
                        totalDurationMs: results.overallSummary.totalDurationMs,
                        agents: results.agentSummaries.map(a => a.agentId),
                        filename: file,
                    })
                } catch {
                    // Skip invalid files
                }
            }

            // Sort by date descending (newest first)
            entries.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

            return limit ? entries.slice(0, limit) : entries
        } catch {
            return []
        }
    }

    /**
     * Get the most recent run from history
     */
    async getLatestRun(): Promise<BenchmarkResults | null> {
        const entries = await this.listHistory(1)
        if (entries.length === 0) return null
        return this.loadFromHistory(entries[0].runId)
    }

    /**
     * Get the previous run (second most recent)
     */
    async getPreviousRun(): Promise<BenchmarkResults | null> {
        const entries = await this.listHistory(2)
        if (entries.length < 2) return null
        return this.loadFromHistory(entries[1].runId)
    }

    /**
     * Save results as a named baseline
     */
    async saveBaseline(results: BenchmarkResults, name: string): Promise<string> {
        await mkdir(this.baselinesDir, { recursive: true })

        const filename = `baseline-${name}.json`
        const filepath = join(this.baselinesDir, filename)

        const baselineData = {
            ...results,
            baselineName: name,
            baselineCreatedAt: new Date().toISOString(),
        }

        await writeFile(filepath, JSON.stringify(baselineData, null, 2), 'utf-8')

        return filepath
    }

    /**
     * Load a named baseline
     */
    async loadBaseline(name: string): Promise<BenchmarkResults | null> {
        try {
            const filepath = join(this.baselinesDir, `baseline-${name}.json`)
            const content = await readFile(filepath, 'utf-8')
            return JSON.parse(content) as BenchmarkResults
        } catch {
            return null
        }
    }

    /**
     * List all saved baselines
     */
    async listBaselines(): Promise<BaselineInfo[]> {
        try {
            await mkdir(this.baselinesDir, { recursive: true })
            const files = await readdir(this.baselinesDir)
            const baselineFiles = files.filter(f => f.startsWith('baseline-') && f.endsWith('.json'))

            const baselines: BaselineInfo[] = []

            for (const file of baselineFiles) {
                try {
                    const content = await readFile(join(this.baselinesDir, file), 'utf-8')
                    const data = JSON.parse(content) as BenchmarkResults & { baselineName?: string; baselineCreatedAt?: string }
                    const name = basename(file, '.json').replace('baseline-', '')
                    baselines.push({
                        name,
                        runId: data.runId,
                        createdAt: data.baselineCreatedAt ?? data.completedAt,
                        passRate: data.overallSummary.overallPassRate,
                        totalTasks: data.overallSummary.totalTasks,
                        filename: file,
                    })
                } catch {
                    // Skip invalid files
                }
            }

            // Sort by date descending
            baselines.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

            return baselines
        } catch {
            return []
        }
    }

    /**
     * Delete a baseline
     */
    async deleteBaseline(name: string): Promise<boolean> {
        try {
            const filepath = join(this.baselinesDir, `baseline-${name}.json`)
            await rm(filepath)
            return true
        } catch {
            return false
        }
    }

    /**
     * Clear all history (keeps baselines)
     */
    async clearHistory(): Promise<void> {
        try {
            const files = await readdir(this.historyDir)
            for (const file of files) {
                if (file.startsWith('run-') && file.endsWith('.json')) {
                    await rm(join(this.historyDir, file))
                }
            }
        } catch {
            // Directory might not exist
        }
    }
}

export function createBenchmarkHistory(options?: { historyDir?: string; baselinesDir?: string }): BenchmarkHistory {
    return new BenchmarkHistory(options)
}
