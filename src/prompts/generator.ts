/**
 * Prompt Generator
 * 
 * Uses Anthropic's Claude to generate detailed prompts from simple descriptions.
 * Similar to Anthropic Console's prompt generator feature.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { GeneratedPrompt, GeneratePromptOptions, GenerationMetadata, AvailableTool } from './types'
import { AVAILABLE_TOOLS } from './types'

const META_PROMPT = `You are an expert prompt engineer. Your task is to transform a simple description into a comprehensive, well-structured system prompt for an AI coding assistant.

The generated prompt should:
1. Clearly define the agent's role and expertise
2. Specify capabilities and limitations
3. Include detailed guidelines for behavior
4. Provide output format specifications when appropriate
5. Include safety considerations and edge cases

You must respond with a JSON object (no markdown, just raw JSON) with this exact structure:
{
  "name": "Short agent name (2-4 words, like 'Code Reviewer' or 'API Designer')",
  "description": "One-sentence description of what this agent does",
  "systemPrompt": "The full, detailed system prompt for the agent",
  "suggestedTools": ["array", "of", "tool", "names"],
  "exampleTasks": ["Example task 1", "Example task 2", "Example task 3"]
}

Available tools to suggest (choose only the ones relevant to the agent's purpose):
${AVAILABLE_TOOLS.map(t => `- ${t}`).join('\n')}

Tool descriptions:
- read_files: Read file contents
- write_file: Create or overwrite files
- str_replace: Find and replace text in files
- list_directory: List directory contents
- find_files: Find files matching glob patterns
- grep_search: Search code with ripgrep
- run_terminal_command: Execute shell commands
- web_search: Search the web for information
- spawn_agents: Spawn sub-agents for delegation
- set_output: Return structured output
- end_turn: End the conversation turn

IMPORTANT: The systemPrompt should be comprehensive (at least 200 words) and include:
- Role definition
- Core capabilities
- Step-by-step workflow
- Best practices and guidelines
- Output format specifications
- Error handling guidance`

export interface PromptGeneratorConfig {
    readonly apiKey: string
    readonly baseUrl?: string
}

export class PromptGenerator {
    private client: Anthropic
    private defaultModel = 'claude-sonnet-4-20250514'

    constructor(config: PromptGeneratorConfig) {
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        })
    }

    async generate(options: GeneratePromptOptions): Promise<GeneratedPrompt> {
        const { description, name, model, additionalContext } = options
        const modelToUse = model ?? this.defaultModel

        const userPrompt = this.buildUserPrompt(description, additionalContext)

        const response = await this.client.messages.create({
            model: modelToUse,
            max_tokens: 4096,
            messages: [
                { role: 'user', content: userPrompt },
            ],
            system: META_PROMPT,
        })

        const content = response.content[0]
        if (content.type !== 'text') {
            throw new Error('Unexpected response type from Anthropic')
        }

        const parsed = this.parseResponse(content.text)
        const id = this.generateId(name ?? parsed.name)

        const metadata: GenerationMetadata = {
            generatedAt: new Date().toISOString(),
            model: modelToUse,
            cost: this.calculateCost(response.usage, modelToUse),
            tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        }

        return {
            id,
            name: name ?? parsed.name,
            originalRequest: description,
            systemPrompt: parsed.systemPrompt,
            suggestedTools: this.validateTools(parsed.suggestedTools),
            description: parsed.description,
            exampleTasks: parsed.exampleTasks,
            metadata,
        }
    }

    private buildUserPrompt(description: string, additionalContext?: string): string {
        let prompt = `Create a detailed system prompt for an AI coding assistant with this purpose:

${description}`

        if (additionalContext) {
            prompt += `\n\nAdditional context and requirements:\n${additionalContext}`
        }

        return prompt
    }

    private parseResponse(text: string): {
        name: string
        description: string
        systemPrompt: string
        suggestedTools: string[]
        exampleTasks: string[]
    } {
        // Try to extract JSON from the response
        let jsonText = text.trim()
        
        // Handle markdown code blocks
        const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (jsonMatch) {
            jsonText = jsonMatch[1].trim()
        }

        // Try to find JSON object boundaries if not clean
        const jsonStartIndex = jsonText.indexOf('{')
        const jsonEndIndex = jsonText.lastIndexOf('}')
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
            jsonText = jsonText.slice(jsonStartIndex, jsonEndIndex + 1)
        }

        // Attempt to fix common JSON issues (unescaped newlines in strings)
        jsonText = this.fixJsonString(jsonText)

        let parsed: Record<string, unknown>
        try {
            parsed = JSON.parse(jsonText)
        } catch (parseError) {
            // If parsing fails, try to extract fields manually
            parsed = this.extractFieldsManually(text)
        }

        if (!parsed.name || !parsed.systemPrompt) {
            throw new Error('Invalid response structure from Anthropic: missing name or systemPrompt')
        }

        return {
            name: String(parsed.name),
            description: String(parsed.description ?? ''),
            systemPrompt: String(parsed.systemPrompt),
            suggestedTools: Array.isArray(parsed.suggestedTools) ? parsed.suggestedTools.map(String) : [],
            exampleTasks: Array.isArray(parsed.exampleTasks) ? parsed.exampleTasks.map(String) : [],
        }
    }

    private fixJsonString(jsonText: string): string {
        // Fix unescaped newlines within string values
        // This is a common issue with LLM outputs
        return jsonText
            .replace(/(["']:)\s*"([^"]*?)\n([^"]*?)"/g, (_match, prefix, before, after) => {
                return `${prefix}"${before}\\n${after}"`
            })
    }

    private extractFieldsManually(text: string): Record<string, unknown> {
        // Fallback: try to extract fields using regex
        const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/)
        const descMatch = text.match(/"description"\s*:\s*"([^"]+)"/)
        const promptMatch = text.match(/"systemPrompt"\s*:\s*"([\s\S]*?)"(?=,\s*"(?:suggestedTools|exampleTasks))/)
        const toolsMatch = text.match(/"suggestedTools"\s*:\s*\[([^\]]+)\]/)
        const tasksMatch = text.match(/"exampleTasks"\s*:\s*\[([^\]]+)\]/)

        const parseArray = (match: RegExpMatchArray | null): string[] => {
            if (!match) return []
            return match[1]
                .split(',')
                .map(s => s.trim().replace(/^["']|["']$/g, ''))
                .filter(s => s.length > 0)
        }

        return {
            name: nameMatch?.[1] ?? '',
            description: descMatch?.[1] ?? '',
            systemPrompt: promptMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\t/g, '\t') ?? '',
            suggestedTools: parseArray(toolsMatch),
            exampleTasks: parseArray(tasksMatch),
        }
    }

    private validateTools(tools: string[]): AvailableTool[] {
        return tools.filter((t): t is AvailableTool => 
            AVAILABLE_TOOLS.includes(t as AvailableTool)
        )
    }

    private generateId(name: string): string {
        const slug = name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        const timestamp = Date.now().toString(36)
        return `${slug}-${timestamp}`
    }

    private calculateCost(usage: { input_tokens: number; output_tokens: number }, model: string): number {
        // Pricing as of 2024 (per million tokens)
        const pricing: Record<string, { input: number; output: number }> = {
            'claude-sonnet-4-20250514': { input: 3, output: 15 },
            'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
            'claude-3-opus-20240229': { input: 15, output: 75 },
            'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
        }

        const modelPricing = pricing[model] ?? { input: 3, output: 15 }
        const inputCost = (usage.input_tokens / 1_000_000) * modelPricing.input
        const outputCost = (usage.output_tokens / 1_000_000) * modelPricing.output

        return inputCost + outputCost
    }
}

export function createPromptGenerator(config: PromptGeneratorConfig): PromptGenerator {
    return new PromptGenerator(config)
}
