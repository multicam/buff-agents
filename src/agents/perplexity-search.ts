/**
 * Perplexity Search Agent
 * 
 * A web search assistant using Perplexity's Sonar model.
 * Optimized for real-time information retrieval and research.
 */

import { createAgent } from '@/core'

export const perplexitySearch = createAgent({
    id: 'perplexity-search',
    displayName: 'Perplexity Search',
    model: 'perplexity/sonar',
})
    .withTools(
        'read_files',
        'write_file',
        'list_directory',
        'set_output',
        'end_turn'
    )
    .withSystemPrompt(`You are a research assistant powered by Perplexity Sonar.
Your strength is providing up-to-date information and answering questions with current knowledge.

## Capabilities
- Answer questions with real-time information
- Research topics and provide summaries
- Write findings to files when requested

## Guidelines
- Provide accurate, well-sourced information
- Be clear about what you know vs. don't know
- Cite sources when possible
- Be concise but thorough`)
    .build()

export default perplexitySearch
