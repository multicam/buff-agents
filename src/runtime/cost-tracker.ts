/**
 * Cost Tracker
 * 
 * Tracks LLM usage costs and enforces spending limits.
 */

export interface CostTrackerConfig {
    readonly maxCostPerRun?: number
    readonly maxCostPerDay?: number
    readonly warningThreshold?: number // Percentage (0-1) at which to warn
}

export interface ModelPricing {
    readonly promptTokens: number  // Cost per 1K tokens
    readonly completionTokens: number  // Cost per 1K tokens
}

export interface UsageRecord {
    readonly timestamp: Date
    readonly model: string
    readonly promptTokens: number
    readonly completionTokens: number
    readonly cost: number
}

export class CostTracker {
    private runCost = 0
    private dailyCost = 0
    private dailyResetDate: string
    private usageHistory: UsageRecord[] = []
    private readonly config: CostTrackerConfig
    private readonly pricing: Map<string, ModelPricing>

    constructor(config: CostTrackerConfig = {}) {
        this.config = config
        this.dailyResetDate = this.getTodayString()
        this.pricing = new Map([
            // Anthropic
            ['anthropic/claude-sonnet-4-20250514', { promptTokens: 3, completionTokens: 15 }],
            ['anthropic/claude-opus-4-20250514', { promptTokens: 15, completionTokens: 75 }],
            ['anthropic/claude-haiku-3.5-20241022', { promptTokens: 0.8, completionTokens: 4 }],
            // OpenAI
            ['openai/gpt-4o', { promptTokens: 2.5, completionTokens: 10 }],
            ['openai/gpt-4o-mini', { promptTokens: 0.15, completionTokens: 0.6 }],
            ['openai/gpt-4-turbo', { promptTokens: 10, completionTokens: 30 }],
            // Google via OpenRouter
            ['openrouter/google/gemini-2.0-flash-001', { promptTokens: 0.1, completionTokens: 0.4 }],
            ['openrouter/google/gemini-pro', { promptTokens: 0.5, completionTokens: 1.5 }],
            // Default fallback
            ['default', { promptTokens: 3, completionTokens: 15 }],
        ])
    }

    private getTodayString(): string {
        return new Date().toISOString().split('T')[0]
    }

    private resetDailyIfNeeded(): void {
        const today = this.getTodayString()
        if (today !== this.dailyResetDate) {
            this.dailyCost = 0
            this.dailyResetDate = today
            // Clear old history (keep last 24 hours)
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
            this.usageHistory = this.usageHistory.filter(r => r.timestamp > cutoff)
        }
    }

    calculateCost(model: string, promptTokens: number, completionTokens: number): number {
        const pricing = this.pricing.get(model) ?? this.pricing.get('default')!
        return (promptTokens * pricing.promptTokens + completionTokens * pricing.completionTokens) / 1000
    }

    recordUsage(model: string, promptTokens: number, completionTokens: number): UsageRecord {
        this.resetDailyIfNeeded()

        const cost = this.calculateCost(model, promptTokens, completionTokens)
        const record: UsageRecord = {
            timestamp: new Date(),
            model,
            promptTokens,
            completionTokens,
            cost,
        }

        this.runCost += cost
        this.dailyCost += cost
        this.usageHistory.push(record)

        return record
    }

    checkLimits(): { allowed: boolean; reason?: string; warning?: string } {
        this.resetDailyIfNeeded()

        // Check run limit
        if (this.config.maxCostPerRun !== undefined && this.runCost >= this.config.maxCostPerRun) {
            return {
                allowed: false,
                reason: `Run cost limit exceeded: $${this.runCost.toFixed(4)} >= $${this.config.maxCostPerRun.toFixed(4)}`,
            }
        }

        // Check daily limit
        if (this.config.maxCostPerDay !== undefined && this.dailyCost >= this.config.maxCostPerDay) {
            return {
                allowed: false,
                reason: `Daily cost limit exceeded: $${this.dailyCost.toFixed(4)} >= $${this.config.maxCostPerDay.toFixed(4)}`,
            }
        }

        // Check warning threshold
        const warningThreshold = this.config.warningThreshold ?? 0.8
        let warning: string | undefined

        if (this.config.maxCostPerRun !== undefined) {
            const runPercent = this.runCost / this.config.maxCostPerRun
            if (runPercent >= warningThreshold) {
                warning = `Run cost at ${(runPercent * 100).toFixed(0)}% of limit`
            }
        }

        if (this.config.maxCostPerDay !== undefined) {
            const dailyPercent = this.dailyCost / this.config.maxCostPerDay
            if (dailyPercent >= warningThreshold) {
                warning = `Daily cost at ${(dailyPercent * 100).toFixed(0)}% of limit`
            }
        }

        return { allowed: true, warning }
    }

    getRunCost(): number {
        return this.runCost
    }

    getDailyCost(): number {
        this.resetDailyIfNeeded()
        return this.dailyCost
    }

    getUsageHistory(): readonly UsageRecord[] {
        return this.usageHistory
    }

    resetRunCost(): void {
        this.runCost = 0
    }

    getSummary(): {
        runCost: number
        dailyCost: number
        totalTokens: { prompt: number; completion: number }
        modelBreakdown: Record<string, { cost: number; calls: number }>
    } {
        this.resetDailyIfNeeded()

        const totalTokens = { prompt: 0, completion: 0 }
        const modelBreakdown: Record<string, { cost: number; calls: number }> = {}

        for (const record of this.usageHistory) {
            totalTokens.prompt += record.promptTokens
            totalTokens.completion += record.completionTokens

            if (!modelBreakdown[record.model]) {
                modelBreakdown[record.model] = { cost: 0, calls: 0 }
            }
            modelBreakdown[record.model].cost += record.cost
            modelBreakdown[record.model].calls += 1
        }

        return {
            runCost: this.runCost,
            dailyCost: this.dailyCost,
            totalTokens,
            modelBreakdown,
        }
    }

    setPricing(model: string, pricing: ModelPricing): void {
        this.pricing.set(model, pricing)
    }
}

export function createCostTracker(config?: CostTrackerConfig): CostTracker {
    return new CostTracker(config)
}
