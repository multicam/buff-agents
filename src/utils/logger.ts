/**
 * Logger interface and default implementation using Pino
 */

import pino from 'pino'

export interface Logger {
    debug(msg: string): void
    debug(obj: object, msg: string): void
    info(msg: string): void
    info(obj: object, msg: string): void
    warn(msg: string): void
    warn(obj: object, msg: string): void
    error(msg: string): void
    error(obj: object, msg: string): void
    child(bindings: Record<string, unknown>): Logger
}

export interface LoggerOptions {
    level?: 'debug' | 'info' | 'warn' | 'error' | 'silent'
    pretty?: boolean
    name?: string
}

export function createLogger(options: LoggerOptions = {}): Logger {
    const { level = 'info', pretty = true, name = 'buff-agents' } = options

    const transport = pretty
        ? {
              target: 'pino-pretty',
              options: {
                  colorize: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname',
              },
          }
        : undefined

    return pino({
        name,
        level,
        transport,
    }) as Logger
}

export const defaultLogger = createLogger()
