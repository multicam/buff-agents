/**
 * Agent Registry
 * 
 * Manages agent definitions for dynamic loading and sub-agent spawning.
 */

import type { AgentDefinition } from '@/core'

export class AgentRegistry {
    private agents = new Map<string, AgentDefinition>()

    register(agent: AgentDefinition): void {
        this.agents.set(agent.id, agent)
    }

    registerAll(agents: AgentDefinition[]): void {
        for (const agent of agents) {
            this.register(agent)
        }
    }

    get(id: string): AgentDefinition | undefined {
        return this.agents.get(id)
    }

    has(id: string): boolean {
        return this.agents.has(id)
    }

    list(): AgentDefinition[] {
        return Array.from(this.agents.values())
    }

    ids(): string[] {
        return Array.from(this.agents.keys())
    }

    getSpawnable(allowedIds?: readonly string[]): AgentDefinition[] {
        if (!allowedIds) {
            return this.list()
        }
        return allowedIds
            .map(id => this.agents.get(id))
            .filter((a): a is AgentDefinition => a !== undefined)
    }
}

export function createAgentRegistry(): AgentRegistry {
    return new AgentRegistry()
}
