/**
 * xAI Editor Agent
 * 
 * A file editing agent using xAI's Grok model.
 */

import { createAgent } from '@/core'
import { createEditorPrompt, EDITOR_TOOLS } from './shared-prompts'

export const xaiEditor = createAgent({
    id: 'xai-editor',
    displayName: 'xAI Editor',
    model: 'xai/grok-2',
})
    .withTools(...EDITOR_TOOLS)
    .withSystemPrompt(createEditorPrompt('Grok'))
    .build()

export default xaiEditor
