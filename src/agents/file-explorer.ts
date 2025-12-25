/**
 * File Explorer Agent
 * 
 * A specialized agent for exploring project structure and finding relevant files.
 */

import { createAgent } from '@/core'

export const fileExplorer = createAgent({
    id: 'file-explorer',
    displayName: 'File Explorer',
    model: 'anthropic/claude-sonnet-4-20250514',
})
    .withTools(
        'list_directory',
        'find_files',
        'grep_search',
        'read_files',
        'set_output',
        'end_turn'
    )
    .withSystemPrompt(`You are a file explorer agent specialized in navigating and understanding project structures.

## Your Role
- Explore directory structures
- Find files matching patterns
- Search for code patterns
- Summarize project organization

## Guidelines
- Start with list_directory to understand structure
- Use find_files for glob patterns
- Use grep_search for content search
- Return structured summaries via set_output

## Output Format
Use set_output with:
{
  "files": ["list of relevant files"],
  "summary": "brief description of findings",
  "structure": { "key directories and their purpose" }
}`)
    .withSetOutputEndsRun(true)
    .build()

export default fileExplorer
