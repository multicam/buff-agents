/**
 * LLM Provider Registry
 * 
 * Manages LLM providers with hybrid strategy:
 * - Direct providers for Anthropic/OpenAI
 * - OpenRouter fallback for other models
 */

import type { LLMProvider, LLMProviderConfig } from './types'
import type { ModelIdentifier } from '@/core'

export class LLMRegistry {
    private providers = new Map<string, LLMProvider>()
    private fallback?: LLMProvider

    register(provider: LLMProvider): void {
        this.providers.set(provider.name, provider)
    }

    setFallback(provider: LLMProvider): void {
        this.fallback = provider
    }

    getProvider(model: ModelIdentifier): LLMProvider {
        const { provider: providerName } = this.parseModel(model)

        const direct = this.providers.get(providerName)
        if (direct?.supportsModel(model)) {
            return direct
        }

        if (this.fallback) {
            return this.fallback
        }

        throw new Error(`No provider found for model: ${model}`)
    }

    parseModel(model: ModelIdentifier): { provider: string; modelName: string } {
        const parts = model.split('/')
        if (parts.length < 2) {
            return { provider: 'anthropic', modelName: model }
        }
        return { provider: parts[0], modelName: parts.slice(1).join('/') }
    }

    hasProvider(name: string): boolean {
        return this.providers.has(name)
    }

    listProviders(): string[] {
        return Array.from(this.providers.keys())
    }
}

export interface LLMRegistryConfig {
    anthropic?: LLMProviderConfig
    openai?: LLMProviderConfig
    google?: LLMProviderConfig
    openrouter?: LLMProviderConfig
}

export async function createLLMRegistry(config: LLMRegistryConfig): Promise<LLMRegistry> {
    const registry = new LLMRegistry()

    if (config.anthropic?.apiKey) {
        const { createAnthropicProvider } = await import('./providers/anthropic')
        registry.register(createAnthropicProvider(config.anthropic))
    }

    if (config.openai?.apiKey) {
        const { createOpenAIProvider } = await import('./providers/openai')
        registry.register(createOpenAIProvider(config.openai))
    }

    if (config.openrouter?.apiKey) {
        const { createOpenRouterProvider } = await import('./providers/openrouter')
        const provider = createOpenRouterProvider(config.openrouter)
        registry.register(provider)
        registry.setFallback(provider)
    }

    return registry
}

export function createEmptyLLMRegistry(): LLMRegistry {
    return new LLMRegistry()
}
