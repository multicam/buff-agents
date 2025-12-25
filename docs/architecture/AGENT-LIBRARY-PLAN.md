# Buff-Agents: Custom Agent Library Architecture Plan

**Date**: 2025-12-26  
**Author**: Claude (Qara) + Jean-Marc  
**Status**: Draft - Awaiting Feedback

---

## 1. Project Vision

Build a **full agent runtime from scratch** (not a wrapper) that replicates the base2 "layers" orchestration pattern from codebuff, with:

- **Full LLM API control** - Direct calls to Anthropic, OpenAI, Google, etc.
- **Custom tool execution framework** - Your own tool abstraction
- **Multi-provider support** - Pluggable LLM backends
- **Bun-first runtime** - Optimized for Bun, compatible with Node.js
- **Learning-oriented design** - Clear, well-documented code for understanding agent internals

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         buff-agents Library                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   Agent Runtime  │  │   Tool Registry  │  │  LLM Providers   │       │
│  │                  │  │                  │  │                  │       │
│  │  - Step loop     │  │  - Tool defs     │  │  - Anthropic     │       │
│  │  - Message mgmt  │  │  - Execution     │  │  - OpenAI        │       │
│  │  - State machine │  │  - Validation    │  │  - Google        │       │
│  │  - Sub-agents    │  │  - Results       │  │  - OpenRouter    │       │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘       │
│           │                     │                     │                  │
│           └─────────────────────┼─────────────────────┘                  │
│                                 │                                        │
│                    ┌────────────▼────────────┐                           │
│                    │      Agent Core         │                           │
│                    │                         │                           │
│                    │  - AgentDefinition      │                           │
│                    │  - AgentState           │                           │
│                    │  - Message types        │                           │
│                    │  - Event emitter        │                           │
│                    └─────────────────────────┘                           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Abstractions

### 3.1 Agent Definition

The blueprint for an agent - what it can do, how it behaves.

```typescript
// src/core/types/agent-definition.ts

export interface AgentDefinition {
    /** Unique identifier */
    id: string
    
    /** Human-readable name */
    displayName: string
    
    /** LLM model to use (provider/model format) */
    model: ModelIdentifier
    
    /** Tools this agent can use */
    tools: ToolName[]
    
    /** Other agents this agent can spawn */
    spawnableAgents?: string[]
    
    /** System prompt - background context */
    systemPrompt?: string
    
    /** Instructions prompt - inserted after user input */
    instructionsPrompt?: string
    
    /** Step prompt - inserted at each agent step */
    stepPrompt?: string
    
    /** Whether to include parent conversation history */
    includeMessageHistory?: boolean
    
    /** Programmatic step handler (generator function) */
    handleSteps?: AgentStepHandler
    
    /** Input schema for spawning */
    inputSchema?: {
        prompt?: { type: 'string'; description?: string }
        params?: JsonSchema
    }
    
    /** Output mode */
    outputMode?: 'last_message' | 'all_messages' | 'structured_output'
    
    /** Output schema for structured output */
    outputSchema?: JsonSchema
}

export type ModelIdentifier = 
    | `anthropic/${string}`
    | `openai/${string}`
    | `google/${string}`
    | `openrouter/${string}`
    | (string & {})
```

### 3.2 Agent State

Runtime state of an executing agent.

```typescript
// src/core/types/agent-state.ts

export interface AgentState {
    /** Unique run ID */
    runId: string
    
    /** Agent definition ID */
    agentId: string
    
    /** Parent agent ID (if spawned) */
    parentId?: string
    
    /** Ancestor run IDs for tracing */
    ancestorRunIds: string[]
    
    /** Child run IDs (spawned agents) */
    childRunIds: string[]
    
    /** Conversation history */
    messageHistory: Message[]
    
    /** System prompt (resolved) */
    systemPrompt: string
    
    /** Available tool definitions */
    toolDefinitions: Record<string, ToolDefinition>
    
    /** Agent output (set via set_output tool) */
    output?: Record<string, unknown>
    
    /** Steps remaining before forced stop */
    stepsRemaining: number
    
    /** Credits/cost tracking */
    creditsUsed: number
    
    /** Shared context between steps */
    context: Record<string, unknown>
}
```

### 3.3 Message Types

```typescript
// src/core/types/messages.ts

export type Message = 
    | SystemMessage
    | UserMessage
    | AssistantMessage
    | ToolMessage

export interface SystemMessage {
    role: 'system'
    content: string
}

export interface UserMessage {
    role: 'user'
    content: string | ContentPart[]
    tags?: string[]
}

export interface AssistantMessage {
    role: 'assistant'
    content: string
    toolCalls?: ToolCall[]
}

export interface ToolMessage {
    role: 'tool'
    toolName: string
    toolCallId: string
    content: ToolResultContent
}

export type ContentPart = 
    | { type: 'text'; text: string }
    | { type: 'image'; url: string; mimeType?: string }

export interface ToolCall {
    toolCallId: string
    toolName: string
    input: Record<string, unknown>
}

export type ToolResultContent = 
    | string
    | { type: 'text'; text: string }
    | { type: 'json'; data: unknown }
    | { type: 'error'; message: string }
```

---

## 4. Tool System Design

### 4.1 Design Philosophy: Codebuff-Compatible vs Custom

**Option A: Codebuff-Compatible Interface**
- Reuse codebuff tool definitions (same parameter schemas)
- Easier to port agents between systems
- Constrained by codebuff's design decisions

**Option B: Custom Tool Abstraction**
- Design from first principles
- More flexibility for your use cases
- Cleaner separation of concerns
- Better TypeScript ergonomics

**Recommendation**: Start with **Option A** for core tools (file operations, terminal, search), but design the abstraction layer to support **Option B** for custom tools. This gives you:
- Familiarity with proven patterns
- Ability to extend/customize later
- Learning by implementing known designs

### 4.2 Tool Definition Interface

```typescript
// src/tools/types.ts

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
    /** Tool name (unique identifier) */
    name: string
    
    /** Description for LLM */
    description: string
    
    /** JSON Schema for input validation */
    inputSchema: JsonSchema
    
    /** Whether this tool ends the agent's turn */
    endsAgentStep?: boolean
    
    /** Tool handler function */
    execute: ToolHandler<TInput, TOutput>
}

export type ToolHandler<TInput, TOutput> = (
    context: ToolExecutionContext<TInput>
) => Promise<ToolResult<TOutput>>

export interface ToolExecutionContext<TInput> {
    /** Validated input parameters */
    input: TInput
    
    /** Tool call ID for correlation */
    toolCallId: string
    
    /** Current agent state (read-only) */
    agentState: Readonly<AgentState>
    
    /** Project/workspace context */
    projectContext: ProjectContext
    
    /** Logger instance */
    logger: Logger
    
    /** Abort signal for cancellation */
    signal: AbortSignal
    
    /** Emit events during execution */
    emit: (event: ToolEvent) => void
}

export interface ToolResult<TOutput> {
    /** Result data */
    output: TOutput
    
    /** Optional credits/cost used */
    creditsUsed?: number
    
    /** Side effects performed */
    sideEffects?: SideEffect[]
}

export type ToolEvent = 
    | { type: 'progress'; message: string; percent?: number }
    | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
    | { type: 'file_changed'; path: string; action: 'created' | 'modified' | 'deleted' }
```

### 4.3 Tool Registry

```typescript
// src/tools/registry.ts

export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map()
    
    register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void
    
    get(name: string): ToolDefinition | undefined
    
    has(name: string): boolean
    
    list(): ToolDefinition[]
    
    /** Get tools available to a specific agent */
    getForAgent(toolNames: string[]): Record<string, ToolDefinition>
    
    /** Convert to LLM-compatible format */
    toLLMTools(toolNames: string[]): LLMToolDefinition[]
}
```

### 4.4 Core Tools to Implement

**Phase 1 - Essential:**
| Tool | Description | Priority |
|------|-------------|----------|
| `read_files` | Read file contents | P0 |
| `write_file` | Create/overwrite file | P0 |
| `str_replace` | Find/replace in file | P0 |
| `list_directory` | List directory contents | P0 |
| `run_terminal_command` | Execute shell commands | P0 |
| `set_output` | Set agent output | P0 |
| `spawn_agents` | Spawn sub-agents | P1 |

**Phase 2 - Context Gathering:**
| Tool | Description | Priority |
|------|-------------|----------|
| `code_search` | Ripgrep-based search | P1 |
| `find_files` | Fuzzy file finder | P1 |
| `glob` | Glob pattern matching | P2 |
| `read_subtree` | Read directory tree | P2 |

**Phase 3 - Extended:**
| Tool | Description | Priority |
|------|-------------|----------|
| `web_search` | Web search API | P2 |
| `read_docs` | Documentation lookup | P2 |
| `ask_user` | Interactive prompts | P2 |

---

## 5. LLM Provider Abstraction

### 5.1 Provider Interface

```typescript
// src/llm/types.ts

export interface LLMProvider {
    /** Provider identifier */
    readonly name: string
    
    /** Supported model patterns */
    readonly modelPatterns: RegExp[]
    
    /** Check if provider supports a model */
    supportsModel(model: string): boolean
    
    /** Generate a completion */
    complete(request: CompletionRequest): Promise<CompletionResponse>
    
    /** Stream a completion */
    stream(request: CompletionRequest): AsyncIterable<StreamChunk>
}

export interface CompletionRequest {
    model: string
    messages: Message[]
    tools?: LLMToolDefinition[]
    temperature?: number
    maxTokens?: number
    stopSequences?: string[]
    signal?: AbortSignal
}

export interface CompletionResponse {
    content: string
    toolCalls?: ToolCall[]
    usage: TokenUsage
    finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
    cost?: number
}

export interface StreamChunk {
    type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'done'
    content?: string
    toolCall?: Partial<ToolCall>
    usage?: TokenUsage
}

export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}
```

### 5.2 Provider Implementations

```typescript
// src/llm/providers/anthropic.ts
export class AnthropicProvider implements LLMProvider {
    constructor(config: { apiKey: string; baseUrl?: string })
    // Implementation using @anthropic-ai/sdk
}

// src/llm/providers/openai.ts
export class OpenAIProvider implements LLMProvider {
    constructor(config: { apiKey: string; baseUrl?: string })
    // Implementation using openai SDK
}

// src/llm/providers/google.ts
export class GoogleProvider implements LLMProvider {
    constructor(config: { apiKey: string })
    // Implementation using @google/generative-ai
}

// src/llm/providers/openrouter.ts
export class OpenRouterProvider implements LLMProvider {
    constructor(config: { apiKey: string })
    // Routes to any model via OpenRouter API
}
```

### 5.3 Provider Registry

```typescript
// src/llm/registry.ts

export class LLMRegistry {
    private providers: Map<string, LLMProvider> = new Map()
    
    register(provider: LLMProvider): void
    
    /** Get provider for a model identifier */
    getProvider(model: ModelIdentifier): LLMProvider
    
    /** Parse model identifier into provider + model */
    parseModel(model: ModelIdentifier): { provider: string; model: string }
}

// Usage:
const registry = new LLMRegistry()
registry.register(new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }))
registry.register(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }))

const provider = registry.getProvider('anthropic/claude-sonnet-4')
```

---

## 6. Agent Runtime

### 6.1 Runtime Core

```typescript
// src/runtime/agent-runtime.ts

export class AgentRuntime {
    constructor(config: AgentRuntimeConfig)
    
    /** Run an agent to completion */
    async run(params: RunParams): Promise<RunResult>
    
    /** Run a single agent step */
    async step(state: AgentState): Promise<StepResult>
    
    /** Spawn a sub-agent */
    async spawn(params: SpawnParams): Promise<RunResult>
}

export interface AgentRuntimeConfig {
    /** LLM provider registry */
    llmRegistry: LLMRegistry
    
    /** Tool registry */
    toolRegistry: ToolRegistry
    
    /** Agent definitions */
    agents: Record<string, AgentDefinition>
    
    /** Project context */
    projectContext: ProjectContext
    
    /** Logger */
    logger: Logger
    
    /** Event handler */
    onEvent?: (event: RuntimeEvent) => void
    
    /** Max steps per agent run */
    maxSteps?: number
}

export interface RunParams {
    /** Agent to run */
    agent: string | AgentDefinition
    
    /** User prompt */
    prompt: string
    
    /** Additional parameters */
    params?: Record<string, unknown>
    
    /** Previous run state (for continuation) */
    previousRun?: AgentState
    
    /** Abort signal */
    signal?: AbortSignal
}

export interface RunResult {
    /** Final agent state */
    state: AgentState
    
    /** Agent output */
    output: AgentOutput
    
    /** Total cost */
    totalCost: number
}
```

### 6.2 Step Loop (The Core Algorithm)

This is the heart of the agent - the step loop that:
1. Builds the prompt
2. Calls the LLM
3. Parses tool calls
4. Executes tools
5. Decides whether to continue

```typescript
// src/runtime/step-loop.ts

export async function runStepLoop(
    runtime: AgentRuntime,
    state: AgentState,
    definition: AgentDefinition,
    signal: AbortSignal
): Promise<RunResult> {
    
    let currentState = state
    let shouldContinue = true
    
    while (shouldContinue && !signal.aborted) {
        // Check step limit
        if (currentState.stepsRemaining <= 0) {
            break
        }
        
        // 1. Run programmatic step if defined
        if (definition.handleSteps) {
            const programmaticResult = await runProgrammaticStep(
                runtime,
                currentState,
                definition
            )
            currentState = programmaticResult.state
            if (programmaticResult.endTurn) {
                break
            }
        }
        
        // 2. Build messages for LLM
        const messages = buildMessages(currentState, definition)
        
        // 3. Call LLM
        const provider = runtime.llmRegistry.getProvider(definition.model)
        const tools = runtime.toolRegistry.toLLMTools(definition.tools)
        
        const response = await provider.complete({
            model: definition.model,
            messages,
            tools,
            signal
        })
        
        // 4. Update state with assistant message
        currentState = addAssistantMessage(currentState, response)
        
        // 5. Process tool calls
        if (response.toolCalls?.length) {
            for (const toolCall of response.toolCalls) {
                const result = await executeToolCall(
                    runtime,
                    currentState,
                    toolCall
                )
                currentState = addToolResult(currentState, toolCall, result)
                
                // Check for turn-ending tools
                if (isEndTurnTool(toolCall.toolName)) {
                    shouldContinue = false
                    break
                }
            }
        } else {
            // No tool calls = end of turn
            shouldContinue = false
        }
        
        // 6. Decrement step counter
        currentState = {
            ...currentState,
            stepsRemaining: currentState.stepsRemaining - 1
        }
    }
    
    return {
        state: currentState,
        output: getAgentOutput(currentState, definition),
        totalCost: currentState.creditsUsed
    }
}
```

### 6.3 Programmatic Steps (Generator Pattern)

Replicating codebuff's `handleSteps` generator pattern:

```typescript
// src/runtime/programmatic-step.ts

export type AgentStepHandler = (
    context: AgentStepContext
) => Generator<StepYield, void, StepYieldResult>

export interface AgentStepContext {
    agentState: AgentState
    prompt?: string
    params?: Record<string, unknown>
    logger: Logger
}

export type StepYield = 
    | ToolCallYield
    | 'STEP'        // Run one LLM step
    | 'STEP_ALL'    // Run until turn ends

export interface ToolCallYield {
    toolName: string
    input: Record<string, unknown>
    includeToolCall?: boolean
}

export interface StepYieldResult {
    agentState: AgentState
    toolResult?: unknown
    stepsComplete: boolean
}
```

---

## 7. Project Structure

```
buff-agents/
├── src/
│   ├── core/
│   │   ├── types/
│   │   │   ├── agent-definition.ts
│   │   │   ├── agent-state.ts
│   │   │   ├── messages.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── builtin/
│   │   │   ├── read-files.ts
│   │   │   ├── write-file.ts
│   │   │   ├── str-replace.ts
│   │   │   ├── list-directory.ts
│   │   │   ├── run-terminal-command.ts
│   │   │   ├── code-search.ts
│   │   │   ├── spawn-agents.ts
│   │   │   ├── set-output.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── llm/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── providers/
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   ├── google.ts
│   │   │   ├── openrouter.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── runtime/
│   │   ├── agent-runtime.ts
│   │   ├── step-loop.ts
│   │   ├── programmatic-step.ts
│   │   ├── message-builder.ts
│   │   └── index.ts
│   │
│   ├── agents/
│   │   ├── base2/
│   │   │   ├── base2.ts
│   │   │   ├── base2-lite.ts
│   │   │   ├── base2-max.ts
│   │   │   └── base2-fast.ts
│   │   ├── editor/
│   │   │   └── editor.ts
│   │   ├── thinker/
│   │   │   └── thinker.ts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── tokens.ts
│   │   ├── json-schema.ts
│   │   └── index.ts
│   │
│   └── index.ts
│
├── tests/
│   ├── unit/
│   │   ├── tools/
│   │   ├── llm/
│   │   └── runtime/
│   ├── integration/
│   └── e2e/
│
├── examples/
│   ├── simple-task.ts
│   ├── multi-agent.ts
│   └── custom-tools.ts
│
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Minimal working agent that can execute a single tool

- [ ] Project setup (Bun, TypeScript, testing)
- [ ] Core types (AgentDefinition, AgentState, Messages)
- [ ] Tool abstraction (ToolDefinition, ToolRegistry)
- [ ] Implement `read_files` tool
- [ ] Implement `write_file` tool
- [ ] Single LLM provider (Anthropic)
- [ ] Basic step loop (no sub-agents)
- [ ] Simple CLI for testing

**Milestone**: Run a prompt that reads a file and writes a modified version

### Phase 2: Tool Execution Framework (Week 3-4)
**Goal**: Complete tool system with validation and error handling

- [ ] Implement remaining P0 tools
- [ ] Tool input validation (Zod schemas)
- [ ] Tool error handling and retries
- [ ] Tool event emission
- [ ] Streaming tool results
- [ ] `code_search` tool (ripgrep integration)

**Milestone**: Agent can navigate codebase and make edits

### Phase 3: Multi-Provider LLM (Week 5-6)
**Goal**: Support multiple LLM providers

- [ ] LLM provider interface
- [ ] OpenAI provider
- [ ] Google provider
- [ ] OpenRouter provider (for any model)
- [ ] Provider selection logic
- [ ] Cost tracking per provider
- [ ] Streaming support for all providers

**Milestone**: Same agent definition works with Claude, GPT, Gemini

### Phase 4: Sub-Agent Orchestration (Week 7-8)
**Goal**: Implement the "layers" pattern

- [ ] `spawn_agents` tool
- [ ] Agent registry
- [ ] Parent-child state management
- [ ] Parallel agent execution
- [ ] Result aggregation
- [ ] Context inheritance

**Milestone**: Base2-style orchestrator spawning specialized agents

### Phase 5: Programmatic Steps (Week 9-10)
**Goal**: Generator-based step control

- [ ] `handleSteps` generator support
- [ ] STEP and STEP_ALL yields
- [ ] Tool call yields
- [ ] State passing between yields
- [ ] Context pruning hooks

**Milestone**: Full base2 agent replication

### Phase 6: Polish & Documentation (Week 11-12)
**Goal**: Production-ready library

- [ ] Comprehensive test suite
- [ ] API documentation
- [ ] Usage examples
- [ ] Performance optimization
- [ ] Error messages and debugging
- [ ] npm package publishing

---

## 9. Open Questions for You

### Q1: Tool Execution Model
When a tool like `run_terminal_command` executes, should it:
- **A)** Block until complete (simpler, current codebuff model)
- **B)** Support background execution with status polling
- **C)** Both, configurable per-tool

### Q2: State Persistence
Do you want agent state to be:
- **A)** In-memory only (simpler, stateless between runs)
- **B)** Persistable to disk/database (for long-running tasks, resumption)
- **C)** Pluggable storage backend

### Q3: Event System
For observability, prefer:
- **A)** Callback-based (`onEvent: (event) => void`)
- **B)** EventEmitter pattern
- **C)** AsyncIterable/Stream
- **D)** All of the above with adapters

### Q4: Configuration
How should API keys and config be provided:
- **A)** Environment variables only
- **B)** Explicit config object
- **C)** Config file (e.g., `.buff-agents.json`)
- **D)** All of the above with precedence

### Q5: Testing Strategy
For integration tests that call real LLMs:
- **A)** Mock all LLM calls (fast, deterministic, but less realistic)
- **B)** Record/replay (VCR pattern - record once, replay in CI)
- **C)** Real API calls with small test budget
- **D)** Combination based on test type

### Q6: First Agent to Build
After the foundation, which agent pattern interests you most:
- **A)** Simple single-shot editor (like codebuff's `editor`)
- **B)** Context gatherer (like `file-picker`, `code-searcher`)
- **C)** Full orchestrator (like `base2`)
- **D)** Something custom for your TGDS projects

---

## 10. Dependencies

### Runtime Dependencies
```json
{
  "@anthropic-ai/sdk": "^0.30.0",
  "openai": "^4.70.0",
  "@google/generative-ai": "^0.21.0",
  "zod": "^3.23.0",
  "pino": "^9.0.0"
}
```

### Dev Dependencies
```json
{
  "typescript": "^5.6.0",
  "bun-types": "^1.1.0",
  "vitest": "^2.1.0",
  "@types/node": "^22.0.0"
}
```

---

## 11. Learning Milestones

Since learning is a goal, here are key concepts you'll master:

1. **LLM Tool Calling** - How models parse and generate tool calls
2. **Streaming Responses** - Handling chunked LLM output
3. **State Machines** - Agent step loops as state machines
4. **Generator Functions** - Coroutine-style control flow
5. **Multi-Provider Abstraction** - Adapter pattern for APIs
6. **JSON Schema Validation** - Runtime type checking
7. **Parallel Execution** - Promise.all for sub-agents
8. **Context Management** - Token budgets and truncation

---

## Next Steps

1. **Review this document** and answer the open questions
2. **Prioritize features** - what's essential vs nice-to-have
3. **Set up the project** - I'll create the initial structure
4. **Start Phase 1** - Core types and first tool

Let me know your answers to the questions and any adjustments to the plan!
