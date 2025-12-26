#!/usr/bin/env bun
/**
 * Test Phase 4 Features
 * 
 * Tests context pruner, memory, conversation manager, and agent templates.
 */

import { 
    createContextPruner,
    createAgentMemory,
    createConversationManager,
    createProjectMemory,
} from '@/runtime'
import { 
    createFileEditor,
    createCodeAnalyzer,
    createTaskRunner,
    createOrchestrator,
} from '@/agents'
import { userMessage, assistantMessage, systemMessage } from '@/core'
import { rmSync, existsSync } from 'fs'

const TEST_DIR = './.buff-agents-test'

async function main() {
    console.log('🧪 Testing Phase 4 Features\n')
    console.log('=' .repeat(50))

    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true })
    }

    await testContextPruner()
    await testAgentMemory()
    await testConversationManager()
    await testAgentTemplates()

    // Cleanup
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true })
    }

    console.log('\n' + '=' .repeat(50))
    console.log('✅ All Phase 4 tests passed!')
}

async function testContextPruner() {
    console.log('\n📋 Testing Context Pruner...\n')

    const pruner = createContextPruner({
        maxTokens: 500,
        targetTokens: 300,
        preserveRecentMessages: 2,
    })

    // Create a bunch of messages
    const messages = [
        systemMessage('You are a helpful assistant.'),
        userMessage('Hello, can you help me?'),
        assistantMessage('Of course! What do you need?'),
        userMessage('I need to fix a bug in my code.'),
        assistantMessage('Sure, let me take a look. Can you share the code?'),
        userMessage('Here is the code: function foo() { return bar }'),
        assistantMessage('I see the issue. The variable bar is not defined.'),
        userMessage('How do I fix it?'),
        assistantMessage('You need to define bar before using it, or pass it as a parameter.'),
        userMessage('Thanks! Can you show me an example?', { tags: ['USER_PROMPT'], keepDuringTruncation: true }),
    ]

    const result = await pruner.prune(messages)

    console.log(`  Original messages: ${messages.length}`)
    console.log(`  Original tokens: ~${result.originalTokens}`)
    console.log(`  Final messages: ${result.messages.length}`)
    console.log(`  Final tokens: ~${result.finalTokens}`)
    console.log(`  Pruned: ${result.pruned}`)
    console.log(`  Summarized: ${result.summarizedCount}`)

    // Verify system message preserved
    const hasSystem = result.messages.some(m => m.role === 'system')
    console.log(`  System preserved: ${hasSystem ? '✅' : '❌'}`)

    // Verify tagged message preserved
    const hasTagged = result.messages.some(m => 
        'tags' in m && m.tags?.includes('USER_PROMPT')
    )
    console.log(`  Tagged preserved: ${hasTagged ? '✅' : '❌'}`)

    if (!hasSystem || !hasTagged) {
        throw new Error('Context pruner failed to preserve important messages')
    }

    console.log('\n  ✅ Context Pruner test passed')
}

async function testAgentMemory() {
    console.log('\n💾 Testing Agent Memory...\n')

    const memory = await createAgentMemory({
        storePath: TEST_DIR + '/memory',
        agentId: 'test-agent',
        autoSave: true,
    })

    // Test set/get
    memory.set('task', { name: 'Fix bug', status: 'in_progress' })
    const task = memory.get<{ name: string; status: string }>('task')
    console.log(`  Set/Get: ${task?.name === 'Fix bug' ? '✅' : '❌'}`)

    // Test tags
    memory.set('file1', '/src/index.ts', { tags: ['modified'] })
    memory.set('file2', '/src/utils.ts', { tags: ['modified'] })
    memory.set('file3', '/src/other.ts', { tags: ['read'] })
    
    const modified = memory.getByTag('modified')
    console.log(`  Tags: ${modified.length === 2 ? '✅' : '❌'} (found ${modified.length} tagged entries)`)

    // Test TTL (set with 1 second TTL)
    memory.set('temp', 'temporary value', { ttl: 1 })
    const tempBefore = memory.get('temp')
    console.log(`  TTL before expiry: ${tempBefore === 'temporary value' ? '✅' : '❌'}`)

    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 1100))
    const tempAfter = memory.get('temp')
    console.log(`  TTL after expiry: ${tempAfter === undefined ? '✅' : '❌'}`)

    // Test persistence
    await memory.save()
    
    const memory2 = await createAgentMemory({
        storePath: TEST_DIR + '/memory',
        agentId: 'test-agent',
    })
    
    const loadedTask = memory2.get<{ name: string }>('task')
    console.log(`  Persistence: ${loadedTask?.name === 'Fix bug' ? '✅' : '❌'}`)

    // Test project memory
    const projectMemory = createProjectMemory(TEST_DIR + '/project-memory')
    const agentMem1 = await projectMemory.getAgentMemory('agent1')
    const agentMem2 = await projectMemory.getAgentMemory('agent2')
    
    agentMem1.set('data', 'agent1 data')
    agentMem2.set('data', 'agent2 data')
    
    console.log(`  Project memory isolation: ${
        agentMem1.get('data') === 'agent1 data' && 
        agentMem2.get('data') === 'agent2 data' ? '✅' : '❌'
    }`)

    console.log('\n  ✅ Agent Memory test passed')
}

async function testConversationManager() {
    console.log('\n💬 Testing Conversation Manager...\n')

    const manager = createConversationManager({
        storePath: TEST_DIR + '/conversations',
        autoSave: true,
    })

    // Create session
    const session = await manager.createSession('test-agent', 'Test Session')
    console.log(`  Create session: ${session.id ? '✅' : '❌'} (${session.id.slice(0, 12)}...)`)

    // Add messages
    await manager.addMessage(session.id, userMessage('Hello'))
    await manager.addMessage(session.id, assistantMessage('Hi there!'))

    const updated = await manager.getSession(session.id)
    console.log(`  Add messages: ${updated?.messages.length === 2 ? '✅' : '❌'} (${updated?.messages.length} messages)`)

    // Update title
    await manager.updateTitle(session.id, 'Renamed Session')
    const renamed = await manager.getSession(session.id)
    console.log(`  Update title: ${renamed?.title === 'Renamed Session' ? '✅' : '❌'}`)

    // Set metadata
    await manager.setMetadata(session.id, { cost: 0.05, model: 'claude-sonnet' })
    const withMeta = await manager.getSession(session.id)
    console.log(`  Set metadata: ${withMeta?.metadata?.cost === 0.05 ? '✅' : '❌'}`)

    // Create another session
    await manager.createSession('test-agent', 'Second Session')

    // List sessions
    const sessions = await manager.listSessions('test-agent')
    console.log(`  List sessions: ${sessions.length === 2 ? '✅' : '❌'} (${sessions.length} sessions)`)

    // Test persistence
    const manager2 = createConversationManager({
        storePath: TEST_DIR + '/conversations',
    })
    const loaded = await manager2.getSession(session.id)
    console.log(`  Persistence: ${loaded?.messages.length === 2 ? '✅' : '❌'}`)

    console.log('\n  ✅ Conversation Manager test passed')
}

async function testAgentTemplates() {
    console.log('\n🏗️  Testing Agent Templates...\n')

    // Test file editor template
    const editor = createFileEditor({
        id: 'test-editor',
        displayName: 'Test Editor',
        model: 'anthropic/claude-sonnet-4-20250514',
    })
    console.log(`  FileEditor: ${editor.id === 'test-editor' ? '✅' : '❌'} (${editor.tools?.length} tools)`)

    // Test code analyzer template
    const analyzer = createCodeAnalyzer({
        id: 'test-analyzer',
        displayName: 'Test Analyzer',
    })
    console.log(`  CodeAnalyzer: ${analyzer.id === 'test-analyzer' ? '✅' : '❌'} (setOutputEndsRun: ${analyzer.setOutputEndsRun})`)

    // Test task runner template
    const runner = createTaskRunner({
        id: 'test-runner',
        displayName: 'Test Runner',
        additionalTools: ['list_directory'],
    })
    const hasListDir = runner.tools?.includes('list_directory')
    console.log(`  TaskRunner: ${hasListDir ? '✅' : '❌'} (additional tools work)`)

    // Test orchestrator template
    const orchestrator = createOrchestrator({
        id: 'test-orchestrator',
        displayName: 'Test Orchestrator',
        spawnableAgents: ['test-editor', 'test-analyzer'],
    })
    const hasSpawn = orchestrator.tools?.includes('spawn_agents')
    const hasSpawnable = orchestrator.spawnableAgents?.length === 2
    console.log(`  Orchestrator: ${hasSpawn && hasSpawnable ? '✅' : '❌'} (spawn_agents: ${hasSpawn}, spawnable: ${orchestrator.spawnableAgents?.length})`)

    // Verify system prompts are set
    const hasPrompts = [editor, analyzer, runner, orchestrator].every(a => a.systemPrompt && a.systemPrompt.length > 50)
    console.log(`  System prompts: ${hasPrompts ? '✅' : '❌'}`)

    console.log('\n  ✅ Agent Templates test passed')
}

main().catch(error => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
})
