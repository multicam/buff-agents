/**
 * MCP Server
 * 
 * Model Context Protocol server that exposes buff-agents to Cascade/Claude Code.
 * Agents are exposed as MCP tools that can be invoked by the host.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import type { AgentDefinition } from '@/core'
import type { LLMRegistry } from '@/llm'
import type { ToolRegistry } from '@/tools'
import type { ProjectContext } from '@/tools'
import type { Logger } from '@/utils'
import { createAgentRuntime } from '@/runtime'
import type { RuntimeEvent } from '@/runtime'

export interface MCPServerConfig {
    readonly name: string
    readonly version: string
    readonly agents: AgentDefinition[]
    readonly llmRegistry: LLMRegistry
    readonly toolRegistry: ToolRegistry
    readonly projectContext: ProjectContext
    readonly logger: Logger
}

export async function createMCPServer(config: MCPServerConfig): Promise<Server> {
    const {
        name,
        version,
        agents,
        llmRegistry,
        toolRegistry,
        projectContext,
        logger,
    } = config

    const server = new Server(
        { name, version },
        { capabilities: { tools: {} } }
    )

    // Map agent IDs to definitions
    const agentMap = new Map<string, AgentDefinition>()
    for (const agent of agents) {
        agentMap.set(agent.id, agent)
    }

    // List available agents as MCP tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const tools: Tool[] = agents.map(agent => ({
            name: `agent_${agent.id.replace(/-/g, '_')}`,
            description: `Run the ${agent.displayName} agent. ${agent.systemPrompt?.slice(0, 200) ?? ''}`,
            inputSchema: {
                type: 'object' as const,
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'Task description for the agent',
                    },
                    params: {
                        type: 'object',
                        description: 'Optional parameters to pass to the agent',
                    },
                },
                required: ['prompt'],
            },
        }))

        return { tools }
    })

    // Handle tool calls (agent invocations)
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name: toolName, arguments: args } = request.params

        // Extract agent ID from tool name (agent_simple_editor -> simple-editor)
        const agentId = toolName
            .replace(/^agent_/, '')
            .replace(/_/g, '-')

        const agent = agentMap.get(agentId)
        if (!agent) {
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: `Unknown agent: ${agentId}` }),
                }],
                isError: true,
            }
        }

        const prompt = (args as { prompt: string; params?: Record<string, unknown> }).prompt
        const params = (args as { prompt: string; params?: Record<string, unknown> }).params

        logger.info({ agentId, prompt }, 'MCP: Running agent')

        const output: string[] = []

        const runtime = createAgentRuntime({
            llmRegistry,
            toolRegistry,
            projectContext,
            logger: logger.child({ mcp: true, agentId }),
            maxSteps: 20,
            onEvent: (event: RuntimeEvent) => {
                // Collect output for MCP response
                if (event.type === 'llm_text') {
                    output.push(event.text)
                } else if (event.type === 'tool_start') {
                    output.push(`\n[Tool: ${event.toolName}]\n`)
                } else if (event.type === 'error') {
                    output.push(`\n[Error: ${event.error.message}]\n`)
                }
            },
        })

        try {
            const result = await runtime.run({
                agent,
                prompt,
                params,
            })

            const responseText = output.join('') || result.output.message

            return {
                content: [{
                    type: 'text',
                    text: responseText,
                }],
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error({ error, agentId }, 'MCP: Agent execution failed')

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ error: message }),
                }],
                isError: true,
            }
        }
    })

    return server
}

export async function startMCPServer(config: MCPServerConfig): Promise<void> {
    const server = await createMCPServer(config)
    const transport = new StdioServerTransport()
    await server.connect(transport)
    config.logger.info('MCP server started')
}
