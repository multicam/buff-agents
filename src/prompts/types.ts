/**
 * Prompt Generator Types
 * 
 * Types for generating, storing, and adapting prompts.
 */

export interface GeneratedPrompt {
    /** Unique identifier for the prompt */
    readonly id: string
    /** Human-readable name */
    readonly name: string
    /** Original generation request */
    readonly originalRequest: string
    /** Generated system prompt */
    readonly systemPrompt: string
    /** Suggested tools for this agent */
    readonly suggestedTools: string[]
    /** Brief description of the agent's purpose */
    readonly description: string
    /** Example tasks this agent can handle */
    readonly exampleTasks: string[]
    /** Generation metadata */
    readonly metadata: GenerationMetadata
}

export interface GenerationMetadata {
    /** When the prompt was generated */
    readonly generatedAt: string
    /** Model used for generation */
    readonly model: string
    /** Generation cost in dollars */
    readonly cost: number
    /** Tokens used */
    readonly tokensUsed: number
}

export interface GeneratePromptOptions {
    /** The initial description/request for the agent */
    readonly description: string
    /** Optional name for the agent (will be auto-generated if not provided) */
    readonly name?: string
    /** Model to use for generation (defaults to claude-sonnet) */
    readonly model?: string
    /** Additional context or constraints */
    readonly additionalContext?: string
}

export interface StoredPromptDefinition {
    /** The generated prompt */
    readonly prompt: GeneratedPrompt
    /** Version of the storage format */
    readonly version: number
}

/** Available built-in tools that can be suggested */
export const AVAILABLE_TOOLS = [
    'read_files',
    'write_file',
    'str_replace',
    'list_directory',
    'find_files',
    'grep_search',
    'run_terminal_command',
    'web_search',
    'spawn_agents',
    'set_output',
    'end_turn',
] as const

export type AvailableTool = typeof AVAILABLE_TOOLS[number]
