/**
 * Agent Templates
 * 
 * Pre-configured agent patterns for common use cases.
 */

import { createAgent } from '@/core'
import type { AgentDefinition, ModelIdentifier } from '@/core'

export interface AgentTemplateOptions {
    readonly id: string
    readonly displayName: string
    readonly model?: ModelIdentifier
    readonly additionalTools?: string[]
    readonly systemPromptAdditions?: string
}

/**
 * Create a file editing agent
 */
export function createFileEditor(options: AgentTemplateOptions): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'read_files',
            'write_file',
            'str_replace',
            'list_directory',
            'find_files',
            'grep_search',
            ...additionalTools
        )
        .withSystemPrompt(`You are a file editing assistant.

## Capabilities
- Read and analyze files
- Create new files
- Modify existing files using str_replace
- Search for patterns in code
- Navigate directory structures

## Guidelines
- Always read files before modifying them
- Use str_replace for targeted edits
- Preserve existing code style
- Explain changes you make

${systemPromptAdditions}`)
        .build()
}

/**
 * Create a code analysis agent
 */
export function createCodeAnalyzer(options: AgentTemplateOptions): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'read_files',
            'list_directory',
            'find_files',
            'grep_search',
            'set_output',
            ...additionalTools
        )
        .withSystemPrompt(`You are a code analysis assistant.

## Capabilities
- Read and understand code
- Search for patterns and usages
- Analyze dependencies
- Identify issues and improvements

## Output Format
Use set_output to return structured analysis:
{
  "summary": "Brief overview",
  "findings": [{ "type": "issue|suggestion|info", "description": "...", "location": "file:line" }],
  "metrics": { "files": N, "lines": N, ... }
}

${systemPromptAdditions}`)
        .withSetOutputEndsRun(true)
        .build()
}

/**
 * Create a task runner agent
 */
export function createTaskRunner(options: AgentTemplateOptions): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'run_terminal_command',
            'read_files',
            'list_directory',
            'set_output',
            ...additionalTools
        )
        .withSystemPrompt(`You are a task runner assistant.

## Capabilities
- Execute terminal commands
- Run build scripts
- Execute tests
- Check command output

## Guidelines
- Use SYNC mode for commands that complete quickly
- Use BACKGROUND mode for long-running processes
- Check exit codes and stderr for errors
- Report results clearly

${systemPromptAdditions}`)
        .build()
}

/**
 * Create an orchestrator agent that delegates to sub-agents
 */
export function createOrchestrator(options: AgentTemplateOptions & {
    readonly spawnableAgents: string[]
}): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        spawnableAgents,
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'read_files',
            'list_directory',
            'find_files',
            'grep_search',
            'spawn_agents',
            'set_output',
            ...additionalTools
        )
        .withSpawnableAgents(...spawnableAgents)
        .withSystemPrompt(`You are an orchestrator that coordinates complex tasks.

## Available Sub-Agents
${spawnableAgents.map(a => `- ${a}`).join('\n')}

## Workflow
1. Analyze the task requirements
2. Gather necessary context
3. Break down into sub-tasks
4. Delegate to appropriate sub-agents
5. Review and synthesize results

## Guidelines
- Always gather context before delegating
- Be specific in prompts to sub-agents
- Review sub-agent outputs
- Handle failures gracefully

${systemPromptAdditions}`)
        .build()
}

/**
 * Create a research agent that can search the web
 */
export function createResearcher(options: AgentTemplateOptions): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'web_search',
            'read_files',
            'write_file',
            'set_output',
            ...additionalTools
        )
        .withSystemPrompt(`You are a research assistant.

## Capabilities
- Search the web for information
- Read and analyze documents
- Synthesize findings
- Write reports

## Guidelines
- Use multiple search queries for comprehensive research
- Verify information from multiple sources
- Cite sources in your findings
- Organize information clearly

${systemPromptAdditions}`)
        .build()
}

/**
 * Create a Q&A agent for answering questions about code
 */
export function createCodeQA(options: AgentTemplateOptions): AgentDefinition {
    const {
        id,
        displayName,
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        systemPromptAdditions = '',
    } = options

    return createAgent({ id, displayName, model })
        .withTools(
            'read_files',
            'find_files',
            'grep_search',
            'list_directory',
            ...additionalTools
        )
        .withSystemPrompt(`You are a code Q&A assistant.

## Capabilities
- Answer questions about the codebase
- Explain how code works
- Find relevant code sections
- Describe architecture and patterns

## Guidelines
- Read relevant files before answering
- Use grep_search to find specific patterns
- Provide code examples when helpful
- Be concise but thorough

${systemPromptAdditions}`)
        .build()
}

// Pre-built templates
export const templates = {
    fileEditor: createFileEditor,
    codeAnalyzer: createCodeAnalyzer,
    taskRunner: createTaskRunner,
    orchestrator: createOrchestrator,
    researcher: createResearcher,
    codeQA: createCodeQA,
}
