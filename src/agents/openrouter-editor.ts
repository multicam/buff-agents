/**
 * OpenRouter Editor Agent
 * 
 * A test agent using OpenRouter as a fallback provider.
 * Can use any model available on OpenRouter.
 */

import { createAgent } from '@/core'
import { createEditorPrompt, EDITOR_TOOLS } from './shared-prompts'

export const openrouterEditor = createAgent({
    id: 'openrouter-editor',
    displayName: 'OpenRouter Editor',
    model: 'openrouter/google/gemini-2.0-flash-001',
})
    .withTools(...EDITOR_TOOLS)
    .withSystemPrompt(createEditorPrompt('Gemini via OpenRouter'))
    .build()

export default openrouterEditor
