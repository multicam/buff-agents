# Buff-Agents Design Decisions Registry

**Date**: 2025-12-26  
**Status**: Decisions Locked - Ready for Implementation  
**Author**: Jean-Marc (with Claude/Qara)

---

## Purpose

This document captures all architectural decisions made during the design phase. Each decision includes:
- The question posed
- Options considered with pros/cons
- The chosen answer
- Impact analysis for changing the decision

**To revise a decision**: Update the "Current Answer" field and run the impact analysis to understand code changes required.

---

## Decision Index

| ID | Area | Decision | Impact Level |
|----|------|----------|--------------|
| Q1.1 | Core Architecture | Agent Definition Style | 🔴 High |
| Q1.2 | Core Architecture | Primary Integration Target | 🟡 Medium |
| Q1.3 | Core Architecture | Agent Identity Model | 🟡 Medium |
| Q1.4 | Core Architecture | Configuration Inheritance | 🟢 Low |
| Q2.1 | Tool System | Tool Definition Style | 🔴 High |
| Q2.2 | Tool System | Tool Result Complexity | 🟡 Medium |
| Q2.3 | Tool System | Tool Execution Model | 🟡 Medium |
| Q2.4 | Tool System | Cascade Integration Strategy | 🟡 Medium |
| Q2.5 | Tool System | Tool Isolation | 🟢 Low |
| Q2.6 | Tool System | Built-in vs Plugin Tools | 🟢 Low |
| Q3.1 | LLM Providers | Primary Abstraction Strategy | 🔴 High |
| Q3.2 | LLM Providers | Streaming Interface | 🟡 Medium |
| Q3.3 | LLM Providers | Default Provider Priority | 🟢 Low |
| Q3.4 | LLM Providers | Cost Tracking | 🟢 Low |
| Q3.5 | LLM Providers | Context Sharing | 🟢 Low |
| Q4.1 | Runtime | Message Management | 🟡 Medium |
| Q4.2 | Runtime | set_output Behavior | 🟢 Low |
| Q4.3 | Runtime | Error Handling | 🟡 Medium |
| Q4.4 | Runtime | Tool Execution Order | 🟡 Medium |
| Q4.5 | Runtime | State Mutability | 🔴 High |
| Q4.6 | Runtime | handleSteps Priority | 🔴 High |
| Q5.1 | Orchestration | spawn_agents Execution Model | 🟡 Medium |
| Q5.2 | Orchestration | Context Inheritance Default | 🟢 Low |
| Q5.3 | Orchestration | Result Aggregation | 🟡 Medium |
| Q5.4 | Orchestration | Sub-Agent Error Handling | 🟡 Medium |
| Q5.5 | Orchestration | Agent Registry | 🟡 Medium |
| Q5.6 | Orchestration | Cascade Sub-Agent Visibility | 🟢 Low |
| Q6.1 | Integration | MCP Tool Exposure Strategy | 🟡 Medium |
| Q6.2 | Integration | CLI Mode | 🟢 Low |
| Q6.3 | Integration | Configuration Approach | 🟢 Low |
| Q6.4 | Integration | MCP Transport | 🟢 Low |
| Q6.5 | Integration | Cascade-Specific Features | 🟢 Low |
| Q6.6 | Integration | Multi-Agent Support Priority | 🟢 Low |

**Impact Levels:**
- 🔴 **High**: Changes core abstractions, affects 50%+ of codebase
- 🟡 **Medium**: Changes significant module, affects 10-50% of codebase
- 🟢 **Low**: Localized change, affects <10% of codebase

---

## Section 1: Core Architecture & Agent Definition

### Q1.1: Agent Definition Style

**Question**: What is the "unit" of your agent library? How should agents be defined?

#### Options Considered

**Option A: Declarative Configuration (Codebuff's Approach)**
```typescript
const editor: AgentDefinition = {
    id: 'editor',
    model: 'anthropic/claude-sonnet-4',
    tools: ['read_files', 'write_file', 'str_replace'],
    systemPrompt: '...',
}
```
| Pros | Cons |
|------|------|
| Serializable (JSON, database, network) | Less flexible for complex logic |
| Easy to inspect, diff, version control | `handleSteps` breaks pure-data model |
| Runtime separate from definition | Harder to compose programmatically |
| Proven pattern (codebuff uses this) | |

**Option B: Class-Based Agents**
```typescript
class EditorAgent extends BaseAgent {
    id = 'editor'
    async onStep(context: StepContext): Promise<StepResult> { ... }
}
```
| Pros | Cons |
|------|------|
| Full OOP power (inheritance, polymorphism) | Not serializable |
| Natural place for complex logic | Harder to create dynamically |
| IDE autocomplete and refactoring | More boilerplate |
| Easier testing (mock methods) | |

**Option C: Functional Composition**
```typescript
const editor = createAgent({ id: 'editor', model: '...' })
    .withTools('read_files', 'write_file')
    .withSystemPrompt('...')
    .build()
```
| Pros | Cons |
|------|------|
| Fluent API, readable | More complex implementation |
| Composable (agent "mixins") | Learning curve |
| Type-safe builder pattern | |
| Best of both worlds | |

**Option D: Hybrid (Declarative + Class Wrapper)**
- Declarative core for data
- Optional class wrapper for behavior

#### Current Answer: **C - Functional Composition**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Declarative) | `src/core/agent-builder.ts`, all agent definitions in `src/agents/` | 3-5 days | Yes - all agent creation code |
| B (Class-Based) | `src/core/`, `src/agents/`, `src/runtime/` | 5-7 days | Yes - fundamental restructure |
| D (Hybrid) | `src/core/agent-builder.ts`, add class wrappers | 2-3 days | No - additive |

---

### Q1.2: Primary Integration Target

**Question**: Which coding agent integration is highest priority?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Claude Code** | MCP-first design, Anthropic's CLI |
| **B) Cascade/JetBrains** | IDE integration, deep tooling |
| **C) Standalone CLI** | Your own interface, full control |
| **D) Library-first** | Import and use in code, no CLI |

#### Current Answer: **B - Cascade/JetBrains**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Claude Code) | `src/mcp/` - minor adjustments | 1-2 days | No |
| C (Standalone CLI) | `src/cli/`, remove MCP priority | 2-3 days | No |
| D (Library-first) | Remove `src/cli/`, `src/mcp/` | 1-2 days | No - just removal |

---

### Q1.3: Agent Identity Model

**Question**: Should agents be singletons, instances, or factories?

#### Options Considered

| Option | Description | Example |
|--------|-------------|---------|
| **A) Singletons** | One `editor` agent globally | `import { editor } from 'buff-agents'` |
| **B) Instances** | Multiple instances with different configs | `new EditorAgent({ model: '...' })` |
| **C) Factories** | Definitions create instances on demand | `createEditor().run(prompt)` |

#### Current Answer: **C - Factories**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Singletons) | `src/agents/`, `src/runtime/` | 2-3 days | Yes - API changes |
| B (Instances) | `src/core/`, `src/agents/` | 3-4 days | Yes - API changes |

---

### Q1.4: Configuration Inheritance for Variants

**Question**: For agent variants (base2, base2-lite, base2-max), how to handle configuration?

#### Options Considered

| Option | Description | Example |
|--------|-------------|---------|
| **A) Factory function** | Function with options | `createBase2('lite', { noValidation: true })` |
| **B) Inheritance** | Class extends | `class Base2Lite extends Base2` |
| **C) Composition** | Spread operator | `{ ...base2, model: 'grok' }` |

#### Current Answer: **A - Factory function with options**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Inheritance) | `src/agents/base2/` | 1-2 days | No - internal |
| C (Composition) | `src/agents/base2/` | 1 day | No - internal |

---

## Section 2: Tool System Design

### Q2.1: Tool Definition Style

**Question**: How should tools be defined?

#### Options Considered

**Option A: Schema-First (JSON Schema + handler)**
```typescript
const readFiles: ToolDefinition = {
    name: 'read_files',
    description: 'Read multiple files',
    inputSchema: { type: 'object', properties: { paths: { type: 'array' } } },
    execute: async (ctx) => { ... }
}
```
| Pros | Cons |
|------|------|
| JSON Schema is universal | Verbose |
| Works with any LLM | Schema/types can drift |
| Easy to serialize for MCP | Runtime validation separate |
| Matches OpenAI/Anthropic format | |

**Option B: Zod-First (Type-Safe)**
```typescript
const readFiles = defineTool({
    name: 'read_files',
    input: z.object({ paths: z.array(z.string()) }),
    execute: async ({ input }) => { ... }
})
```
| Pros | Cons |
|------|------|
| Single source of truth | Zod dependency |
| Compile-time type safety | Slightly more complex |
| Runtime validation built-in | |
| Can convert to JSON Schema | |

**Option C: Decorator-Based**
```typescript
class FileTools {
    @Tool({ description: 'Read files' })
    async readFiles(@Param('paths') paths: string[]) { ... }
}
```
| Pros | Cons |
|------|------|
| Clean, minimal boilerplate | Requires experimental decorators |
| Familiar to Java/C# devs | Harder to compose |
| Types from signature | Not serializable |

#### Current Answer: **A - Schema-First**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Zod-First) | `src/tools/types.ts`, all `src/tools/builtin/*.ts` | 3-5 days | Yes - all tool definitions |
| C (Decorator) | Complete rewrite of `src/tools/` | 5-7 days | Yes - fundamental change |

---

### Q2.2: Tool Result Complexity

**Question**: What can tools return?

#### Options Considered

| Option | Description | Example |
|--------|-------------|---------|
| **A) Simple** | String or JSON only | `return { files: [...] }` |
| **B) Structured** | With metadata, side-effects | `return { output: {...}, sideEffects: [...] }` |
| **C) Configurable** | Simple default, opt-in structured | Both available |

#### Current Answer: **A - Simple (string/JSON)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Structured) | `src/tools/types.ts`, `src/tools/executor.ts`, all tools | 2-3 days | Yes - return types |
| C (Configurable) | `src/tools/types.ts`, `src/tools/executor.ts` | 1-2 days | No - additive |

---

### Q2.3: Tool Execution Model

**Question**: How should long-running tools (like terminal commands) execute?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Always block** | Wait until complete |
| **B) Background with polling** | `process_type: 'BACKGROUND'` |
| **C) Streaming output** | Real-time stdout/stderr |
| **D) All of the above** | Full flexibility |

#### Current Answer: **D - All of the above**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Block only) | `src/tools/builtin/run-terminal-command.ts` | 1 day | Yes - removes features |
| B (Background) | Same | 1 day | Yes - removes streaming |
| C (Streaming) | Same | 1 day | Yes - removes background |

---

### Q2.4: Cascade Integration Strategy

**Question**: How should the library integrate with Cascade?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) MCP Server only** | Simplest, works with Claude Code too |
| **B) IDE Plugin** | Deep integration, more work (Kotlin/Java) |
| **C) Hybrid MCP + CLI** | Flexible, recommended |

#### Current Answer: **C - Hybrid MCP + CLI**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (MCP only) | Remove `src/cli/` | 1 day | No - removal |
| B (IDE Plugin) | New Kotlin/Java project | 2-4 weeks | No - additive |

---

### Q2.5: Tool Isolation

**Question**: Should tools be sandboxed?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Full trust** | Access anything |
| **B) Sandboxed** | Restricted FS, network |
| **C) Configurable** | Permissions per-tool |

#### Current Answer: **C - Configurable permissions per-tool**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Full trust) | Remove permission checks from `src/tools/executor.ts` | 0.5 days | No |
| B (Sandboxed) | Add enforcement to `src/tools/executor.ts` | 2-3 days | No |

---

### Q2.6: Built-in vs Plugin Tools

**Question**: Should tools be built-in or plugins?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) All built-in** | Batteries included |
| **B) Core + plugins** | Essential built-in, extras as plugins |
| **C) Everything plugin** | Minimal core |

#### Current Answer: **A - Batteries included (all built-in)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Core + plugins) | Create plugin system, move tools | 3-5 days | Yes - API changes |
| C (All plugins) | Major restructure | 5-7 days | Yes - fundamental |

---

## Section 3: LLM Provider Abstraction

### Q3.1: Primary Abstraction Strategy

**Question**: How should LLM providers be abstracted?

#### Options Considered

**Option A: Thin Wrapper (Direct SDKs)**
- Each provider uses native SDK
- Full access to provider features
- Must maintain converters

**Option B: Vercel AI SDK**
- Battle-tested abstraction
- Handles streaming uniformly
- Less control, dependency on Vercel

**Option C: OpenRouter Only**
- Single API for all models
- Extra latency/cost
- Dependent on third party

**Option D: Hybrid (Direct + Fallback)**
- Direct SDKs for primary providers
- OpenRouter for others
- Best performance + universal fallback

#### Current Answer: **D - Hybrid (direct Anthropic/OpenAI + OpenRouter fallback)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Thin wrapper) | Remove OpenRouter from `src/llm/` | 1 day | No |
| B (Vercel AI SDK) | Rewrite `src/llm/providers/` | 3-5 days | No - internal |
| C (OpenRouter only) | Remove direct providers | 2 days | No - internal |

---

### Q3.2: Streaming Interface

**Question**: How should streaming be exposed?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) AsyncIterable** | Modern JS, composable |
| **B) Callbacks** | Simple, familiar |
| **C) EventEmitter** | Node.js style |
| **D) All with adapters** | Maximum flexibility |

#### Current Answer: **A - AsyncIterable**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Callbacks) | `src/llm/types.ts`, all providers, `src/runtime/step-loop.ts` | 2-3 days | Yes - API |
| C (EventEmitter) | Same | 2-3 days | Yes - API |
| D (All) | Add adapters | 1-2 days | No - additive |

---

### Q3.3: Default Provider Priority

**Question**: When model is ambiguous, which provider to prefer?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Direct Anthropic** | Fastest, requires key |
| **B) OpenRouter** | Universal, slower |
| **C) Error** | Require explicit prefix |

#### Current Answer: **A - Direct Anthropic API**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (OpenRouter) | `src/llm/registry.ts` | 0.5 days | No |
| C (Error) | `src/llm/registry.ts` | 0.5 days | Yes - stricter |

---

### Q3.4: Cost Tracking

**Question**: How should costs be tracked?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Built-in** | Maintain pricing table |
| **B) Fetch from APIs** | Always accurate, more calls |
| **C) Optional plugin** | Keep core simple |
| **D) Delegate to OpenRouter** | They track it |

#### Current Answer: **C - Optional plugin**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Built-in) | Add to `src/llm/`, pricing table | 1-2 days | No |
| B (Fetch) | Add API calls to providers | 2-3 days | No |
| D (OpenRouter) | Modify `src/llm/providers/openrouter.ts` | 1 day | No |

---

### Q3.5: Context Sharing with External Agents

**Question**: When running as MCP tool, should we inherit caller's context?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Always own LLM** | Isolated, predictable |
| **B) Inherit caller's context** | Complex, powerful |
| **C) Defer decision** | Design for A, leave door open |

#### Current Answer: **C - Defer (design for isolation, leave door open)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Always own) | No change needed | 0 days | No |
| B (Inherit) | `src/mcp/`, `src/runtime/` | 3-5 days | No - additive |

---

## Section 4: Agent Runtime & Step Loop

### Q4.1: Message Management

**Question**: How should conversation history be managed?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Append-only** | Simple, risk overflow |
| **B) Sliding window** | Fixed size, may lose context |
| **C) Smart truncation** | TTL tags, importance |
| **D) Context pruner agent** | Most sophisticated |

#### Current Answer: **C - Smart truncation with TTL tags**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Append-only) | Simplify `src/runtime/messages.ts` | 0.5 days | No |
| B (Sliding window) | Modify `src/runtime/messages.ts` | 1 day | No |
| D (Context pruner) | Add agent, modify runtime | 3-5 days | No - additive |

---

### Q4.2: set_output Behavior

**Question**: Should `set_output` end the agent's turn?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Ends turn** | Immediate completion |
| **B) Does NOT end turn** | Agent continues |
| **C) Configurable** | Per-agent setting |

#### Current Answer: **C - Configurable per-agent**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Always ends) | `src/runtime/step-loop.ts` | 0.5 days | Yes - behavior |
| B (Never ends) | `src/runtime/step-loop.ts` | 0.5 days | Yes - behavior |

---

### Q4.3: Error Handling

**Question**: How should tool/LLM errors be handled?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Fail fast** | Errors terminate run |
| **B) Retry with feedback** | LLM sees error, adapts |
| **C) Configurable retry policy** | Max retries, backoff |

#### Current Answer: **B - Retry with feedback (LLM sees errors)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Fail fast) | `src/tools/executor.ts`, `src/runtime/step-loop.ts` | 1 day | Yes - behavior |
| C (Retry policy) | Add retry logic | 1-2 days | No - additive |

---

### Q4.4: Tool Execution Order

**Question**: When LLM returns multiple tool calls, how to execute?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Always sequential** | Simple, predictable |
| **B) Always parallel** | Fast, may have issues |
| **C) Parallel default, sequential for specific** | Best of both |
| **D) LLM decides** | `depends_on` field |

#### Current Answer: **C - Parallel by default, sequential for specific tools**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Sequential) | `src/tools/executor.ts` | 0.5 days | No |
| B (Parallel) | `src/tools/executor.ts` | 0.5 days | No |
| D (LLM decides) | `src/tools/types.ts`, executor, LLM prompts | 2-3 days | Yes |

---

### Q4.5: State Mutability

**Question**: Should agent state be mutable or immutable?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Mutable** | Simple, modify in place |
| **B) Immutable** | Predictable, debuggable |
| **C) Immer-style** | Mutable syntax, immutable semantics |

#### Current Answer: **B - Immutable**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Mutable) | `src/core/types/agent-state.ts`, `src/runtime/` | 2-3 days | Yes - all state handling |
| C (Immer) | Add immer, modify state updates | 1-2 days | No - internal |

---

### Q4.6: handleSteps Priority

**Question**: How important is the programmatic step handler (generator pattern)?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Essential** | Phase 1 |
| **B) Important** | Phase 2 |
| **C) Nice-to-have** | Later |
| **D) Skip** | Not needed |

#### Current Answer: **A - Essential (Phase 1)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B/C (Defer) | Reorder implementation phases | 0 days | No |
| D (Skip) | Remove `src/runtime/programmatic-step.ts` | -1 day | Yes - feature removal |

---

## Section 5: Sub-Agent Orchestration

### Q5.1: spawn_agents Execution Model

**Question**: How should spawn_agents handle parallel vs sequential?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Simple** | Array = parallel, multiple calls = sequential |
| **B) Explicit flag** | `execution: 'parallel' \| 'sequential'` |
| **C) Dependency graph** | `depends_on: [...]` |

#### Current Answer: **A - Simple (array = parallel, multiple calls = sequential)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (Explicit flag) | `src/tools/builtin/spawn-agents.ts` | 1 day | Yes - API |
| C (Dependency graph) | Same + dependency resolver | 2-3 days | Yes - API |

---

### Q5.2: Context Inheritance Default

**Question**: What should sub-agents see from parent by default?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Full history** | Token-heavy |
| **B) Minimal (prompt only)** | Clean slate |
| **C) Configurable** | `includeMessageHistory` per-agent |

#### Current Answer: **C - Configurable per-agent**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Full history) | `src/tools/builtin/spawn-agents.ts` | 0.5 days | Yes - behavior |
| B (Minimal) | Same | 0.5 days | Yes - behavior |

---

### Q5.3: Result Aggregation

**Question**: How should sub-agent results flow back to parent?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Output only** | Simple |
| **B) Full conversation** | Complete history |
| **C) Streaming events** | Real-time |
| **D) All (configurable)** | Maximum flexibility |

#### Current Answer: **D - All of the above (configurable)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Output only) | Simplify `src/tools/builtin/spawn-agents.ts` | 0.5 days | Yes - removes features |
| B (Full conversation) | Same | 0.5 days | Yes - removes features |
| C (Streaming) | Same | 0.5 days | Yes - removes features |

---

### Q5.4: Sub-Agent Error Handling

**Question**: When a sub-agent fails, what happens?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Fail parent** | Any failure terminates |
| **B) Partial results** | Return successes + errors, parent decides |
| **C) Retry policy** | Automatic retry |

#### Current Answer: **B - Partial results (parent decides)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Fail parent) | `src/tools/builtin/spawn-agents.ts` | 0.5 days | Yes - behavior |
| C (Retry) | Add retry logic | 1-2 days | No - additive |

---

### Q5.5: Agent Registry

**Question**: How should agents be discovered and loaded?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Static** | Built-in only |
| **B) Dynamic directory** | Load from `.agents/` |
| **C) Remote registry** | Fetch from server |
| **D) Hybrid** | Built-in + local + remote |

#### Current Answer: **B - Dynamic from directory**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Static) | Simplify `src/agents/registry.ts` | 0.5 days | Yes - removes feature |
| C (Remote) | Add fetch logic | 2-3 days | No - additive |
| D (Hybrid) | Add remote to existing | 2-3 days | No - additive |

---

### Q5.6: Cascade Sub-Agent Visibility

**Question**: Should Cascade see sub-agent activity?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Opaque** | Final result only |
| **B) Transparent** | Stream sub-agent events |
| **C) Configurable** | Per-run setting |

#### Current Answer: **B - Transparent (stream sub-agent events)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Opaque) | Remove event streaming from `src/mcp/` | 0.5 days | No |
| C (Configurable) | Add flag | 0.5 days | No - additive |

---

## Section 6: Integration with External Coding Agents

### Q6.1: MCP Tool Exposure Strategy

**Question**: How should agents be exposed via MCP?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Single tool** | `buff_agents_run` for any agent |
| **B) Agent-per-tool** | Each agent is a separate tool |
| **C) Hybrid** | Orchestrator + primitives |

#### Current Answer: **C - Hybrid (orchestrator + primitives)**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Single tool) | Simplify `src/mcp/server.ts` | 0.5 days | Yes - MCP API |
| B (Agent-per-tool) | Modify `src/mcp/server.ts` | 1 day | Yes - MCP API |

---

### Q6.2: CLI Mode

**Question**: What CLI interface to provide?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Interactive REPL** | Continuous session |
| **B) Single command** | One-shot execution |
| **C) Both + server** | Full flexibility |

#### Current Answer: **B - Single command only**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (REPL) | Add REPL to `src/cli/` | 2-3 days | No - additive |
| C (Both + server) | Add REPL + serve command | 3-4 days | No - additive |

---

### Q6.3: Configuration Approach

**Question**: How should the library be configured?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Environment variables** | Simple |
| **B) Config file** | `.buff-agents.json` |
| **C) Both with precedence** | env > config > defaults |
| **D) Programmatic only** | No CLI config |

#### Current Answer: **B - Config file**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Env vars) | Modify `src/config/loader.ts` | 1 day | Yes - config format |
| C (Both) | Add env var support | 1 day | No - additive |
| D (Programmatic) | Remove `src/config/` | 0.5 days | Yes - removes feature |

---

### Q6.4: MCP Transport

**Question**: Which MCP transport to support?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) stdio only** | Simplest, works with Cascade |
| **B) HTTP/WebSocket** | More flexible |
| **C) Both** | Maximum compatibility |

#### Current Answer: **A - stdio only**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| B (HTTP/WS) | Add transport to `src/mcp/` | 2-3 days | No - additive |
| C (Both) | Same | 2-3 days | No - additive |

---

### Q6.5: Cascade-Specific Features

**Question**: Should we implement Cascade-specific optimizations?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) No** | Generic MCP only |
| **B) Yes** | Detect Cascade, enhance |
| **C) Optional plugin** | Cascade features as plugin |

#### Current Answer: **B - Yes, detect Cascade and enhance**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (No) | Remove detection from `src/mcp/` | 0.5 days | No |
| C (Plugin) | Extract to plugin | 1-2 days | No |

---

### Q6.6: Multi-Agent Support Priority

**Question**: Which external agents to support first?

#### Options Considered

| Option | Description |
|--------|-------------|
| **A) Cascade first** | Others later |
| **B) All three from start** | Cascade, Claude Code, Gemini |
| **C) Cascade + Claude Code** | Both use MCP, Gemini later |

#### Current Answer: **C - Cascade + Claude Code (both MCP), Gemini later**

#### Impact of Changing This Decision

| Change To | Files Affected | Effort | Breaking Changes |
|-----------|----------------|--------|------------------|
| A (Cascade only) | No change | 0 days | No |
| B (All three) | Add Gemini adapter | 3-5 days | No - additive |

---

## Appendix: Quick Reference

### All Decisions Summary

```yaml
# Section 1: Core Architecture
Q1.1_agent_definition_style: C  # Functional Composition
Q1.2_primary_integration: B      # Cascade/JetBrains
Q1.3_agent_identity: C           # Factories
Q1.4_config_inheritance: A       # Factory functions

# Section 2: Tool System
Q2.1_tool_definition: A          # Schema-First
Q2.2_tool_results: A             # Simple (string/JSON)
Q2.3_tool_execution: D           # All modes
Q2.4_cascade_integration: C      # Hybrid MCP + CLI
Q2.5_tool_isolation: C           # Configurable permissions
Q2.6_builtin_tools: A            # Batteries included

# Section 3: LLM Providers
Q3.1_llm_abstraction: D          # Hybrid (direct + OpenRouter)
Q3.2_streaming: A                # AsyncIterable
Q3.3_default_provider: A         # Direct Anthropic
Q3.4_cost_tracking: C            # Optional plugin
Q3.5_context_sharing: C          # Defer decision

# Section 4: Runtime
Q4.1_message_management: C       # Smart truncation
Q4.2_set_output_behavior: C      # Configurable
Q4.3_error_handling: B           # Retry with feedback
Q4.4_tool_order: C               # Parallel default, sequential specific
Q4.5_state_mutability: B         # Immutable
Q4.6_handle_steps: A             # Essential (Phase 1)

# Section 5: Orchestration
Q5.1_spawn_model: A              # Simple (array = parallel)
Q5.2_context_inheritance: C      # Configurable
Q5.3_result_aggregation: D       # All modes
Q5.4_subagent_errors: B          # Partial results
Q5.5_agent_registry: B           # Dynamic directory
Q5.6_cascade_visibility: B       # Transparent

# Section 6: Integration
Q6.1_mcp_exposure: C             # Hybrid (orchestrator + primitives)
Q6.2_cli_mode: B                 # Single command
Q6.3_configuration: B            # Config file
Q6.4_mcp_transport: A            # stdio only
Q6.5_cascade_features: B         # Detect and enhance
Q6.6_agent_priority: C           # Cascade + Claude Code
```

### High-Impact Decisions (🔴)

These decisions, if changed, require significant refactoring:

1. **Q1.1 Agent Definition Style** - Affects all agent creation code
2. **Q2.1 Tool Definition Style** - Affects all tool definitions
3. **Q3.1 LLM Abstraction Strategy** - Affects provider layer
4. **Q4.5 State Mutability** - Affects all state handling
5. **Q4.6 handleSteps Priority** - Affects runtime architecture

### Generating Impact Report

To generate an impact report for changing a decision:

1. Find the decision in this document
2. Look at the "Impact of Changing This Decision" table
3. For each file affected, estimate:
   - Lines of code to change
   - Tests to update
   - Documentation to revise
4. Sum up effort estimates
5. Identify breaking changes for downstream users

---

*Last updated: 2025-12-26*
