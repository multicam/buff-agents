/**
 * Conversation History Management
 * 
 * Manages conversation sessions with persistence and retrieval.
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'
import type { Message } from '@/core'

export interface ConversationSession {
    readonly id: string
    readonly agentId: string
    readonly title?: string
    readonly messages: Message[]
    readonly createdAt: string
    readonly updatedAt: string
    readonly metadata?: Record<string, unknown>
}

export interface ConversationConfig {
    readonly storePath: string
    readonly maxSessions?: number  // Max sessions to keep per agent
    readonly autoSave?: boolean
}

export class ConversationManager {
    private sessions = new Map<string, ConversationSession>()
    private readonly config: ConversationConfig

    constructor(config: ConversationConfig) {
        this.config = {
            maxSessions: 100,
            autoSave: true,
            ...config,
        }
    }

    async createSession(agentId: string, title?: string): Promise<ConversationSession> {
        const id = this.generateId()
        const now = new Date().toISOString()

        const session: ConversationSession = {
            id,
            agentId,
            title: title ?? `Session ${id.slice(0, 8)}`,
            messages: [],
            createdAt: now,
            updatedAt: now,
        }

        this.sessions.set(id, session)

        if (this.config.autoSave) {
            await this.saveSession(session)
        }

        return session
    }

    async getSession(id: string): Promise<ConversationSession | undefined> {
        // Check memory first
        let session = this.sessions.get(id)
        if (session) return session

        // Try to load from disk
        session = await this.loadSession(id)
        if (session) {
            this.sessions.set(id, session)
        }

        return session
    }

    async addMessage(sessionId: string, message: Message): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        const updated: ConversationSession = {
            ...session,
            messages: [...session.messages, message],
            updatedAt: new Date().toISOString(),
        }

        this.sessions.set(sessionId, updated)

        if (this.config.autoSave) {
            await this.saveSession(updated)
        }
    }

    async addMessages(sessionId: string, messages: Message[]): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        const updated: ConversationSession = {
            ...session,
            messages: [...session.messages, ...messages],
            updatedAt: new Date().toISOString(),
        }

        this.sessions.set(sessionId, updated)

        if (this.config.autoSave) {
            await this.saveSession(updated)
        }
    }

    async listSessions(agentId?: string): Promise<ConversationSession[]> {
        const sessionsDir = this.config.storePath
        
        if (!existsSync(sessionsDir)) {
            return []
        }

        const files = await readdir(sessionsDir)
        const sessions: ConversationSession[] = []

        for (const file of files) {
            if (!file.endsWith('.conversation.json')) continue

            const id = file.replace('.conversation.json', '')
            const session = await this.getSession(id)
            
            if (session && (!agentId || session.agentId === agentId)) {
                sessions.push(session)
            }
        }

        // Sort by most recent first
        return sessions.sort((a, b) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
    }

    async deleteSession(id: string): Promise<boolean> {
        this.sessions.delete(id)

        const filePath = this.getSessionPath(id)
        if (existsSync(filePath)) {
            const { unlink } = await import('fs/promises')
            await unlink(filePath)
            return true
        }

        return false
    }

    async updateTitle(sessionId: string, title: string): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        const updated: ConversationSession = {
            ...session,
            title,
            updatedAt: new Date().toISOString(),
        }

        this.sessions.set(sessionId, updated)

        if (this.config.autoSave) {
            await this.saveSession(updated)
        }
    }

    async setMetadata(sessionId: string, metadata: Record<string, unknown>): Promise<void> {
        const session = await this.getSession(sessionId)
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`)
        }

        const updated: ConversationSession = {
            ...session,
            metadata: { ...session.metadata, ...metadata },
            updatedAt: new Date().toISOString(),
        }

        this.sessions.set(sessionId, updated)

        if (this.config.autoSave) {
            await this.saveSession(updated)
        }
    }

    async cleanupOldSessions(agentId: string): Promise<number> {
        const sessions = await this.listSessions(agentId)
        const maxSessions = this.config.maxSessions ?? 100

        if (sessions.length <= maxSessions) {
            return 0
        }

        // Delete oldest sessions beyond the limit
        const toDelete = sessions.slice(maxSessions)
        let deleted = 0

        for (const session of toDelete) {
            if (await this.deleteSession(session.id)) {
                deleted++
            }
        }

        return deleted
    }

    private async saveSession(session: ConversationSession): Promise<void> {
        const filePath = this.getSessionPath(session.id)
        await mkdir(dirname(filePath), { recursive: true })
        await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8')
    }

    private async loadSession(id: string): Promise<ConversationSession | undefined> {
        const filePath = this.getSessionPath(id)

        if (!existsSync(filePath)) {
            return undefined
        }

        try {
            const content = await readFile(filePath, 'utf-8')
            return JSON.parse(content) as ConversationSession
        } catch {
            return undefined
        }
    }

    private getSessionPath(id: string): string {
        return join(this.config.storePath, `${id}.conversation.json`)
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
}

export function createConversationManager(config: ConversationConfig): ConversationManager {
    return new ConversationManager(config)
}

/**
 * Fork a conversation from a specific point
 */
export async function forkConversation(
    manager: ConversationManager,
    sourceSessionId: string,
    fromMessageIndex: number,
    newTitle?: string
): Promise<ConversationSession> {
    const source = await manager.getSession(sourceSessionId)
    if (!source) {
        throw new Error(`Source session not found: ${sourceSessionId}`)
    }

    const forked = await manager.createSession(
        source.agentId,
        newTitle ?? `Fork of ${source.title}`
    )

    const messagesToCopy = source.messages.slice(0, fromMessageIndex + 1)
    await manager.addMessages(forked.id, messagesToCopy)

    return manager.getSession(forked.id) as Promise<ConversationSession>
}
