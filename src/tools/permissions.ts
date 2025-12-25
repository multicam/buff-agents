/**
 * Tool Permissions
 * 
 * Enforces permission checks before tool execution.
 */

import type { ToolDefinition, ToolPermissions, ProjectContext } from './types'
import { isAbsolute, resolve, relative } from 'path'

export interface PermissionConfig {
    readonly allowFileSystem?: 'read' | 'write' | 'full' | 'none'
    readonly allowNetwork?: 'local' | 'external' | 'none'
    readonly allowShell?: boolean
    readonly allowEnv?: boolean
    readonly allowedPaths?: readonly string[]
    readonly deniedPaths?: readonly string[]
}

export interface PermissionCheckResult {
    readonly allowed: boolean
    readonly reason?: string
}

export function checkToolPermissions(
    tool: ToolDefinition,
    input: unknown,
    projectContext: ProjectContext,
    config: PermissionConfig
): PermissionCheckResult {
    const toolPerms = tool.permissions ?? {}

    // Check file system permissions
    if (toolPerms.fileSystem) {
        const fsResult = checkFileSystemPermission(
            toolPerms.fileSystem,
            config.allowFileSystem ?? 'full',
            input,
            projectContext,
            config
        )
        if (!fsResult.allowed) {
            return fsResult
        }
    }

    // Check network permissions
    if (toolPerms.network) {
        const netResult = checkNetworkPermission(
            toolPerms.network,
            config.allowNetwork ?? 'none'
        )
        if (!netResult.allowed) {
            return netResult
        }
    }

    // Check shell permissions
    if (toolPerms.shell && !config.allowShell) {
        return {
            allowed: false,
            reason: 'Shell execution not allowed',
        }
    }

    // Check env permissions
    if (toolPerms.env && !config.allowEnv) {
        return {
            allowed: false,
            reason: 'Environment variable access not allowed',
        }
    }

    return { allowed: true }
}

function checkFileSystemPermission(
    required: NonNullable<ToolPermissions['fileSystem']>,
    allowed: NonNullable<PermissionConfig['allowFileSystem']>,
    input: unknown,
    projectContext: ProjectContext,
    config: PermissionConfig
): PermissionCheckResult {
    // Check permission level
    if (allowed === 'none') {
        return {
            allowed: false,
            reason: 'File system access not allowed',
        }
    }

    if (required === 'write' && allowed === 'read') {
        return {
            allowed: false,
            reason: 'Write access not allowed (read-only mode)',
        }
    }

    if (required === 'full' && allowed !== 'full') {
        return {
            allowed: false,
            reason: 'Full file system access not allowed',
        }
    }

    // Check path restrictions
    const paths = extractPaths(input)
    for (const path of paths) {
        const pathResult = checkPathAllowed(path, projectContext, config)
        if (!pathResult.allowed) {
            return pathResult
        }
    }

    return { allowed: true }
}

function checkNetworkPermission(
    required: NonNullable<ToolPermissions['network']>,
    allowed: NonNullable<PermissionConfig['allowNetwork']>
): PermissionCheckResult {
    if (allowed === 'none') {
        return {
            allowed: false,
            reason: 'Network access not allowed',
        }
    }

    if (required === 'external' && allowed === 'local') {
        return {
            allowed: false,
            reason: 'External network access not allowed (local only)',
        }
    }

    return { allowed: true }
}

function checkPathAllowed(
    path: string,
    projectContext: ProjectContext,
    config: PermissionConfig
): PermissionCheckResult {
    const { projectRoot } = projectContext
    const absolutePath = isAbsolute(path) ? path : resolve(projectRoot, path)
    const relativePath = relative(projectRoot, absolutePath)

    // Check if path escapes project root
    if (relativePath.startsWith('..')) {
        return {
            allowed: false,
            reason: `Path escapes project root: ${path}`,
        }
    }

    // Check denied paths
    if (config.deniedPaths) {
        for (const denied of config.deniedPaths) {
            if (matchesPath(relativePath, denied)) {
                return {
                    allowed: false,
                    reason: `Path is denied: ${path}`,
                }
            }
        }
    }

    // Check allowed paths (if specified, only these are allowed)
    if (config.allowedPaths && config.allowedPaths.length > 0) {
        const isAllowed = config.allowedPaths.some(allowed =>
            matchesPath(relativePath, allowed)
        )
        if (!isAllowed) {
            return {
                allowed: false,
                reason: `Path not in allowed list: ${path}`,
            }
        }
    }

    return { allowed: true }
}

function matchesPath(path: string, pattern: string): boolean {
    // Simple glob matching
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3)
        return path.startsWith(prefix)
    }
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -2)
        return path.startsWith(prefix) && !path.slice(prefix.length + 1).includes('/')
    }
    return path === pattern || path.startsWith(pattern + '/')
}

function extractPaths(input: unknown): string[] {
    const paths: string[] = []

    if (typeof input !== 'object' || input === null) {
        return paths
    }

    const obj = input as Record<string, unknown>

    // Common path field names
    const pathFields = ['path', 'paths', 'file', 'files', 'directory', 'dir', 'cwd']

    for (const field of pathFields) {
        const value = obj[field]
        if (typeof value === 'string') {
            paths.push(value)
        } else if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'string') {
                    paths.push(item)
                }
            }
        }
    }

    return paths
}

export const defaultPermissionConfig: PermissionConfig = {
    allowFileSystem: 'full',
    allowNetwork: 'external',
    allowShell: true,
    allowEnv: true,
    deniedPaths: [
        '.git/**',
        'node_modules/**',
        '.env',
        '.env.*',
        '**/*.key',
        '**/*.pem',
    ],
}

export const restrictedPermissionConfig: PermissionConfig = {
    allowFileSystem: 'read',
    allowNetwork: 'none',
    allowShell: false,
    allowEnv: false,
}
