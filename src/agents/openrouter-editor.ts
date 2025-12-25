/**
 * OpenRouter Editor Agent
 * 
 * A test agent using OpenRouter as a fallback provider.
 * Can use any model available on OpenRouter.
 */

import { createAgent } from '@/core'

export const openrouterEditor = createAgent({
    id: 'openrouter-editor',
    displayName: 'OpenRouter Editor',
    model: 'openrouter/google/gemini-2.0-flash-001',
})
    .withTools(
        'read_files',
        'write_file',
        'str_replace',
        'list_directory',
        'run_terminal_command',
        'set_output',
        'end_turn'
    )
    .withSystemPrompt(`You are a helpful coding assistant powered by OpenRouter.
You can read, write, and modify files in the project.
Be concise and efficient in your responses.`)
    .build()

export default openrouterEditor
