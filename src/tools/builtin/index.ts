/**
 * Built-in Tools
 * 
 * All P0 tools for Phase 1.
 */

export { readFilesTool } from './read-files'
export { writeFileTool } from './write-file'
export { strReplaceTool } from './str-replace'
export { listDirectoryTool } from './list-directory'
export { runTerminalCommandTool } from './run-terminal-command'
export { setOutputTool } from './set-output'
export { endTurnTool } from './end-turn'

import { readFilesTool } from './read-files'
import { writeFileTool } from './write-file'
import { strReplaceTool } from './str-replace'
import { listDirectoryTool } from './list-directory'
import { runTerminalCommandTool } from './run-terminal-command'
import { setOutputTool } from './set-output'
import { endTurnTool } from './end-turn'
import type { ToolDefinition } from '@/tools'

export const builtinTools: ToolDefinition<any>[] = [
    readFilesTool,
    writeFileTool,
    strReplaceTool,
    listDirectoryTool,
    runTerminalCommandTool,
    setOutputTool,
    endTurnTool,
]

export function createDefaultToolRegistry() {
    const { ToolRegistry } = require('../registry')
    const registry = new ToolRegistry()
    registry.registerAll(builtinTools)
    return registry
}
