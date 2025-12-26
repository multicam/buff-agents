# Project knowledge

Autonomous coding agent library with multi-provider LLM support and MCP integration.

## Quickstart
- Setup: `bun install`
- Dev: `bun run dev` (watches src/cli/index.ts)
- Test: `bun test` (or `bun test --watch`)
- Typecheck: `bun run lint` (runs `tsc --noEmit`)
- Build: `bun run build`

## Architecture
- `src/agents/` - Pre-built agent definitions (simple-editor, orchestrator, code-reviewer, etc.)
- `src/cli/` - CLI entry point (`buff-agents run <agent> <prompt>`)
- `src/config/` - Configuration loading (.buff-agents.json)
- `src/core/` - Agent builder and core types
- `src/llm/` - LLM provider implementations (Anthropic, OpenAI, xAI, Perplexity, OpenRouter)
- `src/mcp/` - Model Context Protocol server for Cascade/Claude Code integration
- `src/runtime/` - Agent execution engine, conversation management, cost tracking
- `src/tools/` - Tool system with built-in tools (read_files, write_file, spawn_agents, etc.)
- `src/utils/` - Logger (pino)

## Key Patterns
- Schema-first tools with JSON Schema validation
- Agent builder pattern: `createAgent({...}).withTools(...).build()`
- `handleSteps` generator for programmatic control flow
- Sub-agent spawning for complex orchestration

## Conventions
- Bun runtime (not Node)
- TypeScript strict mode enabled
- ESM modules only (`"type": "module"`)
- Path alias: `@/*` maps to `./src/*`

## Gotchas
- Requires API keys via env vars or `.buff-agents.json`
- Tests in `tests/unit/` (excluded from tsconfig)
- MCP integration uses `src/mcp/cli.ts` as entry point
