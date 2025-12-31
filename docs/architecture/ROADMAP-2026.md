# Roadmap to "Best-in-Class" Agent Framework

Based on a deep architectural review, here is the prioritized plan to elevate this framework from a functional prototype to a production-grade system.

## 1. Core Abstractions & Decoupling (High Priority)
**Problem:** The `PromptGenerator` is hardcoded to Anthropic, and the `Runtime` is tightly coupled to in-memory state.
**Goal:** strict provider agnosticism and robust state management.

- [ ] **Refactor `PromptGenerator`**:
  - Remove direct `Anthropic` SDK dependency.
  - Inject `LLMRegistry` into `PromptGenerator`.
  - Use the standard `provider.complete()` interface for generation.
  - *Benefit:* Generate prompts using OpenAI o1, DeepSeek, or local Llama models.

- [ ] **State Persistence Engine**:
  - Introduce `StateStore` interface (Adapter pattern).
  - Implement `FileStateStore` (JSON/SQLite) and `RedisStateStore`.
  - Update `step-loop` to checkpoint state after every tool execution.
  - *Benefit:* Crash recovery. Agents can "sleep" and resume days later.

## 2. Security & Sandboxing (Critical)
**Problem:** `run_terminal_command` executes directly on the host shell. Permission checks are regex-based and bypassable.
**Goal:** Safe execution by default.

- [ ] **Sandbox Interface**:
  - Create `ExecutionEnvironment` interface.
  - Implement `LocalHostEnvironment` (Legacy/Dev).
  - Implement `DockerEnvironment` (Production/Safe).
- [ ] **Structured Permissions**:
  - Replace regex path sniffing with strict capability tokens.
  - Enforce `read-only` vs `read-write` at the file system adapter level, not just the tool level.

## 3. Advanced Memory & RAG (Intelligence)
**Problem:** Agents have short-term memory (context window) but zero long-term retention.
**Goal:** Infinite memory capacity.

- [ ] **Vector Memory Integration**:
  - Add `VectorStore` interface.
  - Implement adapters for `pgvector` or simple local `LanceDB`.
- [ ] **New Tools**:
  - `save_knowledge`: Store semantic chunks.
  - `query_knowledge`: Semantic search over stored facts/docs.
  - *Benefit:* Agents can "learn" project guidelines and recall them across sessions.

## 4. Observability & Debugging
**Problem:** Hard to understand *why* an agent failed without tailing raw logs.

- [ ] **OpenTelemetry Integration**:
  - Replace custom `Tracer` with OpenTelemetry spans.
  - Trace every LLM call, tool execution, and state change.
- [ ] **Replay Mechanism**:
  - Ability to load a saved state/trace and "replay" it with a debugger to see exactly where logic diverged.

## 5. Testing & Evaluation
**Problem:** Benchmarks exist but are limited.

- [ ] **Evals Framework**:
  - Add "Golden Dataset" support (Input -> Expected Output).
  - Automated grading using a "Judge" LLM (LLM-as-a-Judge).
  - *Benefit:* Confidence to refactor prompt engineering without regression.
