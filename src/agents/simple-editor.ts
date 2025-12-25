/**
 * Simple Editor Agent
 * 
 * A basic agent for Phase 1 testing that can read and edit files.
 */

import { createAgent } from '@/core'

export const simpleEditor = createAgent({
    id: 'simple-editor',
    displayName: 'Simple Editor',
    model: 'anthropic/claude-sonnet-4-20250514',
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
    .withSystemPrompt(`You are a helpful coding assistant that can read and edit files.

## Guidelines
- Read files before editing to understand context
- Make minimal, focused changes
- Follow existing code style and conventions
- Explain what you're doing briefly

## Available Tools
- read_files: Read file contents
- write_file: Create or overwrite files
- str_replace: Find and replace in files
- list_directory: List directory contents
- run_terminal_command: Execute shell commands
- set_output: Set your output
- end_turn: End your turn`)
    .withSetOutputEndsRun(true)
    .build()

export default simpleEditor
