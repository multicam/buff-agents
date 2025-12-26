/**
 * Rate Limiter
 * 
 * Token bucket rate limiting for LLM API calls.
 */

export interface RateLimitConfig {
    readonly requestsPerMinute?: number
    readonly requestsPerHour?: number
    readonly tokensPerMinute?: number
    readonly tokensPerHour?: number
    readonly concurrentRequests?: number
}

export interface RateLimitStatus {
    readonly allowed: boolean
    readonly waitMs?: number
    readonly reason?: string
}

interface TokenBucket {
    tokens: number
    lastRefill: number
    readonly capacity: number
    readonly refillRate: number  // tokens per ms
}

export class RateLimiter {
    private readonly config: RateLimitConfig
    private readonly buckets: Map<string, TokenBucket> = new Map()
    private activeRequests = 0
    private readonly waitQueue: Array<() => void> = []

    constructor(config: RateLimitConfig) {
        this.config = config
        this.initBuckets()
    }

    private initBuckets(): void {
        if (this.config.requestsPerMinute) {
            this.buckets.set('rpm', {
                tokens: this.config.requestsPerMinute,
                lastRefill: Date.now(),
                capacity: this.config.requestsPerMinute,
                refillRate: this.config.requestsPerMinute / 60000,
            })
        }

        if (this.config.requestsPerHour) {
            this.buckets.set('rph', {
                tokens: this.config.requestsPerHour,
                lastRefill: Date.now(),
                capacity: this.config.requestsPerHour,
                refillRate: this.config.requestsPerHour / 3600000,
            })
        }

        if (this.config.tokensPerMinute) {
            this.buckets.set('tpm', {
                tokens: this.config.tokensPerMinute,
                lastRefill: Date.now(),
                capacity: this.config.tokensPerMinute,
                refillRate: this.config.tokensPerMinute / 60000,
            })
        }

        if (this.config.tokensPerHour) {
            this.buckets.set('tph', {
                tokens: this.config.tokensPerHour,
                lastRefill: Date.now(),
                capacity: this.config.tokensPerHour,
                refillRate: this.config.tokensPerHour / 3600000,
            })
        }
    }

    private refillBucket(bucket: TokenBucket): void {
        const now = Date.now()
        const elapsed = now - bucket.lastRefill
        const refill = elapsed * bucket.refillRate

        bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refill)
        bucket.lastRefill = now
    }

    private tryConsume(bucketName: string, amount: number): RateLimitStatus {
        const bucket = this.buckets.get(bucketName)
        if (!bucket) return { allowed: true }

        this.refillBucket(bucket)

        if (bucket.tokens >= amount) {
            bucket.tokens -= amount
            return { allowed: true }
        }

        // Calculate wait time
        const needed = amount - bucket.tokens
        const waitMs = Math.ceil(needed / bucket.refillRate)

        return {
            allowed: false,
            waitMs,
            reason: `Rate limit exceeded for ${bucketName}`,
        }
    }

    checkRequest(): RateLimitStatus {
        // Check concurrent requests
        if (this.config.concurrentRequests !== undefined) {
            if (this.activeRequests >= this.config.concurrentRequests) {
                return {
                    allowed: false,
                    reason: `Max concurrent requests (${this.config.concurrentRequests}) reached`,
                }
            }
        }

        // Check request rate limits
        for (const bucketName of ['rpm', 'rph']) {
            const status = this.tryConsume(bucketName, 1)
            if (!status.allowed) {
                // Restore the token since we're not proceeding
                const bucket = this.buckets.get(bucketName)
                if (bucket) bucket.tokens += 1
                return status
            }
        }

        return { allowed: true }
    }

    checkTokens(tokenCount: number): RateLimitStatus {
        for (const bucketName of ['tpm', 'tph']) {
            const status = this.tryConsume(bucketName, tokenCount)
            if (!status.allowed) {
                // Restore tokens since we're not proceeding
                const bucket = this.buckets.get(bucketName)
                if (bucket) bucket.tokens += tokenCount
                return status
            }
        }

        return { allowed: true }
    }

    async acquire(): Promise<void> {
        const status = this.checkRequest()

        if (!status.allowed) {
            if (status.waitMs) {
                await this.wait(status.waitMs)
                return this.acquire()
            }

            // Wait for a slot to open up (concurrent limit)
            await new Promise<void>(resolve => {
                this.waitQueue.push(resolve)
            })
            return this.acquire()
        }

        this.activeRequests++
    }

    release(): void {
        this.activeRequests = Math.max(0, this.activeRequests - 1)

        // Wake up next waiter
        const next = this.waitQueue.shift()
        if (next) next()
    }

    recordTokenUsage(promptTokens: number, completionTokens: number): void {
        const total = promptTokens + completionTokens

        // Consume from token buckets (already checked, just recording)
        for (const bucketName of ['tpm', 'tph']) {
            const bucket = this.buckets.get(bucketName)
            if (bucket) {
                this.refillBucket(bucket)
                bucket.tokens = Math.max(0, bucket.tokens - total)
            }
        }
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    getStatus(): {
        activeRequests: number
        buckets: Record<string, { tokens: number; capacity: number }>
    } {
        const buckets: Record<string, { tokens: number; capacity: number }> = {}

        for (const [name, bucket] of this.buckets) {
            this.refillBucket(bucket)
            buckets[name] = {
                tokens: Math.floor(bucket.tokens),
                capacity: bucket.capacity,
            }
        }

        return {
            activeRequests: this.activeRequests,
            buckets,
        }
    }

    reset(): void {
        this.activeRequests = 0
        this.waitQueue.length = 0
        this.initBuckets()
    }
}

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
    return new RateLimiter(config)
}

// Preset configurations
export const rateLimitPresets = {
    // Conservative limits for shared API keys
    conservative: {
        requestsPerMinute: 10,
        tokensPerMinute: 20000,
        concurrentRequests: 2,
    } as RateLimitConfig,

    // Standard limits for personal use
    standard: {
        requestsPerMinute: 30,
        tokensPerMinute: 60000,
        concurrentRequests: 5,
    } as RateLimitConfig,

    // High throughput for production
    production: {
        requestsPerMinute: 100,
        tokensPerMinute: 200000,
        concurrentRequests: 10,
    } as RateLimitConfig,

    // Anthropic tier 1 limits
    anthropicTier1: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000,
        concurrentRequests: 5,
    } as RateLimitConfig,

    // OpenAI tier 1 limits
    openaiTier1: {
        requestsPerMinute: 60,
        tokensPerMinute: 60000,
        concurrentRequests: 10,
    } as RateLimitConfig,
}
