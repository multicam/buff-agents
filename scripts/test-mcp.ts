#!/usr/bin/env bun
/**
 * Test MCP Server
 * 
 * Tests the MCP server by listing tools and calling one.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { spawn } from 'child_process'

async function main() {
    console.log('🔌 Starting MCP server...\n')

    // Start the MCP server as a subprocess
    const serverProcess = spawn('bun', ['run', 'src/mcp/cli.ts'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Create client transport
    const transport = new StdioClientTransport({
        command: 'bun',
        args: ['run', 'src/mcp/cli.ts'],
    })

    const client = new Client({
        name: 'test-client',
        version: '1.0.0',
    }, {
        capabilities: {},
    })

    try {
        await client.connect(transport)
        console.log('✅ Connected to MCP server\n')

        // List available tools
        console.log('📋 Listing available tools...\n')
        const tools = await client.listTools()
        
        for (const tool of tools.tools) {
            console.log(`  - ${tool.name}: ${tool.description?.slice(0, 60)}...`)
        }
        console.log(`\n  Total: ${tools.tools.length} tools\n`)

        // Test calling an agent
        console.log('🧪 Testing agent_simple_editor...\n')
        
        const result = await client.callTool({
            name: 'agent_simple_editor',
            arguments: {
                prompt: 'List the files in the src directory',
            },
        })

        console.log('📤 Result:')
        const content = result.content as Array<{ type: string; text?: string }>
        for (const item of content) {
            if (item.type === 'text') {
                console.log(item.text)
            }
        }

        console.log('\n✅ MCP server test passed!')
    } catch (error) {
        console.error('❌ Error:', error)
        process.exit(1)
    } finally {
        await client.close()
        serverProcess.kill()
    }
}

main()
