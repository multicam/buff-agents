#!/usr/bin/env bun
/**
 * Test script for buff-agents
 * 
 * Run with: ANTHROPIC_API_KEY=your-key bun run scripts/test-agent.ts
 */

import { createLLMRegistry } from '@/llm'
import { ToolRegistry } from '@/tools'
import { builtinTools } from '@/tools/builtin'
import { createAgentRuntime } from '@/runtime'
import { simpleEditor } from '@/agents'
import { createLogger } from '@/utils'
import { loadConfig } from '@/config'
import type { RuntimeEvent } from '@/runtime'

async function main() {
    const config = await loadConfig()
    const apiKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
    
    if (!apiKey) {
        console.error('❌ ANTHROPIC_API_KEY not found in .buff-agents.json or environment')
        console.error('\nUsage: ANTHROPIC_API_KEY=your-key bun run scripts/test-agent.ts')
        console.error('   Or: Create .buff-agents.json with providers.anthropic.apiKey')
        process.exit(1)
    }

    const logger = createLogger({ level: 'info' })

    const llmRegistry = await createLLMRegistry({
        anthropic: { apiKey },
    })

    const toolRegistry = new ToolRegistry()
    toolRegistry.registerAll(builtinTools)

    const runtime = createAgentRuntime({
        llmRegistry,
        toolRegistry,
        projectContext: {
            projectRoot: process.cwd(),
            cwd: process.cwd(),
        },
        logger,
        maxSteps: 10,
        onEvent: handleEvent,
    })

    console.log('\n🚀 Running Simple Editor agent...\n')

    const result = await runtime.run({
        agent: simpleEditor,
        prompt: 'List the files in the src directory and tell me what you see',
    })

    console.log('\n' + '─'.repeat(50))
    if (result.output.type === 'success') {
        console.log(`✅ ${result.output.message}`)
        if (result.output.data) {
            console.log('\nOutput:', JSON.stringify(result.output.data, null, 2))
        }
    } else {
        console.log(`❌ ${result.output.message}`)
    }
    console.log(`\n💰 Total cost: $${result.totalCost.toFixed(4)}`)
}

function handleEvent(event: RuntimeEvent): void {
    switch (event.type) {
        case 'llm_text':
            process.stdout.write(event.text)
            break
        case 'tool_start':
            console.log(`\n🔧 ${event.toolName}`)
            break
        case 'tool_event':
            if (event.event.type === 'file_changed') {
                console.log(`   📄 ${event.event.action}: ${event.event.path}`)
            }
            break
        case 'error':
            console.error(`\n❌ Error: ${event.error.message}`)
            break
    }
}

main().catch(console.error)
