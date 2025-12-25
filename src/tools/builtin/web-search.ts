/**
 * web_search tool
 * 
 * Search the web using a search API.
 * Requires SERPER_API_KEY or similar search API key.
 */

import { defineTool } from '@/tools'

export interface WebSearchInput {
    query: string
    numResults?: number
}

export const webSearchTool = defineTool<WebSearchInput>({
    name: 'web_search',
    description: 'Search the web for information.',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query',
            },
            numResults: {
                type: 'number',
                description: 'Number of results to return (default: 5)',
            },
        },
        required: ['query'],
    },
    permissions: {
        network: 'external',
    },

    async execute(context) {
        const { input, projectContext, logger } = context
        const { query, numResults = 5 } = input

        const apiKey = projectContext.env?.SERPER_API_KEY

        if (!apiKey) {
            return {
                error: 'SERPER_API_KEY not configured',
                results: [],
            }
        }

        try {
            const response = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: query,
                    num: numResults,
                }),
            })

            if (!response.ok) {
                throw new Error(`Search API error: ${response.status}`)
            }

            const data = await response.json() as {
                organic?: Array<{
                    title: string
                    link: string
                    snippet: string
                }>
            }

            const results = (data.organic ?? []).map(r => ({
                title: r.title,
                url: r.link,
                snippet: r.snippet,
            }))

            logger.debug({ query, count: results.length }, 'Web search complete')

            return {
                results,
                count: results.length,
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            logger.error({ error, query }, 'Web search failed')
            return { error: message, results: [] }
        }
    },
})
