# buff-agents

Autonomous coding agent library with base2-style orchestration.

## Features

- **Multi-provider LLM support** - Anthropic, OpenAI, xAI (Grok), Perplexity, Google (via OpenRouter)
- **Tool system** - Schema-first tool definitions with JSON Schema validation
- **Agent orchestration** - Spawn sub-agents for complex tasks
- **Programmatic control** - `handleSteps` generator for custom workflows
- **MCP integration** - Use agents from Cascade/Claude Code
- **Cost tracking** - Monitor and limit LLM spending
- **Bun-first** - Optimized for Bun runtime

## Installation

```bash
bun add buff-agents
```

## Quick Start

```typescript
import { createAgent, createAgentRuntime, createLLMRegistry, builtinTools, ToolRegistry } from 'buff-agents'

const agent = createAgent({
    id: 'my-agent',
    displayName: 'My Agent',
    model: 'anthropic/claude-sonnet-4-20250514',
})
    .withTools('read_files', 'write_file', 'list_directory')
    .build()

const llmRegistry = await createLLMRegistry({
    anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
})

const toolRegistry = new ToolRegistry()
toolRegistry.registerAll(builtinTools)

const runtime = createAgentRuntime({
    llmRegistry,
    toolRegistry,
    projectContext: { projectRoot: process.cwd(), cwd: process.cwd() },
})

const result = await runtime.run({
    agent,
    prompt: 'List the files in the current directory',
})
```

## CLI Usage

```bash
# Run an agent
buff-agents run simple-editor "Create a hello.txt file"

# List available agents
buff-agents list

# Available agents:
#   simple-editor     - Basic file editing (Anthropic)
#   openai-editor     - Basic file editing (OpenAI)
#   openrouter-editor - Basic file editing (OpenRouter/Gemini)
#   xai-editor        - Basic file editing (xAI/Grok)
#   perplexity-search - Web search assistant (Perplexity)
#   orchestrator      - Complex task orchestration
#   file-explorer     - Project structure exploration
#   code-reviewer     - Code quality review
```

## Configuration

Create `.buff-agents.json` in your project root:

```json
{
  "providers": {
    "anthropic": { "apiKey": "sk-ant-..." },
    "openai": { "apiKey": "sk-..." },
    "xai": { "apiKey": "xai-..." },
    "perplexity": { "apiKey": "pplx-..." },
    "openrouter": { "apiKey": "sk-or-..." }
  },
  "defaultModel": "anthropic/claude-sonnet-4-20250514",
  "maxSteps": 50
}
```

## MCP Integration (Cascade/Claude Code)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "buff-agents": {
      "command": "bun",
      "args": ["run", "~/src/buff-agents/src/mcp/cli.ts"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "XAI_API_KEY": "${XAI_API_KEY}",
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}",
        "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}"
      }
    }
  }
}
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `read_files` | Read multiple files |
| `write_file` | Create or overwrite files |
| `str_replace` | Find and replace in files |
| `list_directory` | List directory contents |
| `run_terminal_command` | Execute CLI commands |
| `find_files` | Find files with glob patterns |
| `grep_search` | Search code with ripgrep |
| `web_search` | Search the web |
| `spawn_agents` | Spawn sub-agents |

## Documentation

- [Architecture](./docs/architecture/FINAL-ARCHITECTURE.md)
- [Design Decisions](./docs/architecture/DESIGN-DECISIONS.md)

## License

MIT
