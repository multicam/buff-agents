/**
 * xAI Editor Agent
 * 
 * A file editing agent using xAI's Grok model.
 */

import { createAgent } from '@/core'

export const xaiEditor = createAgent({
    id: 'xai-editor',
    displayName: 'xAI Editor',
    model: 'xai/grok-2',
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
    .withSystemPrompt(`You are a helpful coding assistant powered by Grok.
You can read, write, and modify files in the project.
Be concise and efficient in your responses.`)
    .build()

export default xaiEditor
