# buff-agents

Autonomous coding agent library with base2-style orchestration.

## Features

- **Full LLM Control** - Direct API calls to Anthropic, OpenAI, Google, OpenRouter
- **Base2 Orchestration** - Layers pattern with parallel sub-agent spawning
- **MCP Integration** - Works with Cascade (JetBrains) and Claude Code
- **Bun-First** - Optimized for Bun, compatible with Node.js

## Installation

```bash
bun add buff-agents
# or
npm install buff-agents
```

## Quick Start

```typescript
import { createRuntime, createBase2 } from 'buff-agents'

const runtime = await createRuntime({
    providers: {
        anthropic: { apiKey: process.env.ANTHROPIC_API_KEY }
    }
})

const result = await runtime.run({
    agent: createBase2('default'),
    prompt: 'Add user authentication to the Express app'
})

console.log(result.output)
```

## CLI Usage

```bash
# Run an agent
buff-agents run base2 "Add user authentication"

# Start MCP server (for Cascade/Claude Code)
buff-agents serve

# List available agents
buff-agents list-agents
```

## Configuration

Create `.buff-agents.json` in your project root:

```json
{
    "providers": {
        "anthropic": { "apiKey": "${ANTHROPIC_API_KEY}" }
    },
    "defaultModel": "anthropic/claude-sonnet-4",
    "agentsDir": "./.agents",
    "maxSteps": 50
}
```

## Documentation

- [Architecture](./docs/architecture/FINAL-ARCHITECTURE.md)
- [Design Decisions](./docs/architecture/DESIGN-DECISIONS.md)

## License

MIT
