# Buff-Agents: Final Architecture Specification

**Date**: 2025-12-26  
**Status**: Approved - Ready for Implementation  
**Author**: Claude (Qara) + Jean-Marc

---

## Executive Summary

**buff-agents** is a custom agent library built from scratch, replicating the base2 "layers" orchestration pattern with:

- Full LLM API control (not a wrapper)
- Bun-first runtime
- Cascade/JetBrains as primary integration target
- MCP protocol for external agent integration

---

## Decision Summary

| Area | Decision |
|------|----------|
| **Agent Definition** | Functional composition (builder pattern) |
| **Agent Instances** | Factory pattern (definitions create instances) |
| **Agent Variants** | Factory functions (`createBase2(mode, options)`) |
| **Tool Definition** | Schema-first (JSON Schema + handler) |
| **Tool Results** | Simple (string/JSON) |
| **Tool Execution** | All modes (blocking, background, streaming) |
| **Tool Permissions** | Configurable per-tool |
| **Tools Included** | Batteries included (all built-in) |
| **LLM Providers** | Hybrid (direct Anthropic/OpenAI + OpenRouter fallback) |
| **Streaming** | AsyncIterable |
| **Default Provider** | Direct Anthropic API |
| **Cost Tracking** | Optional plugin |
| **Message Management** | Smart truncation with TTL tags |
| **set_output Behavior** | Configurable per-agent |
| **Error Handling** | Retry with feedback (LLM sees errors) |
| **Tool Execution Order** | Parallel by default, sequential for specific tools |
| **State** | Immutable |
| **handleSteps** | Essential - Phase 1 |
| **spawn_agents Model** | Simple (array = parallel, multiple calls = sequential) |
| **Context Inheritance** | Configurable per-agent (`includeMessageHistory`) |
| **Result Aggregation** | All modes (output, conversation, streaming) |
| **Sub-Agent Errors** | Partial results (parent decides) |
| **Agent Registry** | Dynamic directory loading |
| **Cascade Visibility** | Transparent (stream sub-agent events) |
| **MCP Tools** | Hybrid (orchestrator + primitives) |
| **CLI Mode** | Single command only |
| **Configuration** | Config file |
| **MCP Transport** | stdio only |
| **Cascade Features** | Detect and enhance |
| **Integration Priority** | Cascade + Claude Code (MCP), Gemini later |

---

## 1. Core Architecture

### 1.1 Agent Definition (Functional Composition)

```typescript
// src/core/agent-builder.ts

export function createAgent(base: AgentBase): AgentBuilder {
    return new AgentBuilder(base)
}

interface AgentBase {
    id: string
    displayName: string
    model: ModelIdentifier
}

class AgentBuilder {
    private definition: Partial<AgentDefinition>
    
    constructor(base: AgentBase) {
        this.definition = { ...base }
    }
    
    withTools(...tools: ToolName[]): this {
        this.definition.tools = tools
        return this
    }
    
    withSpawnableAgents(...agents: string[]): this {
        this.definition.spawnableAgents = agents
        return this
    }
    
    withSystemPrompt(prompt: string): this {
        this.definition.systemPrompt = prompt
        return this
    }
    
    withInstructionsPrompt(prompt: string): this {
        this.definition.instructionsPrompt = prompt
        return this
    }
    
    withStepPrompt(prompt: string): this {
        this.definition.stepPrompt = prompt
        return this
    }
    
    withMessageHistory(include: boolean = true): this {
        this.definition.includeMessageHistory = include
        return this
    }
    
    withHandleSteps(handler: AgentStepHandler): this {
        this.definition.handleSteps = handler
        return this
    }
    
    withInputSchema(schema: InputSchema): this {
        this.definition.inputSchema = schema
        return this
    }
    
    withOutputMode(mode: OutputMode, schema?: JsonSchema): this {
        this.definition.outputMode = mode
        if (schema) this.definition.outputSchema = schema
        return this
    }
    
    withSetOutputEndsRun(ends: boolean): this {
        this.definition.setOutputEndsRun = ends
        return this
    }
    
    build(): AgentDefinition {
        return this.definition as AgentDefinition
    }
}

// Usage example
const editor = createAgent({
    id: 'editor',
    displayName: 'Code Editor',
    model: 'anthropic/claude-sonnet-4',
})
    .withTools('read_files', 'write_file', 'str_replace')
    .withSystemPrompt('You are a code editor agent...')
    .withSetOutputEndsRun(true)
    .build()
```

### 1.2 Agent Factory Pattern

```typescript
// src/agents/base2/factory.ts

export type Base2Mode = 'default' | 'lite' | 'max' | 'fast'

export interface Base2Options {
    noValidation?: boolean
    planOnly?: boolean
    noAskUser?: boolean
}

export function createBase2(
    mode: Base2Mode = 'default',
    options: Base2Options = {}
): AgentDefinition {
    const {
        noValidation = mode === 'fast',
        planOnly = false,
        noAskUser = false,
    } = options
    
    const baseBuilder = createAgent({
        id: `base2${mode === 'default' ? '' : `-${mode}`}`,
        displayName: 'Buffy the Orchestrator',
        model: mode === 'lite' 
            ? 'x-ai/grok-4.1-fast' 
            : 'anthropic/claude-opus-4',
    })
    
    // Configure based on mode
    const tools = buildToolList(mode, { noValidation, noAskUser })
    const spawnableAgents = buildSpawnableAgents(mode)
    
    return baseBuilder
        .withTools(...tools)
        .withSpawnableAgents(...spawnableAgents)
        .withMessageHistory(true)
        .withSystemPrompt(buildSystemPrompt(mode, options))
        .withInstructionsPrompt(buildInstructionsPrompt(mode, options))
        .withStepPrompt(buildStepPrompt(mode, options))
        .withHandleSteps(createBase2StepHandler(mode, options))
        .build()
}

// Pre-built variants
export const base2 = createBase2('default')
export const base2Lite = createBase2('lite')
export const base2Max = createBase2('max')
export const base2Fast = createBase2('fast')
export const base2Plan = createBase2('default', { planOnly: true })
```

### 1.3 Type Definitions

```typescript
// src/core/types/agent-definition.ts

export interface AgentDefinition {
    id: string
    displayName: string
    model: ModelIdentifier
    
    tools?: ToolName[]
    spawnableAgents?: string[]
    
    systemPrompt?: string
    instructionsPrompt?: string
    stepPrompt?: string
    
    includeMessageHistory?: boolean
    setOutputEndsRun?: boolean
    
    handleSteps?: AgentStepHandler
    
    inputSchema?: {
        prompt?: { type: 'string'; description?: string }
        params?: JsonSchema
    }
    
    outputMode?: 'last_message' | 'all_messages' | 'structured_output'
    outputSchema?: JsonSchema
}

export type ModelIdentifier = 
    | `anthropic/${string}`
    | `openai/${string}`
    | `google/${string}`
    | `openrouter/${string}`
    | (string & {})

// src/core/types/agent-state.ts

export interface AgentState {
    readonly runId: string
    readonly agentId: string
    readonly parentId?: string
    readonly ancestorRunIds: readonly string[]
    readonly childRunIds: readonly string[]
    
    readonly messageHistory: readonly Message[]
    readonly systemPrompt: string
    readonly toolDefinitions: Readonly<Record<string, ToolDefinition>>
    
    readonly output?: Readonly<Record<string, unknown>>
    readonly stepsRemaining: number
    readonly creditsUsed: number
    readonly context: Readonly<Record<string, unknown>>
}

// Immutable state updates
export function updateState(
    state: AgentState, 
    updates: Partial<AgentState>
): AgentState {
    return { ...state, ...updates }
}

export function addMessage(state: AgentState, message: Message): AgentState {
    return {
        ...state,
        messageHistory: [...state.messageHistory, message]
    }
}
```

---

## 2. Tool System

### 2.1 Tool Definition (Schema-First)

```typescript
// src/tools/types.ts

export interface ToolDefinition<TInput = unknown> {
    name: string
    description: string
    inputSchema: JsonSchema
    
    endsAgentStep?: boolean
    requiresSequential?: boolean  // Cannot run in parallel
    
    permissions?: ToolPermissions
    
    execute: ToolHandler<TInput>
}

export interface ToolPermissions {
    fileSystem?: 'read' | 'write' | 'full' | 'none'
    network?: 'local' | 'external' | 'none'
    shell?: boolean
    env?: boolean
}

export type ToolHandler<TInput> = (
    context: ToolExecutionContext<TInput>
) => Promise<ToolResult>

export interface ToolExecutionContext<TInput> {
    input: TInput
    toolCallId: string
    agentState: Readonly<AgentState>
    projectContext: ProjectContext
    logger: Logger
    signal: AbortSignal
    emit: (event: ToolEvent) => void
}

export type ToolResult = string | Record<string, unknown>

export type ToolEvent = 
    | { type: 'progress'; message: string; percent?: number }
    | { type: 'log'; level: 'debug' | 'info' | 'warn' | 'error'; message: string }
    | { type: 'file_changed'; path: string; action: 'created' | 'modified' | 'deleted' }
    | { type: 'command_output'; stream: 'stdout' | 'stderr'; data: string }
```

### 2.2 Tool Registry

```typescript
// src/tools/registry.ts

export class ToolRegistry {
    private tools = new Map<string, ToolDefinition>()
    
    register<TInput>(tool: ToolDefinition<TInput>): void {
        this.tools.set(tool.name, tool as ToolDefinition)
    }
    
    get(name: string): ToolDefinition | undefined {
        return this.tools.get(name)
    }
    
    has(name: string): boolean {
        return this.tools.has(name)
    }
    
    list(): ToolDefinition[] {
        return Array.from(this.tools.values())
    }
    
    getForAgent(toolNames: string[]): Map<string, ToolDefinition> {
        const result = new Map()
        for (const name of toolNames) {
            const tool = this.tools.get(name)
            if (tool) result.set(name, tool)
        }
        return result
    }
    
    toLLMFormat(toolNames: string[]): LLMToolDefinition[] {
        return toolNames
            .map(name => this.tools.get(name))
            .filter(Boolean)
            .map(tool => ({
                name: tool!.name,
                description: tool!.description,
                input_schema: tool!.inputSchema,
            }))
    }
    
    getSequentialTools(): Set<string> {
        return new Set(
            Array.from(this.tools.values())
                .filter(t => t.requiresSequential)
                .map(t => t.name)
        )
    }
}

// Default registry with all built-in tools
export function createDefaultRegistry(): ToolRegistry {
    const registry = new ToolRegistry()
    
    // File operations
    registry.register(readFilesTool)
    registry.register(writeFileTool)
    registry.register(strReplaceTool)
    registry.register(listDirectoryTool)
    registry.register(findFilesTool)
    registry.register(globTool)
    registry.register(readSubtreeTool)
    
    // Terminal
    registry.register(runTerminalCommandTool)
    
    // Search
    registry.register(codeSearchTool)
    
    // Agent control
    registry.register(spawnAgentsTool)
    registry.register(setOutputTool)
    registry.register(endTurnTool)
    registry.register(askUserTool)
    
    // Web
    registry.register(webSearchTool)
    registry.register(readDocsTool)
    
    return registry
}
```

### 2.3 Tool Execution

```typescript
// src/tools/executor.ts

export interface ExecuteToolsOptions {
    toolCalls: ToolCall[]
    registry: ToolRegistry
    context: ToolExecutionContext<unknown>
    onResult: (toolCallId: string, result: ToolResult) => void
    onEvent: (event: ToolEvent) => void
}

export async function executeTools(options: ExecuteToolsOptions): Promise<ToolMessage[]> {
    const { toolCalls, registry, context, onResult, onEvent } = options
    const sequentialTools = registry.getSequentialTools()
    
    // Separate sequential and parallel tools
    const sequential: ToolCall[] = []
    const parallel: ToolCall[] = []
    
    for (const call of toolCalls) {
        if (sequentialTools.has(call.toolName)) {
            sequential.push(call)
        } else {
            parallel.push(call)
        }
    }
    
    const results: ToolMessage[] = []
    
    // Execute parallel tools
    if (parallel.length > 0) {
        const parallelResults = await Promise.all(
            parallel.map(call => executeToolCall(call, registry, context, onEvent))
        )
        for (let i = 0; i < parallel.length; i++) {
            const result = parallelResults[i]
            onResult(parallel[i].toolCallId, result)
            results.push(createToolMessage(parallel[i], result))
        }
    }
    
    // Execute sequential tools in order
    for (const call of sequential) {
        const result = await executeToolCall(call, registry, context, onEvent)
        onResult(call.toolCallId, result)
        results.push(createToolMessage(call, result))
    }
    
    return results
}

async function executeToolCall(
    call: ToolCall,
    registry: ToolRegistry,
    baseContext: ToolExecutionContext<unknown>,
    onEvent: (event: ToolEvent) => void
): Promise<ToolResult> {
    const tool = registry.get(call.toolName)
    if (!tool) {
        return { error: `Unknown tool: ${call.toolName}` }
    }
    
    const context: ToolExecutionContext<unknown> = {
        ...baseContext,
        input: call.input,
        toolCallId: call.toolCallId,
        emit: onEvent,
    }
    
    try {
        return await tool.execute(context)
    } catch (error) {
        // Return error as result (retry with feedback pattern)
        return { 
            error: error instanceof Error ? error.message : String(error)
        }
    }
}
```

---

## 3. LLM Provider System

### 3.1 Provider Interface

```typescript
// src/llm/types.ts

export interface LLMProvider {
    readonly name: string
    readonly supportedModels: RegExp[]
    
    supportsModel(model: string): boolean
    
    complete(request: CompletionRequest): Promise<CompletionResponse>
    
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
}

export interface StreamChunk {
    type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'usage' | 'done'
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

### 3.2 Provider Registry (Hybrid)

```typescript
// src/llm/registry.ts

export class LLMRegistry {
    private providers = new Map<string, LLMProvider>()
    private fallback?: LLMProvider
    
    register(provider: LLMProvider): void {
        this.providers.set(provider.name, provider)
    }
    
    setFallback(provider: LLMProvider): void {
        this.fallback = provider
    }
    
    getProvider(model: ModelIdentifier): LLMProvider {
        const [providerName] = model.split('/')
        
        // Try direct provider first
        const direct = this.providers.get(providerName)
        if (direct?.supportsModel(model)) {
            return direct
        }
        
        // Fall back to OpenRouter
        if (this.fallback) {
            return this.fallback
        }
        
        throw new Error(`No provider found for model: ${model}`)
    }
    
    parseModel(model: ModelIdentifier): { provider: string; modelName: string } {
        const [provider, ...rest] = model.split('/')
        return { provider, modelName: rest.join('/') }
    }
}

// Default setup
export function createDefaultLLMRegistry(config: LLMConfig): LLMRegistry {
    const registry = new LLMRegistry()
    
    if (config.anthropic?.apiKey) {
        registry.register(new AnthropicProvider(config.anthropic))
    }
    
    if (config.openai?.apiKey) {
        registry.register(new OpenAIProvider(config.openai))
    }
    
    if (config.google?.apiKey) {
        registry.register(new GoogleProvider(config.google))
    }
    
    if (config.openrouter?.apiKey) {
        registry.setFallback(new OpenRouterProvider(config.openrouter))
    }
    
    return registry
}
```

### 3.3 Anthropic Provider (Primary)

```typescript
// src/llm/providers/anthropic.ts

import Anthropic from '@anthropic-ai/sdk'

export class AnthropicProvider implements LLMProvider {
    readonly name = 'anthropic'
    readonly supportedModels = [/^anthropic\//]
    
    private client: Anthropic
    
    constructor(config: { apiKey: string; baseUrl?: string }) {
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
        })
    }
    
    supportsModel(model: string): boolean {
        return this.supportedModels.some(re => re.test(model))
    }
    
    async complete(request: CompletionRequest): Promise<CompletionResponse> {
        const response = await this.client.messages.create({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(this.convertTool),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
        })
        
        return this.convertResponse(response)
    }
    
    async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
        const stream = await this.client.messages.stream({
            model: this.extractModelName(request.model),
            messages: this.convertMessages(request.messages),
            tools: request.tools?.map(this.convertTool),
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
        })
        
        for await (const event of stream) {
            yield this.convertStreamEvent(event)
        }
    }
    
    private extractModelName(model: string): string {
        return model.replace('anthropic/', '')
    }
    
    // ... conversion methods
}
```

---

## 4. Agent Runtime

### 4.1 Runtime Core

```typescript
// src/runtime/agent-runtime.ts

export interface AgentRuntimeConfig {
    llmRegistry: LLMRegistry
    toolRegistry: ToolRegistry
    agentRegistry: AgentRegistry
    projectContext: ProjectContext
    logger: Logger
    
    maxSteps?: number
    maxConcurrentAgents?: number
    maxAgentDepth?: number
    
    onEvent?: (event: RuntimeEvent) => void
}

export class AgentRuntime {
    private config: AgentRuntimeConfig
    
    constructor(config: AgentRuntimeConfig) {
        this.config = {
            maxSteps: 50,
            maxConcurrentAgents: 10,
            maxAgentDepth: 5,
            ...config,
        }
    }
    
    async run(params: RunParams): Promise<RunResult> {
        const definition = typeof params.agent === 'string'
            ? this.config.agentRegistry.get(params.agent)
            : params.agent
        
        if (!definition) {
            throw new Error(`Agent not found: ${params.agent}`)
        }
        
        const initialState = this.createInitialState(definition, params)
        
        return runStepLoop(this, initialState, definition, params.signal)
    }
    
    async spawn(params: SpawnParams): Promise<RunResult> {
        // Sub-agent spawning with depth tracking
        if (params.depth >= this.config.maxAgentDepth!) {
            throw new Error(`Max agent depth exceeded: ${params.depth}`)
        }
        
        return this.run({
            ...params,
            parentState: params.parentState,
        })
    }
    
    // Accessors for step loop
    get llm(): LLMRegistry { return this.config.llmRegistry }
    get tools(): ToolRegistry { return this.config.toolRegistry }
    get agents(): AgentRegistry { return this.config.agentRegistry }
    get project(): ProjectContext { return this.config.projectContext }
    get logger(): Logger { return this.config.logger }
    get maxSteps(): number { return this.config.maxSteps! }
    
    emit(event: RuntimeEvent): void {
        this.config.onEvent?.(event)
    }
}
```

### 4.2 Step Loop

```typescript
// src/runtime/step-loop.ts

export async function runStepLoop(
    runtime: AgentRuntime,
    initialState: AgentState,
    definition: AgentDefinition,
    signal?: AbortSignal
): Promise<RunResult> {
    let state = initialState
    let shouldContinue = true
    let stepNumber = 0
    
    // Initialize handleSteps generator if defined
    let stepGenerator: Generator<StepYield, void, StepYieldResult> | undefined
    if (definition.handleSteps) {
        stepGenerator = definition.handleSteps({
            agentState: state,
            prompt: state.messageHistory.find(m => m.role === 'user')?.content as string,
            params: {},
            logger: runtime.logger,
        })
    }
    
    while (shouldContinue && !signal?.aborted) {
        stepNumber++
        runtime.emit({ type: 'step_start', stepNumber, agentId: state.agentId })
        
        // Check step limit
        if (state.stepsRemaining <= 0) {
            runtime.emit({ type: 'step_limit_reached', agentId: state.agentId })
            break
        }
        
        // Run programmatic step if generator exists
        if (stepGenerator) {
            const { state: newState, endTurn, skipLLM } = await runProgrammaticStep(
                runtime,
                state,
                stepGenerator,
                shouldContinue
            )
            state = newState
            
            if (endTurn) {
                shouldContinue = false
                continue
            }
            
            if (skipLLM) {
                continue
            }
        }
        
        // Build messages with smart truncation
        const messages = buildMessages(state, definition)
        
        // Get LLM provider and call
        const provider = runtime.llm.getProvider(definition.model)
        const tools = runtime.tools.toLLMFormat(definition.tools ?? [])
        
        runtime.emit({ 
            type: 'llm_request', 
            model: definition.model, 
            messageCount: messages.length 
        })
        
        // Stream response
        let content = ''
        const toolCalls: ToolCall[] = []
        
        for await (const chunk of provider.stream({
            model: definition.model,
            messages,
            tools,
            signal,
        })) {
            if (chunk.type === 'text' && chunk.content) {
                content += chunk.content
                runtime.emit({ type: 'llm_text', text: chunk.content })
            }
            if (chunk.type === 'tool_call_end' && chunk.toolCall) {
                toolCalls.push(chunk.toolCall as ToolCall)
            }
            if (chunk.type === 'usage' && chunk.usage) {
                state = updateState(state, {
                    creditsUsed: state.creditsUsed + calculateCost(chunk.usage, definition.model)
                })
            }
        }
        
        runtime.emit({ type: 'llm_response', content, toolCalls })
        
        // Add assistant message
        state = addMessage(state, {
            role: 'assistant',
            content,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        })
        
        // Execute tool calls
        if (toolCalls.length > 0) {
            const toolResults = await executeTools({
                toolCalls,
                registry: runtime.tools,
                context: createToolContext(runtime, state),
                onResult: (id, result) => {
                    runtime.emit({ type: 'tool_result', toolCallId: id, result })
                },
                onEvent: (event) => runtime.emit({ type: 'tool_event', event }),
            })
            
            // Add tool results to state
            for (const result of toolResults) {
                state = addMessage(state, result)
            }
            
            // Check for turn-ending tools
            const endTurnTools = ['end_turn', 'task_completed']
            const setOutputEnds = definition.setOutputEndsRun ?? false
            if (setOutputEnds) endTurnTools.push('set_output')
            
            if (toolCalls.some(tc => endTurnTools.includes(tc.toolName))) {
                shouldContinue = false
            }
        } else {
            // No tool calls = end of turn
            shouldContinue = false
        }
        
        // Decrement step counter
        state = updateState(state, {
            stepsRemaining: state.stepsRemaining - 1
        })
        
        runtime.emit({ type: 'step_end', stepNumber, shouldContinue })
    }
    
    runtime.emit({ 
        type: 'run_complete', 
        agentId: state.agentId,
        output: getAgentOutput(state, definition),
        totalCost: state.creditsUsed 
    })
    
    return {
        state,
        output: getAgentOutput(state, definition),
        totalCost: state.creditsUsed,
    }
}
```

### 4.3 Message Management (Smart Truncation)

```typescript
// src/runtime/messages.ts

export interface Message {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string | ContentPart[]
    toolCalls?: ToolCall[]
    toolCallId?: string
    toolName?: string
    
    // TTL and importance tags
    tags?: string[]
    timeToLive?: 'userPrompt' | 'agentStep' | 'forever'
    keepDuringTruncation?: boolean
}

export function expireMessages(
    messages: readonly Message[], 
    trigger: 'userPrompt' | 'agentStep'
): Message[] {
    return messages.filter(m => m.timeToLive !== trigger)
}

export function buildMessages(
    state: AgentState, 
    definition: AgentDefinition
): Message[] {
    // Start with system prompt
    const messages: Message[] = []
    
    if (state.systemPrompt) {
        messages.push({ role: 'system', content: state.systemPrompt })
    }
    
    // Add message history (already expired)
    messages.push(...state.messageHistory)
    
    // Add step prompt if defined
    if (definition.stepPrompt) {
        messages.push({
            role: 'user',
            content: definition.stepPrompt,
            tags: ['STEP_PROMPT'],
            timeToLive: 'agentStep',
            keepDuringTruncation: true,
        })
    }
    
    return messages
}

export function truncateMessages(
    messages: Message[],
    maxTokens: number,
    tokenCounter: (msg: Message) => number
): Message[] {
    // Keep messages marked as important
    const important = messages.filter(m => m.keepDuringTruncation)
    const removable = messages.filter(m => !m.keepDuringTruncation)
    
    let totalTokens = important.reduce((sum, m) => sum + tokenCounter(m), 0)
    const result = [...important]
    
    // Add removable messages from most recent, until budget exhausted
    for (let i = removable.length - 1; i >= 0; i--) {
        const tokens = tokenCounter(removable[i])
        if (totalTokens + tokens <= maxTokens) {
            result.unshift(removable[i])
            totalTokens += tokens
        }
    }
    
    return result
}
```

### 4.4 Programmatic Steps (handleSteps)

```typescript
// src/runtime/programmatic-step.ts

export type StepYield = 
    | ToolCallYield
    | 'STEP'
    | 'STEP_ALL'

export interface ToolCallYield {
    toolName: string
    input: Record<string, unknown>
    includeToolCall?: boolean
}

export interface StepYieldResult {
    agentState: AgentState
    toolResult?: unknown
    stepsComplete: boolean
    nResponses?: string[]
}

export async function runProgrammaticStep(
    runtime: AgentRuntime,
    state: AgentState,
    generator: Generator<StepYield, void, StepYieldResult>,
    stepsComplete: boolean
): Promise<{ state: AgentState; endTurn: boolean; skipLLM: boolean }> {
    
    const yieldResult = generator.next({
        agentState: state,
        stepsComplete,
    })
    
    if (yieldResult.done) {
        return { state, endTurn: true, skipLLM: true }
    }
    
    const yielded = yieldResult.value
    
    // Handle tool call yield
    if (typeof yielded === 'object' && 'toolName' in yielded) {
        const toolCall: ToolCall = {
            toolCallId: crypto.randomUUID(),
            toolName: yielded.toolName,
            input: yielded.input,
        }
        
        const [result] = await executeTools({
            toolCalls: [toolCall],
            registry: runtime.tools,
            context: createToolContext(runtime, state),
            onResult: () => {},
            onEvent: (event) => runtime.emit({ type: 'tool_event', event }),
        })
        
        // Optionally add to message history
        if (yielded.includeToolCall !== false) {
            state = addMessage(state, {
                role: 'assistant',
                content: '',
                toolCalls: [toolCall],
            })
            state = addMessage(state, result)
        }
        
        return { state, endTurn: false, skipLLM: true }
    }
    
    // Handle 'STEP' - run one LLM step
    if (yielded === 'STEP') {
        return { state, endTurn: false, skipLLM: false }
    }
    
    // Handle 'STEP_ALL' - run until done
    if (yielded === 'STEP_ALL') {
        // Let the main loop continue until natural end
        return { state, endTurn: false, skipLLM: false }
    }
    
    return { state, endTurn: false, skipLLM: false }
}
```

---

## 5. Sub-Agent Orchestration

### 5.1 spawn_agents Tool

```typescript
// src/tools/builtin/spawn-agents.ts

export const spawnAgentsTool: ToolDefinition<SpawnAgentsInput> = {
    name: 'spawn_agents',
    description: 'Spawn multiple agents to run in parallel',
    inputSchema: {
        type: 'object',
        properties: {
            agents: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        agent_type: { type: 'string' },
                        prompt: { type: 'string' },
                        params: { type: 'object' },
                    },
                    required: ['agent_type'],
                },
            },
        },
        required: ['agents'],
    },
    requiresSequential: true,  // Don't run spawn_agents in parallel with other spawns
    
    async execute(context): Promise<ToolResult> {
        const { input, agentState } = context
        const runtime = context.runtime as AgentRuntime
        
        // Spawn all agents in parallel
        const results = await Promise.all(
            input.agents.map(async (agentConfig) => {
                try {
                    const result = await runtime.spawn({
                        agent: agentConfig.agent_type,
                        prompt: agentConfig.prompt,
                        params: agentConfig.params,
                        parentState: agentState,
                        depth: (agentState.ancestorRunIds.length || 0) + 1,
                    })
                    
                    return {
                        agentId: agentConfig.agent_type,
                        status: 'success' as const,
                        output: result.output,
                    }
                } catch (error) {
                    return {
                        agentId: agentConfig.agent_type,
                        status: 'error' as const,
                        error: error instanceof Error ? error.message : String(error),
                    }
                }
            })
        )
        
        return { agents: results }
    },
}
```

### 5.2 Agent Registry (Dynamic Loading)

```typescript
// src/agents/registry.ts

export class AgentRegistry {
    private agents = new Map<string, AgentDefinition>()
    
    register(definition: AgentDefinition): void {
        this.agents.set(definition.id, definition)
    }
    
    get(id: string): AgentDefinition | undefined {
        return this.agents.get(id)
    }
    
    list(): AgentDefinition[] {
        return Array.from(this.agents.values())
    }
    
    async loadFromDirectory(dir: string): Promise<void> {
        const files = await readdir(dir, { recursive: true })
        
        for (const file of files) {
            if (!file.endsWith('.ts') && !file.endsWith('.js')) continue
            
            const fullPath = join(dir, file)
            const module = await import(fullPath)
            
            if (module.default && isAgentDefinition(module.default)) {
                this.register(module.default)
            }
        }
    }
}

function isAgentDefinition(obj: unknown): obj is AgentDefinition {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        'id' in obj &&
        'displayName' in obj &&
        'model' in obj
    )
}

// Create registry with built-in + loaded agents
export async function createAgentRegistry(
    agentsDir?: string
): Promise<AgentRegistry> {
    const registry = new AgentRegistry()
    
    // Register built-in agents
    registry.register(base2)
    registry.register(base2Lite)
    registry.register(base2Max)
    registry.register(base2Fast)
    registry.register(editor)
    registry.register(thinker)
    registry.register(filePicker)
    registry.register(codeSearcher)
    registry.register(codeReviewer)
    
    // Load custom agents from directory
    if (agentsDir) {
        await registry.loadFromDirectory(agentsDir)
    }
    
    return registry
}
```

---

## 6. Cascade/MCP Integration

### 6.1 MCP Server

```typescript
// src/mcp/server.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export async function startMCPServer(runtime: AgentRuntime): Promise<void> {
    const server = new Server(
        { name: 'buff-agents', version: '1.0.0' },
        { capabilities: { tools: {} } }
    )
    
    // Detect Cascade for optimizations
    const isCascade = detectCascade()
    
    // Register tools
    server.setRequestHandler('tools/list', async () => ({
        tools: [
            // High-level orchestrator
            {
                name: 'buff_orchestrate',
                description: 'Run buff-agents orchestrator for complex multi-step coding tasks',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Task description' },
                        mode: { 
                            type: 'string', 
                            enum: ['default', 'lite', 'max', 'fast'],
                            description: 'Orchestration mode'
                        },
                    },
                    required: ['prompt'],
                },
            },
            // Primitives
            {
                name: 'buff_search_code',
                description: 'Search codebase using ripgrep',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string' },
                        flags: { type: 'string' },
                    },
                    required: ['pattern'],
                },
            },
            {
                name: 'buff_analyze',
                description: 'Deep code analysis using thinker agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string' },
                        files: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['prompt'],
                },
            },
        ],
    }))
    
    server.setRequestHandler('tools/call', async (request) => {
        const { name, arguments: args } = request.params
        
        // Stream events back to client
        const events: MCPEvent[] = []
        
        runtime.config.onEvent = (event) => {
            events.push(event)
            // Send notification for transparent visibility
            server.notification({
                method: 'notifications/progress',
                params: { event },
            })
        }
        
        try {
            let result: RunResult
            
            switch (name) {
                case 'buff_orchestrate':
                    result = await runtime.run({
                        agent: createBase2(args.mode ?? 'default'),
                        prompt: args.prompt,
                    })
                    break
                    
                case 'buff_search_code':
                    // Direct tool execution
                    const searchResult = await runtime.tools.get('code_search')!.execute({
                        input: args,
                        // ... context
                    })
                    return { content: [{ type: 'text', text: JSON.stringify(searchResult) }] }
                    
                case 'buff_analyze':
                    result = await runtime.run({
                        agent: 'thinker',
                        prompt: args.prompt,
                    })
                    break
                    
                default:
                    throw new Error(`Unknown tool: ${name}`)
            }
            
            return {
                content: [
                    { type: 'text', text: JSON.stringify(result.output) },
                ],
            }
        } catch (error) {
            return {
                content: [
                    { type: 'text', text: `Error: ${error}` },
                ],
                isError: true,
            }
        }
    })
    
    // Start server on stdio
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

function detectCascade(): boolean {
    // Cascade sets specific environment variables
    return process.env.JETBRAINS_IDE !== undefined ||
           process.env.CASCADE_VERSION !== undefined
}
```

### 6.2 CLI

```typescript
// src/cli/index.ts

import { Command } from 'commander'

const program = new Command()

program
    .name('buff-agents')
    .description('Autonomous coding agent library')
    .version('1.0.0')

program
    .command('run')
    .description('Run an agent')
    .argument('<agent>', 'Agent ID (e.g., base2, editor, thinker)')
    .argument('<prompt>', 'Task description')
    .option('-m, --mode <mode>', 'Agent mode (for base2)', 'default')
    .option('-c, --config <path>', 'Config file path', '.buff-agents.json')
    .action(async (agent, prompt, options) => {
        const config = await loadConfig(options.config)
        const runtime = await createRuntime(config)
        
        const result = await runtime.run({
            agent: agent === 'base2' ? createBase2(options.mode) : agent,
            prompt,
        })
        
        console.log(JSON.stringify(result.output, null, 2))
    })

program
    .command('serve')
    .description('Start MCP server')
    .option('-c, --config <path>', 'Config file path', '.buff-agents.json')
    .action(async (options) => {
        const config = await loadConfig(options.config)
        const runtime = await createRuntime(config)
        
        await startMCPServer(runtime)
    })

program
    .command('list-agents')
    .description('List available agents')
    .action(async () => {
        const registry = await createAgentRegistry()
        for (const agent of registry.list()) {
            console.log(`${agent.id}: ${agent.displayName}`)
        }
    })

program.parse()
```

### 6.3 Configuration

```typescript
// src/config/types.ts

export interface BuffAgentsConfig {
    // LLM Providers
    providers?: {
        anthropic?: { apiKey: string; baseUrl?: string }
        openai?: { apiKey: string; baseUrl?: string }
        google?: { apiKey: string }
        openrouter?: { apiKey: string }
    }
    
    // Defaults
    defaultModel?: ModelIdentifier
    
    // Agent overrides
    agents?: Record<string, Partial<AgentDefinition>>
    
    // Custom agents directory
    agentsDir?: string
    
    // Runtime limits
    maxSteps?: number
    maxConcurrentAgents?: number
    maxAgentDepth?: number
    
    // MCP settings
    mcp?: {
        exposeAgents?: string[]
        exposePrimitives?: string[]
    }
    
    // Tool permissions
    toolPermissions?: Record<string, ToolPermissions>
}

// .buff-agents.json example
/*
{
    "providers": {
        "anthropic": { "apiKey": "${ANTHROPIC_API_KEY}" }
    },
    "defaultModel": "anthropic/claude-sonnet-4",
    "agentsDir": "./.agents",
    "maxSteps": 50,
    "mcp": {
        "exposeAgents": ["base2", "editor", "thinker"],
        "exposePrimitives": ["buff_search_code", "buff_analyze"]
    }
}
*/
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
│   │   ├── agent-builder.ts
│   │   └── index.ts
│   │
│   ├── tools/
│   │   ├── types.ts
│   │   ├── registry.ts
│   │   ├── executor.ts
│   │   ├── builtin/
│   │   │   ├── read-files.ts
│   │   │   ├── write-file.ts
│   │   │   ├── str-replace.ts
│   │   │   ├── list-directory.ts
│   │   │   ├── find-files.ts
│   │   │   ├── glob.ts
│   │   │   ├── read-subtree.ts
│   │   │   ├── code-search.ts
│   │   │   ├── run-terminal-command.ts
│   │   │   ├── spawn-agents.ts
│   │   │   ├── set-output.ts
│   │   │   ├── end-turn.ts
│   │   │   ├── ask-user.ts
│   │   │   ├── web-search.ts
│   │   │   ├── read-docs.ts
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
│   │   ├── messages.ts
│   │   ├── events.ts
│   │   └── index.ts
│   │
│   ├── agents/
│   │   ├── registry.ts
│   │   ├── base2/
│   │   │   ├── factory.ts
│   │   │   ├── prompts.ts
│   │   │   └── index.ts
│   │   ├── editor/
│   │   │   └── editor.ts
│   │   ├── thinker/
│   │   │   └── thinker.ts
│   │   ├── file-picker/
│   │   │   └── file-picker.ts
│   │   ├── code-searcher/
│   │   │   └── code-searcher.ts
│   │   ├── code-reviewer/
│   │   │   └── code-reviewer.ts
│   │   └── index.ts
│   │
│   ├── mcp/
│   │   ├── server.ts
│   │   ├── tools.ts
│   │   └── index.ts
│   │
│   ├── cli/
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── run.ts
│   │   │   ├── serve.ts
│   │   │   └── list.ts
│   │   └── index.ts
│   │
│   ├── config/
│   │   ├── types.ts
│   │   ├── loader.ts
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
│   ├── integration/
│   └── e2e/
│
├── .agents/                    # User's custom agents
│   └── my-agent.ts
│
├── .buff-agents.json           # Configuration
├── package.json
├── tsconfig.json
├── bunfig.toml
└── README.md
```

---

## 8. Implementation Phases (Revised)

### Phase 1: Foundation + handleSteps (Weeks 1-3)
- [x] Project setup (Bun, TypeScript)
- [ ] Core types (AgentDefinition, AgentState, Messages)
- [ ] Agent builder (functional composition)
- [ ] Tool types and registry
- [ ] Implement P0 tools: `read_files`, `write_file`, `str_replace`, `list_directory`, `run_terminal_command`, `set_output`
- [ ] Anthropic provider (primary)
- [ ] Basic step loop with immutable state
- [ ] **handleSteps generator support**
- [ ] Smart message truncation with TTL
- [ ] Simple CLI (`buff-agents run`)

**Milestone**: Single agent can read files, make edits, run commands with programmatic step control

### Phase 2: Multi-Provider + Tools (Weeks 4-5)
- [ ] OpenAI provider
- [ ] OpenRouter fallback provider
- [ ] Implement remaining tools: `code_search`, `find_files`, `glob`, `read_subtree`, `web_search`, `read_docs`, `ask_user`
- [ ] Tool permissions system
- [ ] Streaming tool output (terminal)

**Milestone**: Same agent works with Claude, GPT, any OpenRouter model

### Phase 3: Sub-Agent Orchestration (Weeks 6-7)
- [ ] `spawn_agents` tool
- [ ] Agent registry with dynamic loading
- [ ] Parent-child state management
- [ ] Parallel agent execution
- [ ] Partial results on error
- [ ] Result aggregation (all modes)

**Milestone**: Base2-style orchestrator working

### Phase 4: Cascade/MCP Integration (Weeks 8-9)
- [ ] MCP server (stdio)
- [ ] Hybrid tool exposure (orchestrator + primitives)
- [ ] Event streaming to MCP client
- [ ] Cascade detection and optimizations
- [ ] Claude Code compatibility testing

**Milestone**: buff-agents works as MCP server for Cascade

### Phase 5: Polish (Weeks 10-12)
- [ ] Comprehensive test suite
- [ ] Documentation
- [ ] Error messages and debugging
- [ ] Performance optimization
- [ ] npm/bun package publishing

---

## 9. Dependencies

```json
{
  "name": "buff-agents",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "buff-agents": "dist/cli/index.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "openai": "^4.70.0",
    "@google/generative-ai": "^0.21.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "commander": "^12.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "bun-types": "^1.1.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

---

## 10. Next Steps

1. **Create project structure** with `package.json`, `tsconfig.json`, `bunfig.toml`
2. **Implement core types** (AgentDefinition, AgentState, Messages)
3. **Build agent builder** (functional composition pattern)
4. **Implement first tool** (`read_files`)
5. **Create Anthropic provider**
6. **Build step loop** with handleSteps support
7. **Test with simple agent**

Ready to start implementation?
