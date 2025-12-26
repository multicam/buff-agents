/**
 * Simple Editor Agent
 * 
 * A basic agent for Phase 1 testing that can read and edit files.
 */

import { createAgent } from '@/core'
import { createEditorPrompt, EDITOR_TOOLS } from './shared-prompts'

export const simpleEditor = createAgent({
    id: 'simple-editor',
    displayName: 'Simple Editor',
    model: 'anthropic/claude-sonnet-4-20250514',
})
    .withTools(...EDITOR_TOOLS)
    .withSystemPrompt(createEditorPrompt(''))
    .withSetOutputEndsRun(true)
    .build()

export default simpleEditor
