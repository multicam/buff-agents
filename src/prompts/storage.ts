/**
 * Prompt Storage
 * 
 * Handles saving and loading generated prompts from the .prompts/ directory.
 */

import { mkdir, readFile, writeFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import type { GeneratedPrompt, StoredPromptDefinition } from './types'

const STORAGE_VERSION = 1
const PROMPTS_DIR = '.prompts'

export interface PromptStorageConfig {
    readonly projectRoot: string
}

export class PromptStorage {
    private promptsDir: string

    constructor(config: PromptStorageConfig) {
        this.promptsDir = join(config.projectRoot, PROMPTS_DIR)
    }

    async save(prompt: GeneratedPrompt): Promise<string> {
        await this.ensureDir()

        const stored: StoredPromptDefinition = {
            prompt,
            version: STORAGE_VERSION,
        }

        const filename = `${prompt.id}.json`
        const filepath = join(this.promptsDir, filename)

        await writeFile(filepath, JSON.stringify(stored, null, 2), 'utf-8')

        return filepath
    }

    async load(id: string): Promise<GeneratedPrompt> {
        const filepath = join(this.promptsDir, `${id}.json`)
        const content = await readFile(filepath, 'utf-8')
        const stored: StoredPromptDefinition = JSON.parse(content)

        if (stored.version !== STORAGE_VERSION) {
            console.warn(`Prompt ${id} uses old storage version ${stored.version}, current is ${STORAGE_VERSION}`)
        }

        return stored.prompt
    }

    async list(): Promise<GeneratedPrompt[]> {
        await this.ensureDir()

        const files = await readdir(this.promptsDir)
        const prompts: GeneratedPrompt[] = []

        for (const file of files) {
            if (!file.endsWith('.json')) continue

            const id = file.replace('.json', '')
            const prompt = await this.load(id)
            prompts.push(prompt)
        }

        return prompts.sort((a, b) => 
            new Date(b.metadata.generatedAt).getTime() - new Date(a.metadata.generatedAt).getTime()
        )
    }

    async delete(id: string): Promise<void> {
        const filepath = join(this.promptsDir, `${id}.json`)
        await unlink(filepath)
    }

    async exists(id: string): Promise<boolean> {
        const filepath = join(this.promptsDir, `${id}.json`)
        try {
            await readFile(filepath)
            return true
        } catch {
            return false
        }
    }

    private async ensureDir(): Promise<void> {
        await mkdir(this.promptsDir, { recursive: true })
    }

    get directory(): string {
        return this.promptsDir
    }
}

export function createPromptStorage(config: PromptStorageConfig): PromptStorage {
    return new PromptStorage(config)
}
