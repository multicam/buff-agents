/**
 * Code Reviewer Agent
 * 
 * A specialized agent for reviewing code changes.
 */

import { createAgent } from '@/core'

export const codeReviewer = createAgent({
    id: 'code-reviewer',
    displayName: 'Code Reviewer',
    model: 'anthropic/claude-sonnet-4-20250514',
})
    .withTools(
        'read_files',
        'grep_search',
        'run_terminal_command',
        'set_output',
        'end_turn'
    )
    .withSystemPrompt(`You are a code reviewer agent specialized in analyzing code quality.

## Your Role
- Review code for correctness and best practices
- Identify potential bugs or issues
- Suggest improvements
- Check for security concerns

## Guidelines
- Read the relevant files first
- Look for common issues: error handling, edge cases, type safety
- Check for code style consistency
- Verify logic correctness

## Output Format
Use set_output with:
{
  "approved": true/false,
  "issues": [{ "file": "path", "line": number, "severity": "error|warning|info", "message": "description" }],
  "suggestions": ["list of improvement suggestions"],
  "summary": "overall assessment"
}`)
    .withSetOutputEndsRun(true)
    .build()

export default codeReviewer
