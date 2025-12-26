/**
 * Agent Tracer
 * 
 * Debugging and tracing tools for agent execution.
 */

import type { RuntimeEvent } from './events'
import type { TokenUsage } from '@/llm'

export interface TraceSpan {
    readonly id: string
    readonly name: string
    readonly type: 'agent' | 'step' | 'llm' | 'tool' | 'custom'
    readonly startTime: number
    readonly endTime?: number
    readonly duration?: number
    readonly parentId?: string
    readonly attributes: Record<string, unknown>
    readonly events: TraceEvent[]
    readonly status: 'running' | 'success' | 'error'
    readonly error?: string
}

export interface TraceEvent {
    readonly timestamp: number
    readonly name: string
    readonly attributes?: Record<string, unknown>
}

export interface TraceExport {
    readonly traceId: string
    readonly agentId: string
    readonly startTime: number
    readonly endTime: number
    readonly duration: number
    readonly spans: TraceSpan[]
    readonly summary: TraceSummary
}

export interface TraceSummary {
    readonly totalSteps: number
    readonly totalLLMCalls: number
    readonly totalToolCalls: number
    readonly totalTokens: { prompt: number; completion: number }
    readonly estimatedCost: number
    readonly toolBreakdown: Record<string, { count: number; totalDuration: number }>
    readonly errors: string[]
}

export class AgentTracer {
    private readonly traceId: string
    private readonly agentId: string
    private readonly spans: Map<string, TraceSpan> = new Map()
    private readonly startTime: number
    private spanCounter = 0
    private currentSpanId?: string

    constructor(agentId: string) {
        this.traceId = this.generateId()
        this.agentId = agentId
        this.startTime = Date.now()
    }

    startSpan(
        name: string,
        type: TraceSpan['type'],
        attributes: Record<string, unknown> = {}
    ): string {
        const id = this.generateSpanId()
        const span: TraceSpan = {
            id,
            name,
            type,
            startTime: Date.now(),
            parentId: this.currentSpanId,
            attributes,
            events: [],
            status: 'running',
        }

        this.spans.set(id, span)
        this.currentSpanId = id
        return id
    }

    endSpan(id: string, status: 'success' | 'error' = 'success', error?: string): void {
        const span = this.spans.get(id)
        if (!span) return

        const endTime = Date.now()
        this.spans.set(id, {
            ...span,
            endTime,
            duration: endTime - span.startTime,
            status,
            error,
        })

        // Restore parent as current
        this.currentSpanId = span.parentId
    }

    addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
        const span = this.spans.get(spanId)
        if (!span) return

        this.spans.set(spanId, {
            ...span,
            events: [...span.events, { timestamp: Date.now(), name, attributes }],
        })
    }

    setAttribute(spanId: string, key: string, value: unknown): void {
        const span = this.spans.get(spanId)
        if (!span) return

        this.spans.set(spanId, {
            ...span,
            attributes: { ...span.attributes, [key]: value },
        })
    }

    recordRuntimeEvent(event: RuntimeEvent): void {
        const spanId = this.currentSpanId
        if (!spanId) return

        this.addEvent(spanId, event.type, event as unknown as Record<string, unknown>)
    }

    export(): TraceExport {
        const endTime = Date.now()
        const spans = Array.from(this.spans.values())

        return {
            traceId: this.traceId,
            agentId: this.agentId,
            startTime: this.startTime,
            endTime,
            duration: endTime - this.startTime,
            spans,
            summary: this.computeSummary(spans),
        }
    }

    private computeSummary(spans: TraceSpan[]): TraceSummary {
        let totalSteps = 0
        let totalLLMCalls = 0
        let totalToolCalls = 0
        let promptTokens = 0
        let completionTokens = 0
        let estimatedCost = 0
        const toolBreakdown: Record<string, { count: number; totalDuration: number }> = {}
        const errors: string[] = []

        for (const span of spans) {
            if (span.type === 'step') totalSteps++
            if (span.type === 'llm') {
                totalLLMCalls++
                const usage = span.attributes.tokenUsage as TokenUsage | undefined
                if (usage) {
                    promptTokens += usage.promptTokens
                    completionTokens += usage.completionTokens
                }
                const cost = span.attributes.cost as number | undefined
                if (cost) estimatedCost += cost
            }
            if (span.type === 'tool') {
                totalToolCalls++
                const toolName = span.name
                if (!toolBreakdown[toolName]) {
                    toolBreakdown[toolName] = { count: 0, totalDuration: 0 }
                }
                toolBreakdown[toolName].count++
                toolBreakdown[toolName].totalDuration += span.duration ?? 0
            }
            if (span.status === 'error' && span.error) {
                errors.push(span.error)
            }
        }

        return {
            totalSteps,
            totalLLMCalls,
            totalToolCalls,
            totalTokens: { prompt: promptTokens, completion: completionTokens },
            estimatedCost,
            toolBreakdown,
            errors,
        }
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }

    private generateSpanId(): string {
        return `span-${++this.spanCounter}`
    }
}

export function createTracer(agentId: string): AgentTracer {
    return new AgentTracer(agentId)
}

/**
 * Format trace for console output
 */
export function formatTrace(trace: TraceExport): string {
    const lines: string[] = []

    lines.push(`\n${'='.repeat(60)}`)
    lines.push(`TRACE: ${trace.traceId}`)
    lines.push(`Agent: ${trace.agentId}`)
    lines.push(`Duration: ${trace.duration}ms`)
    lines.push(`${'='.repeat(60)}\n`)

    // Summary
    const s = trace.summary
    lines.push(`📊 Summary:`)
    lines.push(`   Steps: ${s.totalSteps}`)
    lines.push(`   LLM Calls: ${s.totalLLMCalls}`)
    lines.push(`   Tool Calls: ${s.totalToolCalls}`)
    lines.push(`   Tokens: ${s.totalTokens.prompt} prompt + ${s.totalTokens.completion} completion`)
    lines.push(`   Est. Cost: $${s.estimatedCost.toFixed(4)}`)

    if (Object.keys(s.toolBreakdown).length > 0) {
        lines.push(`\n🔧 Tool Breakdown:`)
        for (const [tool, stats] of Object.entries(s.toolBreakdown)) {
            lines.push(`   ${tool}: ${stats.count}x (${stats.totalDuration}ms total)`)
        }
    }

    if (s.errors.length > 0) {
        lines.push(`\n❌ Errors:`)
        for (const err of s.errors) {
            lines.push(`   - ${err}`)
        }
    }

    // Span tree
    lines.push(`\n📋 Span Tree:`)
    const rootSpans = trace.spans.filter(s => !s.parentId)
    for (const span of rootSpans) {
        formatSpanTree(span, trace.spans, lines, 0)
    }

    lines.push(`\n${'='.repeat(60)}\n`)

    return lines.join('\n')
}

function formatSpanTree(span: TraceSpan, allSpans: TraceSpan[], lines: string[], depth: number): void {
    const indent = '   '.repeat(depth)
    const status = span.status === 'success' ? '✅' : span.status === 'error' ? '❌' : '⏳'
    const duration = span.duration ? `${span.duration}ms` : 'running'

    lines.push(`${indent}${status} [${span.type}] ${span.name} (${duration})`)

    // Show key attributes
    const attrs = Object.entries(span.attributes)
        .filter(([k]) => !['tokenUsage', 'cost'].includes(k))
        .slice(0, 3)
    for (const [key, value] of attrs) {
        const valueStr = typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value).slice(0, 50)
        lines.push(`${indent}   ${key}: ${valueStr}`)
    }

    // Recurse to children
    const children = allSpans.filter(s => s.parentId === span.id)
    for (const child of children) {
        formatSpanTree(child, allSpans, lines, depth + 1)
    }
}

/**
 * Export trace to JSON file
 */
export async function exportTraceToFile(trace: TraceExport, filePath: string): Promise<void> {
    const { writeFile, mkdir } = await import('fs/promises')
    const { dirname } = await import('path')

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(trace, null, 2), 'utf-8')
}
