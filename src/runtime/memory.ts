/**
 * Persistent Agent Memory
 * 
 * File-based memory system for agents to persist information across runs.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

export interface MemoryEntry {
    readonly key: string
    readonly value: unknown
    readonly createdAt: string
    readonly updatedAt: string
    readonly tags?: readonly string[]
    readonly ttl?: number  // Seconds until expiry
}

export interface MemoryStore {
    readonly entries: Record<string, MemoryEntry>
    readonly metadata: {
        readonly agentId: string
        readonly createdAt: string
        readonly updatedAt: string
    }
}

export interface MemoryConfig {
    readonly storePath: string
    readonly agentId: string
    readonly autoSave?: boolean
}

export class AgentMemory {
    private store: MemoryStore
    private readonly config: MemoryConfig
    private dirty = false

    constructor(config: MemoryConfig) {
        this.config = config
        this.store = {
            entries: {},
            metadata: {
                agentId: config.agentId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        }
    }

    async load(): Promise<void> {
        const filePath = this.getFilePath()
        
        if (!existsSync(filePath)) {
            return
        }

        try {
            const content = await readFile(filePath, 'utf-8')
            const loaded = JSON.parse(content) as MemoryStore
            
            // Validate and clean expired entries
            this.store = {
                ...loaded,
                entries: this.cleanExpired(loaded.entries),
            }
            this.dirty = false
        } catch (error) {
            // Start fresh if file is corrupted
            console.warn(`Failed to load memory from ${filePath}:`, error)
        }
    }

    async save(): Promise<void> {
        if (!this.dirty) return

        const filePath = this.getFilePath()
        
        await mkdir(dirname(filePath), { recursive: true })
        
        this.store = {
            ...this.store,
            metadata: {
                ...this.store.metadata,
                updatedAt: new Date().toISOString(),
            },
        }

        await writeFile(filePath, JSON.stringify(this.store, null, 2), 'utf-8')
        this.dirty = false
    }

    get<T = unknown>(key: string): T | undefined {
        const entry = this.store.entries[key]
        if (!entry) return undefined

        // Check expiry
        if (entry.ttl) {
            const expiresAt = new Date(entry.updatedAt).getTime() + entry.ttl * 1000
            if (Date.now() > expiresAt) {
                this.delete(key)
                return undefined
            }
        }

        return entry.value as T
    }

    set(key: string, value: unknown, options?: { tags?: string[]; ttl?: number }): void {
        const now = new Date().toISOString()
        const existing = this.store.entries[key]

        this.store = {
            ...this.store,
            entries: {
                ...this.store.entries,
                [key]: {
                    key,
                    value,
                    createdAt: existing?.createdAt ?? now,
                    updatedAt: now,
                    tags: options?.tags,
                    ttl: options?.ttl,
                },
            },
        }
        this.dirty = true

        if (this.config.autoSave) {
            this.save().catch(console.error)
        }
    }

    delete(key: string): boolean {
        if (!(key in this.store.entries)) {
            return false
        }

        const { [key]: _, ...rest } = this.store.entries
        this.store = {
            ...this.store,
            entries: rest,
        }
        this.dirty = true

        if (this.config.autoSave) {
            this.save().catch(console.error)
        }

        return true
    }

    has(key: string): boolean {
        return this.get(key) !== undefined
    }

    keys(): string[] {
        return Object.keys(this.cleanExpired(this.store.entries))
    }

    getByTag(tag: string): MemoryEntry[] {
        return Object.values(this.store.entries).filter(
            entry => entry.tags?.includes(tag)
        )
    }

    clear(): void {
        this.store = {
            ...this.store,
            entries: {},
        }
        this.dirty = true

        if (this.config.autoSave) {
            this.save().catch(console.error)
        }
    }

    getAll(): Record<string, unknown> {
        const result: Record<string, unknown> = {}
        for (const key of this.keys()) {
            result[key] = this.get(key)
        }
        return result
    }

    private getFilePath(): string {
        return join(this.config.storePath, `${this.config.agentId}.memory.json`)
    }

    private cleanExpired(entries: Record<string, MemoryEntry>): Record<string, MemoryEntry> {
        const now = Date.now()
        const result: Record<string, MemoryEntry> = {}

        for (const [key, entry] of Object.entries(entries)) {
            if (entry.ttl) {
                const expiresAt = new Date(entry.updatedAt).getTime() + entry.ttl * 1000
                if (now > expiresAt) {
                    continue
                }
            }
            result[key] = entry
        }

        return result
    }
}

export async function createAgentMemory(config: MemoryConfig): Promise<AgentMemory> {
    const memory = new AgentMemory(config)
    await memory.load()
    return memory
}

/**
 * Shared memory across all agents in a project
 */
export class ProjectMemory {
    private readonly memories = new Map<string, AgentMemory>()
    private readonly storePath: string

    constructor(storePath: string) {
        this.storePath = storePath
    }

    async getAgentMemory(agentId: string): Promise<AgentMemory> {
        let memory = this.memories.get(agentId)
        if (!memory) {
            memory = await createAgentMemory({
                storePath: this.storePath,
                agentId,
                autoSave: true,
            })
            this.memories.set(agentId, memory)
        }
        return memory
    }

    async saveAll(): Promise<void> {
        await Promise.all(
            Array.from(this.memories.values()).map(m => m.save())
        )
    }
}

export function createProjectMemory(storePath: string): ProjectMemory {
    return new ProjectMemory(storePath)
}
