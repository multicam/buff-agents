/**
 * OpenAI Editor Agent
 * 
 * A test agent using OpenAI's gpt-4o-mini model.
 */

import { createAgent } from '@/core'
import { createEditorPrompt, EDITOR_TOOLS } from './shared-prompts'

export const openaiEditor = createAgent({
    id: 'openai-editor',
    displayName: 'OpenAI Editor',
    model: 'openai/gpt-4o-mini',
})
    .withTools(...EDITOR_TOOLS)
    .withSystemPrompt(createEditorPrompt('GPT-4o-mini'))
    .build()

export default openaiEditor
