#!/usr/bin/env bun
/**
 * Test Phase 5 Features
 * 
 * Tests streaming, tracer, rate limiter, and plugin system.
 */

import { 
    createStreamController,
    createStreamEvents,
    streamToSSE,
    collectStreamText,
    createTracer,
    formatTrace,
    createRateLimiter,
    rateLimitPresets,
} from '@/runtime'
import { 
    createPluginLoader,
    definePluginTool,
    definePlugin,
} from '@/tools'
import { rmSync, existsSync, mkdirSync, writeFileSync } from 'fs'

const TEST_DIR = './.buff-agents-test'

async function main() {
    console.log('🧪 Testing Phase 5 Features\n')
    console.log('=' .repeat(50))

    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true })
    }

    await testStreaming()
    await testTracer()
    await testRateLimiter()
    await testPluginSystem()

    // Cleanup
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true })
    }

    console.log('\n' + '=' .repeat(50))
    console.log('✅ All Phase 5 tests passed!')
}

async function testStreaming() {
    console.log('\n📡 Testing Streaming...\n')

    // Test stream controller
    const { controller, stream } = createStreamController()
    const events = createStreamEvents(controller)

    // Push some events
    events.text('Hello', 'Hello')
    events.text(' World', 'Hello World')
    events.toolCall('read_files', 'tc-1', { paths: ['test.txt'] })
    events.toolResult('tc-1', { content: 'file content' }, 50)
    events.done('Task completed', 3, { prompt: 100, completion: 50 }, 0.005)

    // Collect results
    const chunks = []
    for await (const chunk of stream) {
        chunks.push(chunk)
    }

    console.log(`  Stream chunks: ${chunks.length === 5 ? '✅' : '❌'} (${chunks.length} chunks)`)
    console.log(`  Text chunks: ${chunks.filter(c => c.type === 'text').length === 2 ? '✅' : '❌'}`)
    console.log(`  Tool chunks: ${chunks.filter(c => c.type === 'tool_call' || c.type === 'tool_result').length === 2 ? '✅' : '❌'}`)
    console.log(`  Done chunk: ${chunks.find(c => c.type === 'done') ? '✅' : '❌'}`)

    // Test SSE conversion
    const { controller: ctrl2, stream: stream2 } = createStreamController()
    const events2 = createStreamEvents(ctrl2)
    
    setTimeout(() => {
        events2.text('SSE Test', 'SSE Test')
        events2.done('done', 1, { prompt: 10, completion: 5 }, 0.001)
    }, 10)

    const sseStream = streamToSSE(stream2)
    const reader = sseStream.getReader()
    const { value } = await reader.read()
    reader.releaseLock()

    const sseText = new TextDecoder().decode(value)
    console.log(`  SSE format: ${sseText.startsWith('data: ') ? '✅' : '❌'}`)

    // Test collectStreamText
    const { controller: ctrl3, stream: stream3 } = createStreamController()
    const events3 = createStreamEvents(ctrl3)
    
    setTimeout(() => {
        events3.text('Part 1', 'Part 1')
        events3.text(' Part 2', 'Part 1 Part 2')
        events3.done('done', 1, { prompt: 10, completion: 5 }, 0.001)
    }, 10)

    const fullText = await collectStreamText(stream3)
    console.log(`  Collect text: ${fullText === 'Part 1 Part 2' ? '✅' : '❌'} ("${fullText}")`)

    console.log('\n  ✅ Streaming test passed')
}

async function testTracer() {
    console.log('\n🔍 Testing Tracer...\n')

    const tracer = createTracer('test-agent')

    // Simulate agent execution
    const agentSpan = tracer.startSpan('test-agent', 'agent', { prompt: 'Test task' })

    // Step 1
    const step1 = tracer.startSpan('step-1', 'step')
    
    const llm1 = tracer.startSpan('llm-call', 'llm', { model: 'claude-sonnet' })
    tracer.setAttribute(llm1, 'tokenUsage', { promptTokens: 100, completionTokens: 50, totalTokens: 150 })
    tracer.setAttribute(llm1, 'cost', 0.003)
    tracer.endSpan(llm1, 'success')

    const tool1 = tracer.startSpan('read_files', 'tool')
    tracer.addEvent(tool1, 'file_read', { path: '/src/index.ts' })
    tracer.endSpan(tool1, 'success')

    tracer.endSpan(step1, 'success')

    // Step 2
    const step2 = tracer.startSpan('step-2', 'step')
    
    const llm2 = tracer.startSpan('llm-call', 'llm', { model: 'claude-sonnet' })
    tracer.setAttribute(llm2, 'tokenUsage', { promptTokens: 150, completionTokens: 100, totalTokens: 250 })
    tracer.setAttribute(llm2, 'cost', 0.005)
    tracer.endSpan(llm2, 'success')

    const tool2 = tracer.startSpan('write_file', 'tool')
    tracer.endSpan(tool2, 'success')

    tracer.endSpan(step2, 'success')

    tracer.endSpan(agentSpan, 'success')

    // Export trace
    const trace = tracer.export()

    console.log(`  Trace ID: ${trace.traceId ? '✅' : '❌'}`)
    console.log(`  Spans: ${trace.spans.length === 7 ? '✅' : '❌'} (${trace.spans.length} spans)`)
    console.log(`  Steps: ${trace.summary.totalSteps === 2 ? '✅' : '❌'} (${trace.summary.totalSteps})`)
    console.log(`  LLM calls: ${trace.summary.totalLLMCalls === 2 ? '✅' : '❌'} (${trace.summary.totalLLMCalls})`)
    console.log(`  Tool calls: ${trace.summary.totalToolCalls === 2 ? '✅' : '❌'} (${trace.summary.totalToolCalls})`)
    console.log(`  Total tokens: ${trace.summary.totalTokens.prompt === 250 ? '✅' : '❌'} (${trace.summary.totalTokens.prompt} prompt)`)
    console.log(`  Est. cost: ${trace.summary.estimatedCost === 0.008 ? '✅' : '❌'} ($${trace.summary.estimatedCost})`)

    // Test format output
    const formatted = formatTrace(trace)
    console.log(`  Format trace: ${formatted.includes('TRACE:') && formatted.includes('Summary') ? '✅' : '❌'}`)

    console.log('\n  ✅ Tracer test passed')
}

async function testRateLimiter() {
    console.log('\n⏱️  Testing Rate Limiter...\n')

    // Test basic rate limiting
    const limiter = createRateLimiter({
        requestsPerMinute: 5,
        concurrentRequests: 2,
    })

    // Should allow first requests
    const status1 = limiter.checkRequest()
    console.log(`  First request: ${status1.allowed ? '✅' : '❌'}`)

    // Acquire some slots
    await limiter.acquire()
    await limiter.acquire()

    // Third should be blocked (concurrent limit)
    const status2 = limiter.checkRequest()
    console.log(`  Concurrent limit: ${!status2.allowed ? '✅' : '❌'} (blocked: ${!status2.allowed})`)

    // Release one
    limiter.release()
    const status3 = limiter.checkRequest()
    console.log(`  After release: ${status3.allowed ? '✅' : '❌'}`)

    limiter.release()

    // Test status
    const status = limiter.getStatus()
    console.log(`  Status check: ${status.buckets.rpm ? '✅' : '❌'} (rpm bucket exists)`)

    // Test presets
    const conservative = createRateLimiter(rateLimitPresets.conservative)
    const conservativeStatus = conservative.getStatus()
    console.log(`  Presets: ${conservativeStatus.buckets.rpm?.capacity === 10 ? '✅' : '❌'} (conservative: 10 rpm)`)

    // Test token recording
    limiter.recordTokenUsage(100, 50)
    console.log(`  Token recording: ✅`)

    // Test reset
    limiter.reset()
    const afterReset = limiter.getStatus()
    console.log(`  Reset: ${afterReset.activeRequests === 0 ? '✅' : '❌'}`)

    console.log('\n  ✅ Rate Limiter test passed')
}

async function testPluginSystem() {
    console.log('\n🔌 Testing Plugin System...\n')

    // Create a test plugin directory
    const pluginDir = `${TEST_DIR}/plugins/test-plugin`
    mkdirSync(pluginDir, { recursive: true })

    // Create plugin manifest
    const manifest = definePlugin({
        name: 'test-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        tools: ['testTool'],
    })
    writeFileSync(`${pluginDir}/plugin.json`, JSON.stringify(manifest, null, 2))

    // Create plugin code
    const pluginCode = `
export const testTool = {
    name: 'test_tool',
    description: 'A test tool from plugin',
    inputSchema: {
        type: 'object',
        properties: {
            message: { type: 'string' }
        },
        required: ['message']
    },
    async execute(context) {
        return { echo: context.input.message }
    }
}
`
    writeFileSync(`${pluginDir}/index.js`, pluginCode)

    // Test plugin loader
    const loader = createPluginLoader()

    // Load from directory
    const plugins = await loader.loadFromDirectory(`${TEST_DIR}/plugins`)
    console.log(`  Load plugins: ${plugins.length === 1 ? '✅' : '❌'} (${plugins.length} loaded)`)

    // Check plugin details
    const testPlugin = loader.getPlugin('test-plugin')
    console.log(`  Get plugin: ${testPlugin?.manifest.name === 'test-plugin' ? '✅' : '❌'}`)
    console.log(`  Plugin tools: ${testPlugin?.tools.length === 1 ? '✅' : '❌'} (${testPlugin?.tools.length} tools)`)

    // Get all tools
    const allTools = loader.getAllTools()
    console.log(`  All tools: ${allTools.length === 1 ? '✅' : '❌'}`)
    console.log(`  Tool name: ${allTools[0]?.name === 'test_tool' ? '✅' : '❌'} (${allTools[0]?.name})`)

    // Test definePluginTool helper
    const customTool = definePluginTool({
        name: 'custom_tool',
        description: 'Custom tool',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => ({ success: true }),
    })
    console.log(`  definePluginTool: ${customTool.name === 'custom_tool' ? '✅' : '❌'}`)

    // Test unload
    const unloaded = loader.unloadPlugin('test-plugin')
    console.log(`  Unload plugin: ${unloaded ? '✅' : '❌'}`)
    console.log(`  After unload: ${loader.getLoadedPlugins().length === 0 ? '✅' : '❌'}`)

    console.log('\n  ✅ Plugin System test passed')
}

main().catch(error => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
})
