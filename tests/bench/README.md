# buff-agents Benchmark Suite

A comprehensive benchmarking infrastructure for evaluating buff-agents performance.

## Quick Start

```bash
# Run all benchmarks on simple-editor
bun run tests/bench/run.ts

# Run on multiple agents
bun run tests/bench/run.ts --agents simple-editor,openai-editor

# Run specific categories
bun run tests/bench/run.ts --categories file-editing,bug-fixing
```

## Task Categories

| Category | Description | Example Tasks |
|----------|-------------|---------------|
| `file-editing` | Create, modify, refactor files | Add function, create file, update exports |
| `code-search` | Find patterns, analyze code | Find functions, count exports |
| `multi-step` | Complex workflows requiring planning | Add feature, create module |
| `bug-fixing` | Identify and fix intentional bugs | Fix off-by-one, handle edge cases |
| `code-generation` | Generate new code from descriptions | Create interface, write tests |

## Difficulty Levels

- **easy**: Single-step tasks with clear requirements
- **medium**: Multi-step tasks requiring some reasoning
- **hard**: Complex tasks requiring planning and multiple files

## Metrics Tracked

- **Pass Rate**: Percentage of tasks completed successfully
- **Score**: 0-100 score based on validation criteria
- **Cost**: API cost in USD
- **Duration**: Execution time
- **Steps**: Number of agent steps taken
- **Tool Calls**: Breakdown by tool type

## Project Structure

```
tests/bench/
├── run.ts           # Entry point
├── runner.ts        # Core benchmark runner
├── reporter.ts      # Results formatting
├── types.ts         # Type definitions
├── tasks/           # Task definitions
│   ├── file-editing.ts
│   ├── code-search.ts
│   ├── multi-step.ts
│   ├── bug-fixing.ts
│   └── code-generation.ts
├── projects/        # Synthetic test projects
│   ├── calculator/
│   ├── buggy-utils/
│   ├── todo-app/
│   └── api-client/
└── results/         # Output directory
```

## Adding New Tasks

1. Create a task definition in the appropriate `tasks/*.ts` file:

```typescript
export const myTasks: BenchmarkTask[] = [
    {
        id: 'my-task-id',
        name: 'My Task Name',
        description: 'What this task tests',
        category: 'file-editing',
        difficulty: 'medium',
        targetAgents: ['simple-editor'],
        projectDir: 'calculator',
        prompt: 'The prompt to send to the agent...',
        maxSteps: 15,
        timeoutMs: 90000,
        validate: async (ctx) => {
            // Validation logic
            return {
                passed: true,
                score: 100,
                message: 'Task completed successfully',
            }
        },
    },
]
```

2. Export from `tasks/index.ts`

## Adding New Projects

1. Create project directory under `projects/`
2. Add necessary source files
3. Reference in task definitions via `projectDir`

## Results

Results are saved to `tests/bench/results/`:
- `benchmark-<timestamp>.json` - Full JSON results
- `benchmark-<timestamp>.md` - Markdown report
- `latest.json` / `latest.md` - Most recent run

## CI Integration

```yaml
# Example GitHub Action
jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run tests/bench/run.ts --no-save
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

## Environment Variables

Required API keys (depending on agents used):
- `ANTHROPIC_API_KEY` - For simple-editor (Claude)
- `OPENAI_API_KEY` - For openai-editor (GPT-4)
- `XAI_API_KEY` - For xai-editor (Grok)
- `OPENROUTER_API_KEY` - For openrouter-editor
