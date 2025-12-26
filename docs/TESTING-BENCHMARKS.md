# Coding Agent Test Benches for buff-agents

This document provides comprehensive guidance on benchmarking and evaluating buff-agents using industry-standard coding agent test benches.

## Overview

Benchmarking autonomous coding agents is essential for:
- **Measuring capability**: Quantify how well agents solve real-world coding tasks
- **Comparing models**: Evaluate different LLM providers (Anthropic, OpenAI, xAI, etc.)
- **Tracking progress**: Monitor improvements across versions
- **Identifying weaknesses**: Find failure modes in tool use, reasoning, or code generation

The gold standard for coding agent evaluation is **SWE-bench**, which tests agents on real GitHub issues from popular open-source projects.

---

## SWE-bench (Primary Recommendation)

SWE-bench evaluates coding agents on real-world GitHub issues, providing the full codebase, issue description, and held-out tests to verify fixes.

### Variants

| Variant | Tasks | Description | Recommended For |
|---------|-------|-------------|-----------------|
| **Lite** | ~300 | Smaller subset for quick iteration | Development & debugging |
| **Full** | 2,294 | All issues from 12 repos | Comprehensive evaluation |
| **Verified** | 500 | Human-verified test suites | Authoritative benchmarking |

### Installation

```bash
# Clone the repository
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench

# Install dependencies (Python 3.10+ required)
pip install -e .

# Verify installation
python -c "import swebench; print('SWE-bench installed')"
```

### Docker Requirements

SWE-bench uses Docker for reproducible evaluation environments:

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Architecture | x86_64 | x86_64 |
| Storage | 120GB | 500GB+ (for caching) |
| RAM | 16GB | 32GB+ |
| CPU Cores | 8 | 16+ |

```bash
# Install Docker (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install docker.io
sudo usermod -aG docker $USER

# Verify Docker
docker run hello-world
```

### Building Docker Images

```bash
# Generate Dockerfiles for tasks
python run_dockerfile_generator.py \
    --swe_bench_tasks /path/to/swe_bench_lite.jsonl \
    --namespace your_namespace \
    --docker_dir /path/to/output_dir

# Build all images
scripts/build_docker_images.sh /path/to/docker_dir your_namespace

# Or use prebuilt images (recommended)
# Set pull_remote_images_if_available=True in eval config
```

### Running Evaluation

```bash
# Run evaluation on predictions
python swe_bench/eval.py \
    --predictions /path/to/predictions.jsonl \
    --test_output_dir /path/to/output

# With Docker sandbox
python swe_bench/eval.py \
    --predictions predictions.jsonl \
    --sandbox_type docker \
    --build_docker_images True
```

### Output Format

Predictions must be in JSONL format:

```json
{
    "instance_id": "django__django-12345",
    "model_name_or_path": "buff-agents/simple-editor",
    "model_patch": "diff --git a/file.py b/file.py\n..."
}
```

Results include:
- **pass@1**: Primary metric - percentage of tasks where tests pass after applying the patch
- **Test logs**: Detailed output for debugging failures

---

## Aider Benchmark

Aider's benchmark evaluates LLMs on polyglot coding tasks using Exercism exercises.

### Features

- **133 Exercism exercises** across multiple languages
- **Edit format testing**: Measures diff/whole-file compliance
- **Cost tracking**: Reports API costs per run
- **Architect mode**: Multi-agent planner + editor workflows

### Installation

```bash
# Clone Aider repository
git clone https://github.com/paul-gauthier/aider.git
cd aider

# Build Docker container
./benchmark/docker_build.sh

# Launch container
./benchmark/docker.sh

# Inside container
pip install -e .[dev]
```

### Running Benchmarks

```bash
# Basic run
./benchmark/benchmark.py my-run \
    --model openai/gpt-4o \
    --edit-format diff \
    --threads 4 \
    --exercises-dir polyglot-benchmark

# Architect mode (planner + editor)
./benchmark/benchmark.py my-run \
    --architect \
    --model anthropic/claude-sonnet-4-20250514 \
    --editor-model openai/gpt-4o-mini \
    --threads 4
```

### Metrics

- **Percent Correct**: Tasks completed successfully
- **Edit Format Compliance**: Proper diff/whole-file formatting
- **Cost**: Total API spend

---

## HumanEval and MBPP

Simpler benchmarks for baseline code generation testing.

### HumanEval

164 Python programming problems measuring functional correctness.

```bash
# Install
pip install human-eval

# Run evaluation
python -m human_eval.evaluate \
    --sample_file samples.jsonl \
    --k 1
```

Sample format:
```json
{"task_id": "HumanEval/0", "completion": "def solution():\n    return 42"}
```

### MBPP (Mostly Basic Python Problems)

974 beginner-level Python tasks.

```bash
# Load via Hugging Face
pip install datasets

# In Python
from datasets import load_dataset
mbpp = load_dataset("mbpp")
```

---

## Other Benchmarks

| Benchmark | Focus | Setup |
|-----------|-------|-------|
| **CodeContests** | Competitive programming (AtCoder) | Hugging Face datasets |
| **APPS** | 5k+ advanced problems | `pip install apps` |
| **LiveCodeBench** | Recent LeetCode (avoids contamination) | Similar to HumanEval |
| **OpenHands** | Agentic workflows | github.com/AllHandsAI/OpenHands |

---

## Integrating buff-agents with SWE-bench

### Example Integration Script

Create `scripts/swebench-eval.ts`:

```typescript
import { loadConfig } from '@/config'
import { createLLMRegistry } from '@/llm'
import { ToolRegistry } from '@/tools'
import { builtinTools } from '@/tools/builtin'
import { createAgentRuntime } from '@/runtime'
import { simpleEditor } from '@/agents'
import { createLogger } from '@/utils'
import * as fs from 'fs'
import * as readline from 'readline'

interface SWEBenchTask {
    instance_id: string
    repo: string
    base_commit: string
    problem_statement: string
    hints_text?: string
}

interface Prediction {
    instance_id: string
    model_name_or_path: string
    model_patch: string
}

async function loadTasks(taskFile: string): Promise<SWEBenchTask[]> {
    const tasks: SWEBenchTask[] = []
    const fileStream = fs.createReadStream(taskFile)
    const rl = readline.createInterface({ input: fileStream })
    
    for await (const line of rl) {
        if (line.trim()) {
            tasks.push(JSON.parse(line))
        }
    }
    return tasks
}

async function runAgent(task: SWEBenchTask): Promise<string> {
    const config = await loadConfig()
    const anthropicKey = config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
    
    const llmRegistry = await createLLMRegistry({
        anthropic: anthropicKey ? { apiKey: anthropicKey } : undefined,
    })
    
    const toolRegistry = new ToolRegistry()
    toolRegistry.registerAll(builtinTools)
    
    const logger = createLogger({ level: 'info' })
    
    const runtime = createAgentRuntime({
        llmRegistry,
        toolRegistry,
        projectContext: {
            projectRoot: `/tmp/swebench/${task.instance_id}`,
            cwd: `/tmp/swebench/${task.instance_id}`,
        },
        logger,
        maxSteps: 30,
    })
    
    const prompt = `Fix this GitHub issue in ${task.repo}:

${task.problem_statement}

${task.hints_text ? `Hints: ${task.hints_text}` : ''}

Generate a patch that fixes this issue. Output the changes as a unified diff.`
    
    const result = await runtime.run({
        agent: simpleEditor,
        prompt,
    })
    
    return result.output.data?.patch ?? result.output.message
}

async function main() {
    const taskFile = process.argv[2] ?? 'swe_bench_lite.jsonl'
    const outputFile = process.argv[3] ?? 'predictions.jsonl'
    
    console.log(`Loading tasks from ${taskFile}...`)
    const tasks = await loadTasks(taskFile)
    console.log(`Loaded ${tasks.length} tasks`)
    
    const predictions: Prediction[] = []
    
    for (const task of tasks) {
        console.log(`\nProcessing ${task.instance_id}...`)
        try {
            const patch = await runAgent(task)
            predictions.push({
                instance_id: task.instance_id,
                model_name_or_path: 'buff-agents/simple-editor',
                model_patch: patch,
            })
        } catch (error) {
            console.error(`Failed on ${task.instance_id}:`, error)
            predictions.push({
                instance_id: task.instance_id,
                model_name_or_path: 'buff-agents/simple-editor',
                model_patch: '',
            })
        }
    }
    
    // Write predictions
    const output = predictions.map(p => JSON.stringify(p)).join('\n')
    fs.writeFileSync(outputFile, output)
    console.log(`\nWrote ${predictions.length} predictions to ${outputFile}`)
}

main().catch(console.error)
```

### Running the Integration

```bash
# 1. Clone SWE-bench and get task file
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench

# 2. Download Lite dataset
wget https://raw.githubusercontent.com/princeton-nlp/SWE-bench/main/swe_bench_lite.jsonl

# 3. Run buff-agents evaluation
cd /path/to/buff-agents
npx tsx scripts/swebench-eval.ts ../SWE-bench/swe_bench_lite.jsonl predictions.jsonl

# 4. Evaluate results
cd ../SWE-bench
python swe_bench/eval.py --predictions ../buff-agents/predictions.jsonl
```

---

## Best Practices

### Isolation & Reproducibility
- **Always use Docker** for SWE-bench evaluation
- Pin dependency versions in your agent
- Use deterministic sampling (temperature=0) for reproducible results

### Efficient Iteration
- **Start with Lite/Verified** subsets before full evaluation
- Cache Docker images to avoid rebuilding
- Parallelize via CI (GitHub Actions, TeamCity)

### Metrics & Logging
- Track **pass@1** as primary metric
- Log all tool calls and LLM responses for debugging
- Monitor costs per task
- Track iteration count and time per task

### Debugging Failures
- Review test logs for specific failure reasons
- Check for environment/dependency issues
- Analyze agent traces to identify reasoning failures
- Compare against golden patches for insight

---

## Quick Start: buff-agents on SWE-bench Lite

```bash
# 1. Setup
git clone https://github.com/princeton-nlp/SWE-bench.git
cd SWE-bench && pip install -e .

# 2. Get Lite dataset
python -c "from swebench import get_eval_refs; refs = get_eval_refs('lite'); print(f'Loaded {len(refs)} tasks')"

# 3. Run buff-agents (from buff-agents directory)
export ANTHROPIC_API_KEY=sk-ant-...
npx tsx scripts/swebench-eval.ts swe_bench_lite.jsonl predictions.jsonl

# 4. Evaluate
python swe_bench/eval.py \
    --predictions predictions.jsonl \
    --sandbox_type docker

# 5. View results
cat evaluation_results/results.json | jq '.resolved_instances | length'
```

---

## Resources

- **SWE-bench**: https://swebench.com / https://github.com/princeton-nlp/SWE-bench
- **Aider Benchmark**: https://aider.chat/docs/leaderboards/
- **HumanEval**: https://github.com/openai/human-eval
- **MBPP**: https://huggingface.co/datasets/mbpp
- **OpenHands**: https://github.com/AllHandsAI/OpenHands

---

*Last updated: December 2024*
