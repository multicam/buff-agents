/**
 * Plugin System
 * 
 * Load and manage custom tools from external packages or directories.
 */

import { existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import type { ToolDefinition } from './types'
import { ToolRegistry } from './registry'

export interface PluginManifest {
    readonly name: string
    readonly version: string
    readonly description?: string
    readonly tools: string[]  // Tool names exported by this plugin
    readonly main: string     // Entry point file
}

export interface LoadedPlugin {
    readonly manifest: PluginManifest
    readonly tools: ToolDefinition[]
    readonly path: string
}

export interface PluginLoaderConfig {
    readonly pluginDirs?: string[]
    readonly allowedPlugins?: string[]  // Whitelist of plugin names
    readonly blockedPlugins?: string[]  // Blacklist of plugin names
}

export class PluginLoader {
    private readonly config: PluginLoaderConfig
    private readonly loadedPlugins: Map<string, LoadedPlugin> = new Map()

    constructor(config: PluginLoaderConfig = {}) {
        this.config = config
    }

    async loadFromDirectory(dir: string): Promise<LoadedPlugin[]> {
        if (!existsSync(dir)) {
            return []
        }

        const entries = await readdir(dir, { withFileTypes: true })
        const plugins: LoadedPlugin[] = []

        for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const pluginPath = join(dir, entry.name)
            const manifestPath = join(pluginPath, 'plugin.json')

            if (!existsSync(manifestPath)) continue

            try {
                const plugin = await this.loadPlugin(pluginPath)
                if (plugin) {
                    plugins.push(plugin)
                }
            } catch (error) {
                console.warn(`Failed to load plugin from ${pluginPath}:`, error)
            }
        }

        return plugins
    }

    async loadPlugin(pluginPath: string): Promise<LoadedPlugin | null> {
        const manifestPath = join(pluginPath, 'plugin.json')

        if (!existsSync(manifestPath)) {
            throw new Error(`No plugin.json found in ${pluginPath}`)
        }

        const manifestContent = await readFile(manifestPath, 'utf-8')
        const manifest = JSON.parse(manifestContent) as PluginManifest

        // Check whitelist/blacklist
        if (this.config.allowedPlugins && !this.config.allowedPlugins.includes(manifest.name)) {
            console.warn(`Plugin ${manifest.name} not in allowed list, skipping`)
            return null
        }

        if (this.config.blockedPlugins?.includes(manifest.name)) {
            console.warn(`Plugin ${manifest.name} is blocked, skipping`)
            return null
        }

        // Check if already loaded
        if (this.loadedPlugins.has(manifest.name)) {
            return this.loadedPlugins.get(manifest.name)!
        }

        // Load the main entry point
        const mainPath = resolve(pluginPath, manifest.main)
        const module = await import(mainPath)

        // Extract tools
        const tools: ToolDefinition[] = []
        for (const toolName of manifest.tools) {
            const tool = module[toolName]
            if (tool && typeof tool === 'object' && 'name' in tool && 'execute' in tool) {
                tools.push(tool as ToolDefinition)
            } else {
                console.warn(`Tool ${toolName} not found or invalid in plugin ${manifest.name}`)
            }
        }

        const plugin: LoadedPlugin = {
            manifest,
            tools,
            path: pluginPath,
        }

        this.loadedPlugins.set(manifest.name, plugin)
        return plugin
    }

    async loadFromPackage(packageName: string): Promise<LoadedPlugin | null> {
        try {
            const module = await import(packageName)

            // Check for plugin manifest in package
            const manifest: PluginManifest = module.pluginManifest ?? {
                name: packageName,
                version: '0.0.0',
                tools: [],
                main: packageName,
            }

            // Auto-discover tools if not specified
            if (manifest.tools.length === 0) {
                for (const [key, value] of Object.entries(module)) {
                    if (this.isToolDefinition(value)) {
                        manifest.tools.push(key)
                    }
                }
            }

            const tools: ToolDefinition[] = []
            for (const toolName of manifest.tools) {
                const tool = module[toolName]
                if (this.isToolDefinition(tool)) {
                    tools.push(tool as ToolDefinition)
                }
            }

            const plugin: LoadedPlugin = {
                manifest,
                tools,
                path: packageName,
            }

            this.loadedPlugins.set(manifest.name, plugin)
            return plugin
        } catch (error) {
            console.warn(`Failed to load plugin from package ${packageName}:`, error)
            return null
        }
    }

    private isToolDefinition(value: unknown): value is ToolDefinition {
        return (
            typeof value === 'object' &&
            value !== null &&
            'name' in value &&
            'execute' in value &&
            typeof (value as any).name === 'string' &&
            typeof (value as any).execute === 'function'
        )
    }

    getLoadedPlugins(): LoadedPlugin[] {
        return Array.from(this.loadedPlugins.values())
    }

    getPlugin(name: string): LoadedPlugin | undefined {
        return this.loadedPlugins.get(name)
    }

    getAllTools(): ToolDefinition[] {
        const tools: ToolDefinition[] = []
        for (const plugin of this.loadedPlugins.values()) {
            tools.push(...plugin.tools)
        }
        return tools
    }

    registerAllTools(registry: ToolRegistry): void {
        for (const tool of this.getAllTools()) {
            registry.register(tool)
        }
    }

    unloadPlugin(name: string): boolean {
        return this.loadedPlugins.delete(name)
    }

    clear(): void {
        this.loadedPlugins.clear()
    }
}

export function createPluginLoader(config?: PluginLoaderConfig): PluginLoader {
    return new PluginLoader(config)
}

/**
 * Create a tool definition helper for plugin authors
 */
export function definePluginTool<T = unknown>(
    definition: Omit<ToolDefinition<T>, 'execute'> & {
        execute: ToolDefinition<T>['execute']
    }
): ToolDefinition<T> {
    return definition as ToolDefinition<T>
}

/**
 * Create a plugin manifest
 */
export function definePlugin(manifest: Omit<PluginManifest, 'main'> & { main?: string }): PluginManifest {
    return {
        main: 'index.js',
        ...manifest,
    }
}
