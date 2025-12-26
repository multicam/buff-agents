#!/usr/bin/env node
/**
 * Buff-Agents CLI
 * 
 * Single command interface for running agents.
 */

import { Command } from 'commander'
import { loadConfig } from '@/config'
import { createLLMRegistry } from '@/llm'
import { ToolRegistry } from '@/tools'
import { builtinTools } from '@/tools/builtin'
import { createAgentRuntime } from '@/runtime'
import { simpleEditor, orchestrator, fileExplorer, codeReviewer, openaiEditor, openrouterEditor, xaiEditor, perplexitySearch } from '@/agents'
import { createPromptGenerator, createPromptStorage, adaptPromptToAgent } from '@/prompts'
import { createLogger } from '@/utils'
import type { RuntimeEvent } from '@/runtime'
import type { AgentDefinition } from '@/core'
import type { GeneratedPrompt } from '@/prompts'

const program = new Command()

program
    .name('buff-agents')
    .description('Autonomous coding agent library')
    .version('0.1.0')

program
    .command('run')
    .description('Run an agent with a prompt')
    .argument('<agent>', 'Agent ID (e.g., simple-editor)')
    .argument('<prompt>', 'Task description')
    .option('-c, --config <path>', 'Config file path')
    .option('-v, --verbose', 'Verbose output')
    .action(async (agentId: string, prompt: string, options: { config?: string; verbose?: boolean }) => {
        const logger = createLogger({ level: options.verbose ? 'debug' : 'info' })

        try {
            const config = await loadConfig(options.config)

            const anthropicKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY

            if (!anthropicKey) {
                console.error('Error: ANTHROPIC_API_KEY not found in config or environment')
                process.exit(1)
            }

            const openaiKey = config.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY
            const openrouterKey = config.providers?.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY
            const xaiKey = config.providers?.xai?.apiKey ?? process.env.XAI_API_KEY
            const perplexityKey = config.providers?.perplexity?.apiKey ?? process.env.PERPLEXITY_API_KEY

            const llmRegistry = await createLLMRegistry({
                anthropic: { apiKey: anthropicKey },
                openai: openaiKey ? { apiKey: openaiKey } : undefined,
                openrouter: openrouterKey ? { apiKey: openrouterKey } : undefined,
                xai: xaiKey ? { apiKey: xaiKey } : undefined,
                perplexity: perplexityKey ? { apiKey: perplexityKey } : undefined,
            })

            const toolRegistry = new ToolRegistry()
            toolRegistry.registerAll(builtinTools)

            const agents: Record<string, AgentDefinition> = {
                'simple-editor': simpleEditor,
                'orchestrator': orchestrator,
                'file-explorer': fileExplorer,
                'code-reviewer': codeReviewer,
                'openai-editor': openaiEditor,
                'openrouter-editor': openrouterEditor,
                'xai-editor': xaiEditor,
                'perplexity-search': perplexitySearch,
            }

            const agent = agents[agentId]
            if (!agent) {
                console.error(`Error: Unknown agent '${agentId}'. Available: ${Object.keys(agents).join(', ')}`)
                process.exit(1)
            }

            const runtime = createAgentRuntime({
                llmRegistry,
                toolRegistry,
                projectContext: {
                    projectRoot: process.cwd(),
                    cwd: process.cwd(),
                },
                logger,
                maxSteps: config.maxSteps,
                onEvent: (event: RuntimeEvent) => {
                    handleEvent(event, options.verbose ?? false)
                },
            })

            console.log(`\n🚀 Running ${agent.displayName}...\n`)

            const result = await runtime.run({
                agent,
                prompt,
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

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error)
            process.exit(1)
        }
    })

program
    .command('list')
    .description('List available agents')
    .action(() => {
        console.log('\nAvailable agents:')
        console.log('  simple-editor     - Basic file editing agent (Anthropic)')
        console.log('  openai-editor     - Basic file editing agent (OpenAI)')
        console.log('  openrouter-editor - Basic file editing agent (OpenRouter/Gemini)')
        console.log('  xai-editor        - Basic file editing agent (xAI/Grok)')
        console.log('  perplexity-search - Web search assistant (Perplexity)')
        console.log('  orchestrator      - Orchestrates complex tasks using sub-agents')
        console.log('  file-explorer     - Explores project structure and finds files')
        console.log('  code-reviewer     - Reviews code for quality and issues')
        console.log('')
        console.log('Use "buff-agents list-generated" to see generated agents.')
        console.log('')
    })

program
    .command('generate')
    .description('Generate a new agent from a description')
    .argument('<description>', 'Description of what the agent should do')
    .option('-n, --name <name>', 'Name for the agent')
    .option('-m, --model <model>', 'Anthropic model to use (e.g., claude-sonnet-4-20250514, claude-3-opus-20240229, claude-3-haiku-20240307)')
    .option('-c, --config <path>', 'Config file path')
    .option('--context <context>', 'Additional context or requirements')
    .option('--run', 'Run the generated agent immediately')
    .option('--prompt <prompt>', 'Prompt to run if --run is specified')
    .action(async (
        description: string,
        options: {
            name?: string
            model?: string
            config?: string
            context?: string
            run?: boolean
            prompt?: string
        }
    ) => {
        try {
            const config = await loadConfig(options.config)
            const apiKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY

            if (!apiKey) {
                console.error('Error: ANTHROPIC_API_KEY not found in config or environment')
                process.exit(1)
            }

            const modelName = options.model ?? 'claude-sonnet-4-20250514'
            console.log(`\n🔮 Generating agent prompt using ${modelName}...\n`)

            const generator = createPromptGenerator({ apiKey })
            const generated = await generator.generate({
                description,
                name: options.name,
                model: modelName,
                additionalContext: options.context,
            })

            const storage = createPromptStorage({ projectRoot: process.cwd() })
            const filepath = await storage.save(generated)

            console.log(`✅ Generated: ${generated.name}`)
            console.log(`   ID: ${generated.id}`)
            console.log(`   Description: ${generated.description}`)
            console.log(`   Tools: ${generated.suggestedTools.join(', ')}`)
            console.log(`   Saved to: ${filepath}`)
            console.log(`   Cost: $${generated.metadata.cost.toFixed(4)}`)
            console.log('')

            if (options.run) {
                if (!options.prompt) {
                    console.error('Error: --prompt is required when using --run')
                    process.exit(1)
                }
                await runGeneratedAgent(generated, options.prompt, config)
            } else {
                console.log('Run this agent with:')
                console.log(`  buff-agents run-generated ${generated.id} "<your prompt>"\n`)
            }

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error)
            process.exit(1)
        }
    })

program
    .command('run-generated')
    .description('Run a previously generated agent')
    .argument('<id>', 'Generated agent ID')
    .argument('<prompt>', 'Task description')
    .option('-c, --config <path>', 'Config file path')
    .option('-v, --verbose', 'Verbose output')
    .action(async (
        id: string,
        prompt: string,
        options: { config?: string; verbose?: boolean }
    ) => {
        try {
            const config = await loadConfig(options.config)

            const storage = createPromptStorage({ projectRoot: process.cwd() })
            
            if (!await storage.exists(id)) {
                console.error(`Error: Generated agent '${id}' not found.`)
                console.error('Use "buff-agents list-generated" to see available generated agents.')
                process.exit(1)
            }

            const generated = await storage.load(id)
            await runGeneratedAgent(generated, prompt, config, options.verbose)

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error)
            process.exit(1)
        }
    })

program
    .command('list-generated')
    .description('List all generated agents')
    .action(async () => {
        try {
            const storage = createPromptStorage({ projectRoot: process.cwd() })
            const prompts = await storage.list()

            if (prompts.length === 0) {
                console.log('\nNo generated agents found.')
                console.log('Generate one with: buff-agents generate "<description>"\n')
                return
            }

            console.log('\nGenerated agents:\n')
            for (const prompt of prompts) {
                const date = new Date(prompt.metadata.generatedAt).toLocaleDateString()
                console.log(`  ${prompt.id}`)
                console.log(`    Name: ${prompt.name}`)
                console.log(`    Description: ${prompt.description}`)
                console.log(`    Tools: ${prompt.suggestedTools.join(', ')}`)
                console.log(`    Generated: ${date}`)
                console.log('')
            }

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error)
            process.exit(1)
        }
    })

program
    .command('delete-generated')
    .description('Delete a generated agent')
    .argument('<id>', 'Generated agent ID')
    .action(async (id: string) => {
        try {
            const storage = createPromptStorage({ projectRoot: process.cwd() })

            if (!await storage.exists(id)) {
                console.error(`Error: Generated agent '${id}' not found.`)
                process.exit(1)
            }

            await storage.delete(id)
            console.log(`\n✅ Deleted generated agent: ${id}\n`)

        } catch (error) {
            console.error('Error:', error instanceof Error ? error.message : error)
            process.exit(1)
        }
    })

async function runGeneratedAgent(
    generated: GeneratedPrompt,
    prompt: string,
    config: Awaited<ReturnType<typeof loadConfig>>,
    verbose = false
): Promise<void> {
    const logger = createLogger({ level: verbose ? 'debug' : 'info' })

    const anthropicKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
        console.error('Error: ANTHROPIC_API_KEY not found')
        process.exit(1)
    }

    const openaiKey = config.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY
    const openrouterKey = config.providers?.openrouter?.apiKey ?? process.env.OPENROUTER_API_KEY
    const xaiKey = config.providers?.xai?.apiKey ?? process.env.XAI_API_KEY
    const perplexityKey = config.providers?.perplexity?.apiKey ?? process.env.PERPLEXITY_API_KEY

    const llmRegistry = await createLLMRegistry({
        anthropic: { apiKey: anthropicKey },
        openai: openaiKey ? { apiKey: openaiKey } : undefined,
        openrouter: openrouterKey ? { apiKey: openrouterKey } : undefined,
        xai: xaiKey ? { apiKey: xaiKey } : undefined,
        perplexity: perplexityKey ? { apiKey: perplexityKey } : undefined,
    })

    const toolRegistry = new ToolRegistry()
    toolRegistry.registerAll(builtinTools)

    const agent = adaptPromptToAgent(generated)

    const runtime = createAgentRuntime({
        llmRegistry,
        toolRegistry,
        projectContext: {
            projectRoot: process.cwd(),
            cwd: process.cwd(),
        },
        logger,
        maxSteps: config.maxSteps,
        onEvent: (event: RuntimeEvent) => {
            handleEvent(event, verbose)
        },
    })

    console.log(`\n🚀 Running ${generated.name}...\n`)

    const result = await runtime.run({
        agent,
        prompt,
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

function handleEvent(event: RuntimeEvent, verbose: boolean): void {
    switch (event.type) {
        case 'step_start':
            if (verbose) {
                console.log(`\n📍 Step ${event.stepNumber}`)
            }
            break

        case 'llm_text':
            process.stdout.write(event.text)
            break

        case 'tool_start':
            console.log(`\n🔧 ${event.toolName}`)
            break

        case 'tool_result':
            if (verbose) {
                const preview = JSON.stringify(event.result).slice(0, 200)
                console.log(`   → ${preview}${preview.length >= 200 ? '...' : ''}`)
            }
            break

        case 'tool_event':
            if (event.event.type === 'file_changed') {
                console.log(`   📄 ${event.event.action}: ${event.event.path}`)
            } else if (event.event.type === 'command_output' && verbose) {
                process.stdout.write(event.event.data)
            }
            break

        case 'error':
            console.error(`\n❌ Error: ${event.error.message}`)
            break

        case 'step_limit_reached':
            console.log('\n⚠️  Step limit reached')
            break
    }
}

program.parse()
