/**
 * OpenAI Editor Agent
 * 
 * A test agent using OpenAI's gpt-4o-mini model.
 */

import { createAgent } from '@/core'

export const openaiEditor = createAgent({
    id: 'openai-editor',
    displayName: 'OpenAI Editor',
    model: 'openai/gpt-4o-mini',
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
    .withSystemPrompt(`You are a helpful coding assistant powered by GPT-4o-mini.
You can read, write, and modify files in the project.
Be concise and efficient in your responses.`)
    .build()

export default openaiEditor
