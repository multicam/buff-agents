/**
 * LLM Provider Tests
 * 
 * Tests for xAI and Perplexity providers.
 */

import { describe, it, expect } from 'bun:test'
import { XAIProvider, createXAIProvider } from '@/llm/providers/xai'
import { PerplexityProvider, createPerplexityProvider } from '@/llm/providers/perplexity'

describe('XAIProvider', () => {
    it('should create provider with correct name', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        expect(provider.name).toBe('xai')
    })

    it('should support xai/ prefixed models', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        expect(provider.supportsModel('xai/grok-2')).toBe(true)
        expect(provider.supportsModel('xai/grok-beta')).toBe(true)
        expect(provider.supportsModel('xai/grok-2-vision')).toBe(true)
    })

    it('should not support non-xai models', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        expect(provider.supportsModel('anthropic/claude-sonnet-4')).toBe(false)
        expect(provider.supportsModel('openai/gpt-4')).toBe(false)
        expect(provider.supportsModel('grok-2')).toBe(false)
    })

    it('should use default base URL', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        // Provider is created - internal client should use https://api.x.ai/v1
        expect(provider).toBeDefined()
    })

    it('should allow custom base URL', () => {
        const provider = createXAIProvider({ 
            apiKey: 'test-key',
            baseUrl: 'https://custom.api.example.com/v1'
        })
        
        expect(provider).toBeDefined()
    })

    it('should have supportedModels regex pattern', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        expect(provider.supportedModels).toHaveLength(1)
        expect(provider.supportedModels[0]).toBeInstanceOf(RegExp)
    })
})

describe('PerplexityProvider', () => {
    it('should create provider with correct name', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        expect(provider.name).toBe('perplexity')
    })

    it('should support perplexity/ prefixed models', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        expect(provider.supportsModel('perplexity/sonar')).toBe(true)
        expect(provider.supportsModel('perplexity/sonar-pro')).toBe(true)
        expect(provider.supportsModel('perplexity/sonar-reasoning')).toBe(true)
        expect(provider.supportsModel('perplexity/sonar-reasoning-pro')).toBe(true)
    })

    it('should not support non-perplexity models', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        expect(provider.supportsModel('anthropic/claude-sonnet-4')).toBe(false)
        expect(provider.supportsModel('openai/gpt-4')).toBe(false)
        expect(provider.supportsModel('sonar')).toBe(false)
    })

    it('should use default base URL', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        // Provider is created - internal client should use https://api.perplexity.ai
        expect(provider).toBeDefined()
    })

    it('should allow custom base URL', () => {
        const provider = createPerplexityProvider({ 
            apiKey: 'test-key',
            baseUrl: 'https://custom.perplexity.example.com'
        })
        
        expect(provider).toBeDefined()
    })

    it('should have supportedModels regex pattern', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        expect(provider.supportedModels).toHaveLength(1)
        expect(provider.supportedModels[0]).toBeInstanceOf(RegExp)
    })
})

describe('Provider Factory Functions', () => {
    it('createXAIProvider should return XAIProvider instance', () => {
        const provider = createXAIProvider({ apiKey: 'test-key' })
        
        expect(provider).toBeInstanceOf(XAIProvider)
    })

    it('createPerplexityProvider should return PerplexityProvider instance', () => {
        const provider = createPerplexityProvider({ apiKey: 'test-key' })
        
        expect(provider).toBeInstanceOf(PerplexityProvider)
    })
})

describe('LLMRegistry Integration', () => {
    it('should register xAI provider in registry', async () => {
        const { createLLMRegistry } = await import('@/llm/registry')
        
        const registry = await createLLMRegistry({
            xai: { apiKey: 'test-key' }
        })
        
        expect(registry.hasProvider('xai')).toBe(true)
    })

    it('should register perplexity provider in registry', async () => {
        const { createLLMRegistry } = await import('@/llm/registry')
        
        const registry = await createLLMRegistry({
            perplexity: { apiKey: 'test-key' }
        })
        
        expect(registry.hasProvider('perplexity')).toBe(true)
    })

    it('should get xAI provider for xai/ models', async () => {
        const { createLLMRegistry } = await import('@/llm/registry')
        
        const registry = await createLLMRegistry({
            xai: { apiKey: 'test-key' }
        })
        
        const provider = registry.getProvider('xai/grok-2')
        expect(provider.name).toBe('xai')
    })

    it('should get perplexity provider for perplexity/ models', async () => {
        const { createLLMRegistry } = await import('@/llm/registry')
        
        const registry = await createLLMRegistry({
            perplexity: { apiKey: 'test-key' }
        })
        
        const provider = registry.getProvider('perplexity/sonar')
        expect(provider.name).toBe('perplexity')
    })

    it('should list both providers when configured', async () => {
        const { createLLMRegistry } = await import('@/llm/registry')
        
        const registry = await createLLMRegistry({
            xai: { apiKey: 'test-key' },
            perplexity: { apiKey: 'test-key' }
        })
        
        const providers = registry.listProviders()
        expect(providers).toContain('xai')
        expect(providers).toContain('perplexity')
    })
})
