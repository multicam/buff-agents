#!/usr/bin/env node
/**
 * MCP Server CLI
 * 
 * Starts the MCP server for integration with Cascade/Claude Code.
 */

import { loadConfig } from '@/config'
import { createLLMRegistry } from '@/llm'
import { ToolRegistry } from '@/tools'
import { builtinTools } from '@/tools/builtin'
import { simpleEditor, orchestrator, fileExplorer, codeReviewer, openaiEditor, openrouterEditor, xaiEditor, perplexitySearch } from '@/agents'
import { createLogger } from '@/utils'
import { startMCPServer } from './server'

async function main() {
    const logger = createLogger({ level: 'info' })

    try {
        const config = await loadConfig()

        const anthropicKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
        const openaiKey = config.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY
        const openrouterKey = config.providers?.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY
        const xaiKey = config.providers?.xai?.apiKey ?? process.env.XAI_API_KEY
        const perplexityKey = config.providers?.perplexity?.apiKey ?? process.env.PERPLEXITY_API_KEY

        if (!anthropicKey && !openaiKey && !openrouterKey && !xaiKey && !perplexityKey) {
            logger.error('No API keys found in config or environment')
            process.exit(1)
        }

        const llmRegistry = await createLLMRegistry({
            anthropic: anthropicKey ? { apiKey: anthropicKey } : undefined,
            openai: openaiKey ? { apiKey: openaiKey } : undefined,
            openrouter: openrouterKey ? { apiKey: openrouterKey } : undefined,
            xai: xaiKey ? { apiKey: xaiKey } : undefined,
            perplexity: perplexityKey ? { apiKey: perplexityKey } : undefined,
        })

        const toolRegistry = new ToolRegistry()
        toolRegistry.registerAll(builtinTools)

        const agents = [
            simpleEditor,
            orchestrator,
            fileExplorer,
            codeReviewer,
            openaiEditor,
            openrouterEditor,
            xaiEditor,
            perplexitySearch,
        ]

        await startMCPServer({
            name: 'buff-agents',
            version: '0.1.0',
            agents,
            llmRegistry,
            toolRegistry,
            projectContext: {
                projectRoot: process.cwd(),
                cwd: process.cwd(),
            },
            logger,
        })
    } catch (error) {
        logger.error({ error }, 'Failed to start MCP server')
        process.exit(1)
    }
}

main()
