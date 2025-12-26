/**
 * Prompt Adapter
 * 
 * Converts generated prompts into buff-agents AgentDefinition format.
 */

import { createAgent } from '@/core'
import type { AgentDefinition, ModelIdentifier } from '@/core'
import type { GeneratedPrompt } from './types'

export interface AdaptPromptOptions {
    /** Override the model (defaults to anthropic/claude-sonnet-4-20250514) */
    readonly model?: ModelIdentifier
    /** Additional tools to include beyond suggested ones */
    readonly additionalTools?: string[]
    /** Override the suggested tools entirely */
    readonly overrideTools?: string[]
    /** Whether set_output should end the run */
    readonly setOutputEndsRun?: boolean
}

/**
 * Convert a generated prompt into an AgentDefinition
 */
export function adaptPromptToAgent(
    prompt: GeneratedPrompt,
    options: AdaptPromptOptions = {}
): AgentDefinition {
    const {
        model = 'anthropic/claude-sonnet-4-20250514',
        additionalTools = [],
        overrideTools,
        setOutputEndsRun = true,
    } = options

    const tools = overrideTools ?? [...prompt.suggestedTools, ...additionalTools]

    // Ensure we have set_output and end_turn for proper agent behavior
    if (!tools.includes('set_output')) {
        tools.push('set_output')
    }
    if (!tools.includes('end_turn')) {
        tools.push('end_turn')
    }

    const builder = createAgent({
        id: prompt.id,
        displayName: prompt.name,
        model,
    })
        .withTools(...tools)
        .withSystemPrompt(buildFullSystemPrompt(prompt))
        .withSetOutputEndsRun(setOutputEndsRun)

    return builder.build()
}

/**
 * Build the full system prompt including metadata and instructions
 */
function buildFullSystemPrompt(prompt: GeneratedPrompt): string {
    const sections = [
        prompt.systemPrompt,
        '',
        '## Available Tools',
        ...prompt.suggestedTools.map(t => `- ${t}`),
    ]

    if (prompt.exampleTasks.length > 0) {
        sections.push(
            '',
            '## Example Tasks You Can Handle',
            ...prompt.exampleTasks.map(t => `- ${t}`)
        )
    }

    return sections.join('\n')
}

/**
 * Create a simple runtime agent from a generated prompt
 * This is a convenience function for quick usage
 */
export function createAgentFromPrompt(
    prompt: GeneratedPrompt,
    options: AdaptPromptOptions = {}
): AgentDefinition {
    return adaptPromptToAgent(prompt, options)
}
