/**
 * Prompts Module
 * 
 * Generate, store, and adapt prompts for buff-agents.
 */

export * from './types'
export { PromptGenerator, createPromptGenerator, type PromptGeneratorConfig } from './generator'
export { PromptStorage, createPromptStorage, type PromptStorageConfig } from './storage'
export { adaptPromptToAgent, createAgentFromPrompt, type AdaptPromptOptions } from './adapter'
