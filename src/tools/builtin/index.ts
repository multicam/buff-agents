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
export { findFilesTool } from './find-files'
export { grepSearchTool } from './grep-search'
export { webSearchTool } from './web-search'
export { spawnAgentsTool } from './spawn-agents'

import { readFilesTool } from './read-files'
import { writeFileTool } from './write-file'
import { strReplaceTool } from './str-replace'
import { listDirectoryTool } from './list-directory'
import { runTerminalCommandTool } from './run-terminal-command'
import { setOutputTool } from './set-output'
import { endTurnTool } from './end-turn'
import { findFilesTool } from './find-files'
import { grepSearchTool } from './grep-search'
import { webSearchTool } from './web-search'
import { spawnAgentsTool } from './spawn-agents'
import type { ToolDefinition } from '@/tools'

export const builtinTools: ToolDefinition<any>[] = [
    readFilesTool,
    writeFileTool,
    strReplaceTool,
    listDirectoryTool,
    runTerminalCommandTool,
    setOutputTool,
    endTurnTool,
    findFilesTool,
    grepSearchTool,
    webSearchTool,
    spawnAgentsTool,
]

export function createDefaultToolRegistry() {
    const { ToolRegistry } = require('../registry')
    const registry = new ToolRegistry()
    registry.registerAll(builtinTools)
    return registry
}
