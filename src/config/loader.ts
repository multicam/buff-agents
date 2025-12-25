/**
 * Configuration Loader
 * 
 * Loads configuration from .buff-agents.json file.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { BuffAgentsConfig } from './types'
import { defaultConfig } from './types'

export async function loadConfig(configPath?: string): Promise<BuffAgentsConfig> {
    const path = configPath ?? join(process.cwd(), '.buff-agents.json')

    try {
        const content = await readFile(path, 'utf-8')
        const parsed = JSON.parse(content) as BuffAgentsConfig

        const resolved = resolveEnvVars(parsed)

        return mergeConfig(defaultConfig, resolved)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return defaultConfig
        }
        throw error
    }
}

function resolveEnvVars(config: BuffAgentsConfig): BuffAgentsConfig {
    const resolved = JSON.stringify(config)

    const withEnv = resolved.replace(/\$\{(\w+)\}/g, (_, varName) => {
        return process.env[varName] ?? ''
    })

    return JSON.parse(withEnv) as BuffAgentsConfig
}

function mergeConfig(base: BuffAgentsConfig, override: BuffAgentsConfig): BuffAgentsConfig {
    return {
        ...base,
        ...override,
        providers: {
            ...base.providers,
            ...override.providers,
        },
        mcp: {
            ...base.mcp,
            ...override.mcp,
        },
    }
}

export function getApiKey(config: BuffAgentsConfig, provider: string): string | undefined {
    const providers = config.providers as Record<string, { apiKey?: string } | undefined> | undefined
    return providers?.[provider]?.apiKey
}
