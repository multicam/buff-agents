# Anthropic Agent SDK Integration Plan

## Executive Summary

The **Anthropic Agent SDK** (formerly Claude Code SDK) provides a production-ready agent runtime with built-in tools, session management, hooks, and MCP support. This document analyzes how buff-agents can integrate with or leverage the SDK.

---

## 1. Overlaps (What buff-agents already has)

| Feature | buff-agents | Agent SDK | Notes |
|---------|-------------|-----------|-------|
| **Agent Loop** | `step-loop.ts` | `query()` async iterator | Both implement agentic loops with tool execution |
| **Tool Registry** | `ToolRegistry` class | Built-in tools (Read, Edit, Bash, etc.) | buff-agents has custom registry; SDK has predefined tools |
| **Sub-agent Spawning** | `spawn_agents` tool + `SubAgentExecutor` | Subagent hooks (`SubagentStart`, `SubagentStop`) | buff-agents has explicit spawning; SDK has implicit subagent support |
| **MCP Support** | `src/mcp/server.ts` | Native MCP integration | buff-agents exposes agents as MCP tools; SDK consumes MCP servers |
| **Permission System** | `permissions.ts` with path/network checks | `permissionMode` + `canUseTool` callback | Similar concepts, different implementations |
| **Multi-provider LLM** | `LLMRegistry` with Anthropic/OpenAI/OpenRouter | Anthropic-only (with Bedrock/Vertex/Foundry) | buff-agents is more provider-agnostic |
| **Event Streaming** | `RuntimeEvent` types + `onEvent` callback | Async iterator yielding `AssistantMessage`, `ResultMessage` | Similar streaming patterns |
| **System Prompts** | `AgentDefinition.systemPrompt` | `ClaudeAgentOptions.system_prompt` | Direct equivalent |

---

## 2. Gaps (What Agent SDK has that buff-agents lacks)

### 2.1 Session Management
**SDK Feature:** Sessions persist across queries with `sessionId` for resumption and forking.

**buff-agents Gap:** No session persistence. `AgentState` is in-memory only.

**Integration Path:**
```typescript
// New: src/runtime/session-store.ts
interface SessionStore {
    save(sessionId: string, state: AgentState): Promise<void>
    load(sessionId: string): Promise<AgentState | null>
    fork(sessionId: string, newId: string): Promise<void>
}
```

### 2.2 Hooks System
**SDK Feature:** Rich hook system with `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart`, etc.

**buff-agents Gap:** Only has `onEvent` callback (read-only). Cannot intercept/modify/block tool calls.

**Integration Path:**
```typescript
// New: src/runtime/hooks.ts
type HookResult = 
    | { action: 'allow' }
    | { action: 'block', reason: string }
    | { action: 'modify', input: unknown }

interface AgentHooks {
    preToolUse?: (toolName: string, input: unknown) => Promise<HookResult>
    postToolUse?: (toolName: string, result: unknown) => Promise<void>
    onStop?: (reason: string) => Promise<void>
}
```

### 2.3 Built-in Tool Execution
**SDK Feature:** Tools like `Read`, `Edit`, `Bash`, `WebSearch` execute automatically without user implementation.

**buff-agents Gap:** Tools must be explicitly implemented and registered.

**Integration Path:** Consider wrapping Agent SDK as a "super-tool" that delegates to Claude Code's built-in tools when appropriate.

### 2.4 Skills & Slash Commands
**SDK Feature:** `.claude/skills/SKILL.md` and `.claude/commands/*.md` for project-specific behaviors.

**buff-agents Gap:** No equivalent. Prompts are hardcoded in agent definitions.

**Integration Path:**
```typescript
// New: src/config/skills-loader.ts
async function loadSkills(projectRoot: string): Promise<Skill[]> {
    const skillsDir = join(projectRoot, '.buff-agents', 'skills')
    // Load markdown files as skill definitions
}
```

### 2.5 Permission Modes
**SDK Feature:** `acceptEdits`, `bypassPermissions`, `default` modes with `canUseTool` callback for interactive approval.

**buff-agents Gap:** Permission config is static per-run. No interactive approval flow.

**Integration Path:** Add permission mode to `AgentRuntimeConfig`:
```typescript
interface AgentRuntimeConfig {
    permissionMode: 'acceptAll' | 'interactive' | 'readOnly'
    canUseTool?: (toolName: string, input: unknown) => Promise<boolean>
}
```

---

## 3. Gaps (What buff-agents has that Agent SDK lacks)

| Feature | buff-agents | Agent SDK |
|---------|-------------|-----------|
| **Multi-provider LLM** | OpenAI, Google, OpenRouter, xAI, Perplexity | Anthropic only |
| **Programmatic Step Control** | `handleSteps` generator for layer patterns | No equivalent |
| **Agent Registry** | Dynamic agent registration and spawning | No agent composition |
| **Custom Tool Definitions** | Full control over tool schemas | Limited to built-in tools + MCP |
| **Output Schemas** | Structured output with JSON schema validation | No structured output mode |

---

## 4. Integration Strategies

### Strategy A: Agent SDK as a Tool Provider (Recommended)
Use Agent SDK's built-in tools (Read, Edit, Bash) as an MCP server consumed by buff-agents.

```typescript
// mcp-config.json
{
    "mcpServers": {
        "claude-code": {
            "command": "claude",
            "args": ["mcp", "serve"],
            "env": { "ANTHROPIC_API_KEY": "..." }
        }
    }
}
```

**Pros:** Get battle-tested file/shell tools without reimplementing.
**Cons:** Adds Claude Code as a runtime dependency.

### Strategy B: Adopt SDK Patterns
Port SDK patterns (hooks, sessions, permission modes) into buff-agents without taking the SDK as a dependency.

**Priority implementations:**
1. **Hooks system** — Most impactful for UI integration
2. **Session persistence** — Enables multi-turn workflows
3. **Skills loader** — Project-specific customization

### Strategy C: Hybrid Runtime
Allow buff-agents to delegate to Agent SDK for certain tasks while maintaining its own runtime for multi-provider scenarios.

```typescript
// New: src/runtime/hybrid-executor.ts
async function executeWithBestRuntime(task: Task): Promise<Result> {
    if (task.requiresMultiProvider) {
        return buffAgentsRuntime.run(task)
    }
    // Delegate to Agent SDK for Claude-specific tasks
    return agentSDK.query(task.prompt, { allowedTools: task.tools })
}
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement `SessionStore` interface with file-based adapter
- [ ] Add hooks system (`preToolUse`, `postToolUse`)
- [ ] Create permission mode enum and `canUseTool` callback

### Phase 2: SDK Interop (Weeks 3-4)
- [ ] Add Agent SDK as optional peer dependency
- [ ] Create `AgentSDKToolProvider` that wraps SDK tools as buff-agents tools
- [ ] Implement skills/commands loader from `.buff-agents/` directory

### Phase 3: Convergence (Weeks 5-6)
- [ ] Align event types with SDK message types for UI compatibility
- [ ] Add session forking capability
- [ ] Implement `SubagentStart`/`SubagentStop` hook equivalents

---

## 6. User Interface Requirements

The following requirements apply to any UI built to interact with buff-agents, informed by Agent SDK patterns.

### 6.1 Core Display Requirements

#### Message Stream
- **Real-time streaming** of agent reasoning text (`llm_text` events)
- **Tool call visualization** showing tool name, input preview, and status
- **Collapsible tool results** (file contents, command output can be large)
- **Error highlighting** with stack traces in expandable sections

#### Agent Hierarchy
- **Parent/child relationship** visualization for spawned sub-agents
- **Depth indicator** (e.g., indentation or nesting) for sub-agent output
- **Cost tracking** per agent and cumulative

### 6.2 Interactive Controls

#### Permission Prompts
When `permissionMode: 'interactive'`:
- **Approve/Deny buttons** for each tool call
- **"Always allow this tool"** checkbox for session-level approval
- **Input preview** before execution (especially for file writes, shell commands)
- **Diff view** for file edits showing before/after

#### Session Management
- **Session list** showing active and resumable sessions
- **Resume button** to continue a paused session
- **Fork button** to branch from a checkpoint
- **Session history** with step-by-step replay

### 6.3 Configuration Panel

#### Agent Selection
- **Agent picker** dropdown or card grid
- **Agent description** and capabilities summary
- **Tool list** showing what the agent can do

#### Runtime Options
- **Model selector** (for multi-provider support)
- **Max steps** slider
- **Permission mode** toggle (acceptAll / interactive / readOnly)
- **Project root** path selector

### 6.4 Observability Dashboard

#### Metrics
- **Token usage** (input/output per step)
- **Cost accumulator** (real-time $ estimate)
- **Step counter** with limit indicator
- **Latency** per LLM call

#### Trace View
- **Timeline** of all events (steps, tool calls, LLM requests)
- **Expandable details** for each event
- **Filter by event type** (errors only, tools only, etc.)
- **Export trace** as JSON for debugging

### 6.5 Hook Integration Points

The UI should expose hooks for customization:

| Hook | UI Behavior |
|------|-------------|
| `PreToolUse` | Show approval dialog, allow input modification |
| `PostToolUse` | Display result, offer retry option |
| `Stop` | Show completion summary, offer follow-up prompt |
| `SubagentStart` | Create nested output panel |
| `SubagentStop` | Collapse/summarize sub-agent output |
| `Error` | Show error banner with retry/abort options |

### 6.6 Accessibility & UX

- **Keyboard navigation** for approval dialogs (Enter=approve, Esc=deny)
- **Screen reader support** for streaming text
- **Dark/light mode** support
- **Mobile-responsive** layout for monitoring on-the-go
- **Notification system** for long-running agents (browser notifications when complete)

### 6.7 State Synchronization

For multi-client scenarios (e.g., web dashboard + CLI):
- **WebSocket connection** for real-time event streaming
- **Optimistic UI updates** with server reconciliation
- **Conflict resolution** for concurrent session access
- **Offline indicator** with reconnection handling

---

## 7. Technical Decisions

### Dependency Strategy
**Recommendation:** Strategy B (adopt patterns) for core, Strategy A (SDK as tool provider) as optional enhancement.

This preserves buff-agents' multi-provider advantage while allowing users to opt into Agent SDK's battle-tested tools.

### Event Type Alignment
Map buff-agents events to SDK-compatible types for UI portability:

| buff-agents Event | SDK Equivalent |
|-------------------|----------------|
| `llm_text` | `AssistantMessage` with text block |
| `tool_start` | `AssistantMessage` with tool_use block |
| `tool_result` | `ToolResultMessage` |
| `run_complete` | `ResultMessage` |
| `error` | `ResultMessage` with error subtype |

---

## 8. Open Questions

1. **Should buff-agents require Claude Code installation?** (Adds friction but unlocks SDK tools)
2. **How to handle model routing when SDK only supports Anthropic?** (Fallback logic needed)
3. **Session storage format?** (JSON files vs SQLite vs Redis)
4. **Hook execution timeout?** (Prevent hung agents from blocking indefinitely)

---

## 9. AG-UI Protocol Integration (Bun + SvelteKit)

Inspired by the [AG-UI protocol](https://blog.logrocket.com/build-real-ai-with-ag-ui/), this section defines an event-driven architecture for buff-agents UI using **Bun** as the runtime and **SvelteKit** as the frontend framework.

### 9.1 Why AG-UI Patterns?

AG-UI solves the "write once, use everywhere" problem for AI interfaces:
- **Protocol over library** — Define event contracts, not framework bindings
- **Event-driven model** — Matches how agents actually behave (streaming, tool calls, state changes)
- **Client-agnostic** — Same agent logic works for web, CLI, Slack bot, VS Code extension

### 9.2 Event Protocol Definition

Define a shared event protocol between buff-agents runtime and SvelteKit frontend:

```typescript
// packages/protocol/src/events.ts

export type AgentEvent =
    // Run lifecycle
    | { type: 'run_start'; runId: string; agentId: string; timestamp: number }
    | { type: 'run_complete'; runId: string; output: unknown; cost: number }
    | { type: 'run_error'; runId: string; error: string; stack?: string }
    
    // Text streaming
    | { type: 'text_start'; messageId: string }
    | { type: 'text_delta'; messageId: string; delta: string }
    | { type: 'text_end'; messageId: string }
    
    // Tool execution
    | { type: 'tool_start'; toolCallId: string; toolName: string; input: unknown }
    | { type: 'tool_args_delta'; toolCallId: string; delta: string }
    | { type: 'tool_result'; toolCallId: string; result: unknown; success: boolean }
    
    // Sub-agent lifecycle
    | { type: 'subagent_start'; runId: string; parentRunId: string; agentId: string }
    | { type: 'subagent_end'; runId: string; output: unknown }
    
    // Permission requests (interactive mode)
    | { type: 'permission_request'; requestId: string; toolName: string; input: unknown }
    | { type: 'permission_response'; requestId: string; allowed: boolean; reason?: string }
    
    // Metrics
    | { type: 'metrics'; tokens: { input: number; output: number }; cost: number; latencyMs: number }
```

### 9.3 Server Architecture (Bun)

```
┌─────────────────────────────────────────────────────────────┐
│                     SvelteKit App                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat View   │  │ Tool Panel  │  │ Observability       │  │
│  │ (streaming) │  │ (approvals) │  │ (metrics/trace)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
│                   ┌──────▼──────┐                           │
│                   │ EventSource │  (SSE or WebSocket)       │
│                   └──────┬──────┘                           │
└──────────────────────────┼──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Bun Server                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ src/server/routes/agent.ts                          │    │
│  │                                                     │    │
│  │ POST /api/agent/run     → Start agent run           │    │
│  │ GET  /api/agent/stream  → SSE event stream          │    │
│  │ POST /api/agent/respond → Permission response       │    │
│  │ GET  /api/sessions      → List sessions             │    │
│  │ POST /api/sessions/:id/resume → Resume session      │    │
│  └─────────────────────────────────────────────────────┘    │
│                          │                                  │
│  ┌───────────────────────▼─────────────────────────────┐    │
│  │ AgentRuntime (buff-agents)                          │    │
│  │                                                     │    │
│  │ onEvent → Broadcast to connected SSE clients        │    │
│  │ hooks.preToolUse → Await permission if interactive  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 9.4 SvelteKit Project Structure

```
apps/ui/
├── src/
│   ├── lib/
│   │   ├── stores/
│   │   │   ├── agent.ts          # Svelte stores for agent state
│   │   │   ├── events.ts         # Event stream subscription
│   │   │   └── permissions.ts    # Pending permission requests
│   │   ├── components/
│   │   │   ├── ChatMessage.svelte
│   │   │   ├── ToolCallCard.svelte
│   │   │   ├── PermissionDialog.svelte
│   │   │   ├── SubAgentPanel.svelte
│   │   │   ├── MetricsBar.svelte
│   │   │   └── TraceTimeline.svelte
│   │   └── protocol/
│   │       └── events.ts         # Shared event types (symlink or package)
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +page.svelte          # Main agent chat interface
│   │   ├── sessions/
│   │   │   └── +page.svelte      # Session management
│   │   └── api/
│   │       └── [...proxy]/+server.ts  # Proxy to Bun backend
│   └── app.html
├── static/
├── svelte.config.js
├── vite.config.ts
└── package.json
```

### 9.5 Core Svelte Stores

```typescript
// apps/ui/src/lib/stores/events.ts
import { writable, derived } from 'svelte/store'
import type { AgentEvent } from '$lib/protocol/events'

// Raw event stream
export const events = writable<AgentEvent[]>([])

// Derived stores for UI components
export const messages = derived(events, ($events) =>
    $events.filter(e => e.type.startsWith('text_'))
)

export const toolCalls = derived(events, ($events) =>
    $events.filter(e => e.type.startsWith('tool_'))
)

export const pendingPermissions = derived(events, ($events) =>
    $events
        .filter(e => e.type === 'permission_request')
        .filter(req => !$events.some(
            e => e.type === 'permission_response' && e.requestId === req.requestId
        ))
)

export const isRunning = writable(false)
export const currentRunId = writable<string | null>(null)

// SSE connection
export function connectToAgent(runId: string) {
    const eventSource = new EventSource(`/api/agent/stream?runId=${runId}`)
    
    eventSource.onmessage = (event) => {
        const agentEvent: AgentEvent = JSON.parse(event.data)
        events.update(e => [...e, agentEvent])
        
        if (agentEvent.type === 'run_start') {
            isRunning.set(true)
            currentRunId.set(agentEvent.runId)
        }
        if (agentEvent.type === 'run_complete' || agentEvent.type === 'run_error') {
            isRunning.set(false)
        }
    }
    
    return () => eventSource.close()
}
```

### 9.6 Streaming Chat Component

```svelte
<!-- apps/ui/src/lib/components/ChatMessage.svelte -->
<script lang="ts">
    import { events } from '$lib/stores/events'
    import { derived } from 'svelte/store'
    
    export let messageId: string
    
    // Accumulate text deltas for this message
    const content = derived(events, ($events) => {
        return $events
            .filter(e => e.type === 'text_delta' && e.messageId === messageId)
            .map(e => e.delta)
            .join('')
    })
    
    const isComplete = derived(events, ($events) =>
        $events.some(e => e.type === 'text_end' && e.messageId === messageId)
    )
</script>

<div class="message" class:streaming={!$isComplete}>
    <div class="content">{$content}</div>
    {#if !$isComplete}
        <span class="cursor">▊</span>
    {/if}
</div>

<style>
    .message { padding: 1rem; border-radius: 0.5rem; }
    .streaming { background: var(--bg-streaming); }
    .cursor { animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: 0; } }
</style>
```

### 9.7 Permission Dialog Component

```svelte
<!-- apps/ui/src/lib/components/PermissionDialog.svelte -->
<script lang="ts">
    import { pendingPermissions } from '$lib/stores/events'
    
    async function respond(requestId: string, allowed: boolean) {
        await fetch('/api/agent/respond', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, allowed })
        })
    }
    
    function handleKeydown(event: KeyboardEvent, requestId: string) {
        if (event.key === 'Enter') respond(requestId, true)
        if (event.key === 'Escape') respond(requestId, false)
    }
</script>

{#each $pendingPermissions as request (request.requestId)}
    <div 
        class="permission-dialog" 
        role="dialog"
        on:keydown={(e) => handleKeydown(e, request.requestId)}
    >
        <h3>Permission Required</h3>
        <p>Agent wants to use <strong>{request.toolName}</strong></p>
        
        <pre class="input-preview">{JSON.stringify(request.input, null, 2)}</pre>
        
        <div class="actions">
            <button class="deny" on:click={() => respond(request.requestId, false)}>
                Deny (Esc)
            </button>
            <button class="approve" on:click={() => respond(request.requestId, true)}>
                Approve (Enter)
            </button>
        </div>
        
        <label class="always-allow">
            <input type="checkbox" /> Always allow {request.toolName}
        </label>
    </div>
{/each}
```

### 9.8 Bun Server Implementation

```typescript
// apps/server/src/routes/agent.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { createAgentRuntime } from 'buff-agents'
import type { AgentEvent } from '@buff-agents/protocol'

const app = new Hono()

// Active SSE connections per runId
const connections = new Map<string, Set<(event: AgentEvent) => void>>()

// Permission request/response coordination
const pendingPermissions = new Map<string, {
    resolve: (allowed: boolean) => void
    reject: (error: Error) => void
}>()

app.post('/api/agent/run', async (c) => {
    const { agentId, prompt, permissionMode } = await c.req.json()
    const runId = crypto.randomUUID()
    
    // Start agent in background
    runAgent(runId, agentId, prompt, permissionMode)
    
    return c.json({ runId })
})

app.get('/api/agent/stream', (c) => {
    const runId = c.req.query('runId')
    if (!runId) return c.text('Missing runId', 400)
    
    return streamSSE(c, async (stream) => {
        const send = (event: AgentEvent) => {
            stream.writeSSE({ data: JSON.stringify(event) })
        }
        
        // Register this connection
        if (!connections.has(runId)) connections.set(runId, new Set())
        connections.get(runId)!.add(send)
        
        // Keep alive until client disconnects
        await new Promise((resolve) => {
            c.req.raw.signal.addEventListener('abort', resolve)
        })
        
        connections.get(runId)?.delete(send)
    })
})

app.post('/api/agent/respond', async (c) => {
    const { requestId, allowed } = await c.req.json()
    
    const pending = pendingPermissions.get(requestId)
    if (pending) {
        pending.resolve(allowed)
        pendingPermissions.delete(requestId)
    }
    
    return c.json({ ok: true })
})

async function runAgent(runId: string, agentId: string, prompt: string, permissionMode: string) {
    const broadcast = (event: AgentEvent) => {
        connections.get(runId)?.forEach(send => send(event))
    }
    
    const runtime = createAgentRuntime({
        // ... config
        onEvent: (event) => {
            // Map buff-agents events to protocol events
            broadcast(mapToProtocolEvent(event, runId))
        },
        hooks: permissionMode === 'interactive' ? {
            async preToolUse(toolName, input) {
                const requestId = crypto.randomUUID()
                
                broadcast({
                    type: 'permission_request',
                    requestId,
                    toolName,
                    input
                })
                
                // Wait for user response
                const allowed = await new Promise<boolean>((resolve, reject) => {
                    pendingPermissions.set(requestId, { resolve, reject })
                    
                    // Timeout after 5 minutes
                    setTimeout(() => {
                        pendingPermissions.delete(requestId)
                        reject(new Error('Permission request timed out'))
                    }, 5 * 60 * 1000)
                })
                
                broadcast({
                    type: 'permission_response',
                    requestId,
                    allowed
                })
                
                return allowed ? { action: 'allow' } : { action: 'block', reason: 'User denied' }
            }
        } : undefined
    })
    
    await runtime.run({ agent: getAgent(agentId), prompt })
}

export default app
```

### 9.9 Tool Call Visualization

```svelte
<!-- apps/ui/src/lib/components/ToolCallCard.svelte -->
<script lang="ts">
    import { events } from '$lib/stores/events'
    import { derived } from 'svelte/store'
    
    export let toolCallId: string
    
    const toolCall = derived(events, ($events) => {
        const start = $events.find(
            e => e.type === 'tool_start' && e.toolCallId === toolCallId
        )
        const result = $events.find(
            e => e.type === 'tool_result' && e.toolCallId === toolCallId
        )
        
        return start ? {
            name: start.toolName,
            input: start.input,
            result: result?.result,
            success: result?.success,
            isComplete: !!result
        } : null
    })
</script>

{#if $toolCall}
    <div class="tool-card" class:success={$toolCall.success} class:error={$toolCall.success === false}>
        <div class="header">
            <span class="icon">🔧</span>
            <span class="name">{$toolCall.name}</span>
            {#if !$toolCall.isComplete}
                <span class="spinner">⏳</span>
            {:else if $toolCall.success}
                <span class="status">✓</span>
            {:else}
                <span class="status error">✗</span>
            {/if}
        </div>
        
        <details>
            <summary>Input</summary>
            <pre>{JSON.stringify($toolCall.input, null, 2)}</pre>
        </details>
        
        {#if $toolCall.result}
            <details open>
                <summary>Result</summary>
                <pre>{JSON.stringify($toolCall.result, null, 2)}</pre>
            </details>
        {/if}
    </div>
{/if}
```

### 9.10 Trace Timeline Component

```svelte
<!-- apps/ui/src/lib/components/TraceTimeline.svelte -->
<script lang="ts">
    import { events } from '$lib/stores/events'
    
    const timelineEvents = $derived(
        $events.map((e, i) => ({
            ...e,
            index: i,
            relativeTime: i === 0 ? 0 : 
                (e.timestamp ?? Date.now()) - ($events[0].timestamp ?? Date.now())
        }))
    )
</script>

<div class="timeline">
    {#each timelineEvents as event (event.index)}
        <div class="event" data-type={event.type}>
            <span class="time">{event.relativeTime}ms</span>
            <span class="type">{event.type}</span>
            <span class="preview">
                {#if event.type === 'text_delta'}
                    "{event.delta.slice(0, 30)}..."
                {:else if event.type === 'tool_start'}
                    {event.toolName}
                {:else if event.type === 'run_complete'}
                    Cost: ${event.cost.toFixed(4)}
                {/if}
            </span>
        </div>
    {/each}
</div>
```

### 9.11 Package Structure

```
buff-agents/
├── packages/
│   ├── core/              # Existing buff-agents core
│   ├── protocol/          # Shared event types (NEW)
│   │   ├── src/
│   │   │   └── events.ts
│   │   └── package.json
│   └── server/            # Bun server adapter (NEW)
│       ├── src/
│       │   ├── index.ts
│       │   └── routes/
│       └── package.json
├── apps/
│   └── ui/                # SvelteKit app (NEW)
│       ├── src/
│       ├── svelte.config.js
│       └── package.json
└── package.json           # Workspace root
```

### 9.12 Development Commands

```bash
# Install dependencies (Bun workspace)
bun install

# Dev mode (runs both server and UI)
bun run dev

# Build for production
bun run build

# Run server only
bun run --filter @buff-agents/server dev

# Run UI only
bun run --filter @buff-agents/ui dev
```

### 9.13 Key Benefits of This Architecture

| Benefit | Description |
|---------|-------------|
| **Protocol-first** | Event types are shared, enabling CLI/web/mobile clients |
| **Streaming-native** | SSE provides real-time updates without polling |
| **Interactive permissions** | Hooks pause execution until user responds |
| **Svelte reactivity** | Derived stores automatically update UI on new events |
| **Bun performance** | Fast server startup, native TypeScript, efficient SSE |
| **Type safety** | Shared protocol package ensures client/server alignment |

---

## References

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart)
- [Agent SDK Sessions](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Agent SDK Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Agent SDK MCP](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [AG-UI Protocol Blog Post](https://blog.logrocket.com/build-real-ai-with-ag-ui/)
- [buff-agents ROADMAP-2026](./ROADMAP-2026.md)
