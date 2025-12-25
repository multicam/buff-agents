/**
 * Orchestrator Agent
 * 
 * A base2-style orchestrator that uses handleSteps for programmatic control.
 * Demonstrates the layers pattern: context gathering → planning → implementation → review.
 */

import { createAgent } from '@/core'
import type { AgentStepContext, StepYield, StepYieldResult } from '@/core'

export const orchestrator = createAgent({
    id: 'orchestrator',
    displayName: 'Orchestrator',
    model: 'anthropic/claude-sonnet-4-20250514',
})
    .withTools(
        'read_files',
        'list_directory',
        'find_files',
        'grep_search',
        'spawn_agents',
        'set_output',
        'end_turn'
    )
    .withSpawnableAgents('simple-editor', 'file-explorer', 'code-reviewer')
    .withSystemPrompt(`You are an orchestrator agent that coordinates complex tasks by delegating to specialized sub-agents.

## Your Role
- Break down complex tasks into smaller, focused sub-tasks
- Gather context before planning
- Delegate implementation to specialized agents
- Review and validate results

## Available Sub-Agents
- **simple-editor**: Can read, write, and modify files
- **file-explorer**: Explores project structure and finds relevant files
- **code-reviewer**: Reviews code changes for quality and correctness

## Workflow (Layers Pattern)
1. **Context Gathering**: Use tools to understand the codebase and requirements
2. **Planning**: Create a clear plan with specific sub-tasks
3. **Implementation**: Spawn sub-agents to execute each sub-task
4. **Review**: Validate results and iterate if needed

## Guidelines
- Always gather context before spawning agents
- Be specific in your prompts to sub-agents
- Review sub-agent outputs before proceeding
- Use set_output to return structured results`)
    .withHandleSteps(function* (_ctx: AgentStepContext): Generator<StepYield, void, StepYieldResult> {
        // Layer 1: Initial context gathering
        // Let the LLM gather context first
        yield 'STEP'
        
        // Layer 2: Planning and delegation
        // After context, let LLM plan and potentially spawn agents
        yield 'STEP'
        
        // Layer 3: Review results
        // Let LLM review any sub-agent outputs
        yield 'STEP'
        
        // Continue until LLM decides to end
        while (true) {
            const result = yield 'STEP'
            if (result.stepsComplete) {
                break
            }
        }
    })
    .build()

export default orchestrator
