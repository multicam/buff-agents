#!/usr/bin/env bun
/**
 * Benchmark Runner Entry Point
 * 
 * Run with: bun run tests/bench/run.ts [options]
 * 
 * Options:
 *   --agents <ids>      Comma-separated agent IDs (default: simple-editor)
 *   --categories <cats> Comma-separated categories to run
 *   --difficulties <d>  Comma-separated difficulties to run
 *   --tasks <ids>       Comma-separated specific task IDs to run
 *   --output <dir>      Output directory for results
 *   --no-save           Don't save results to files
 *   --help              Show help
 * 
 * Examples:
 *   bun run tests/bench/run.ts
 *   bun run tests/bench/run.ts --agents simple-editor,openai-editor
 *   bun run tests/bench/run.ts --categories file-editing,bug-fixing
 *   bun run tests/bench/run.ts --difficulties easy,medium
 */

import { parseArgs } from 'util'
import { createBenchmarkRunner } from './runner'
import { createReporter } from './reporter'
import { createBenchmarkHistory } from './history'
import { compareBenchmarkResults } from './compare'
import { allTasks } from './tasks'
import {
    simpleEditor,
    orchestrator,
    fileExplorer,
    codeReviewer,
    openaiEditor,
    openrouterEditor,
    xaiEditor,
} from '@/agents'
import type { BenchmarkConfig, TaskCategory, TaskDifficulty } from './types'

// Parse command line arguments
const { values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
        agents: { type: 'string', default: 'simple-editor' },
        categories: { type: 'string' },
        difficulties: { type: 'string' },
        tasks: { type: 'string' },
        output: { type: 'string', default: 'tests/bench/results' },
        'no-save': { type: 'boolean', default: false },
        compare: { type: 'boolean', default: false },
        'compare-with': { type: 'string' },
        baseline: { type: 'string' },
        'save-baseline': { type: 'string' },
        'list-history': { type: 'boolean', default: false },
        'list-baselines': { type: 'boolean', default: false },
        'delete-baseline': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
    },
})

if (args.help) {
    console.log(`
Benchmark Runner for buff-agents

Usage: bun run tests/bench/run.ts [options]

Options:
  --agents <ids>        Comma-separated agent IDs to benchmark
                        Available: simple-editor, openai-editor, openrouter-editor,
                                   xai-editor, orchestrator, file-explorer, code-reviewer
                        Default: simple-editor

  --categories <cats>   Comma-separated task categories to run
                        Available: file-editing, code-search, multi-step, bug-fixing, code-generation
                        Default: all

  --difficulties <d>    Comma-separated difficulties to run
                        Available: easy, medium, hard
                        Default: all

  --tasks <ids>         Comma-separated specific task IDs to run
                        Default: all matching tasks

  --output <dir>        Output directory for results
                        Default: tests/bench/results

  --no-save             Don't save results to files

Comparison Options:
  --compare             Compare with the previous run
  --compare-with <id>   Compare with a specific run ID
  --baseline <name>     Compare with a named baseline
  --save-baseline <n>   Save current run as a named baseline

History Options:
  --list-history        List all historical runs and exit
  --list-baselines      List all saved baselines and exit
  --delete-baseline <n> Delete a named baseline

  --help, -h            Show this help message

Examples:
  # Run all tasks on simple-editor
  bun run tests/bench/run.ts

  # Run on multiple agents
  bun run tests/bench/run.ts --agents simple-editor,openai-editor

  # Run and compare with previous run
  bun run tests/bench/run.ts --compare

  # Run and compare with a baseline
  bun run tests/bench/run.ts --baseline v1.0

  # Run and save as a new baseline
  bun run tests/bench/run.ts --save-baseline v1.1

  # List historical runs
  bun run tests/bench/run.ts --list-history

  # List baselines
  bun run tests/bench/run.ts --list-baselines
`)
    process.exit(0)
}

// Available agents map
const availableAgents = {
    'simple-editor': simpleEditor,
    'openai-editor': openaiEditor,
    'openrouter-editor': openrouterEditor,
    'xai-editor': xaiEditor,
    'orchestrator': orchestrator,
    'file-explorer': fileExplorer,
    'code-reviewer': codeReviewer,
}

// Parse config from args
const config: BenchmarkConfig = {
    agents: args.agents?.split(',').map(s => s.trim()) ?? ['simple-editor'],
    categories: args.categories?.split(',').map(s => s.trim()) as TaskCategory[] | undefined,
    difficulties: args.difficulties?.split(',').map(s => s.trim()) as TaskDifficulty[] | undefined,
    taskIds: args.tasks?.split(',').map(s => s.trim()),
    outputDir: args.output,
    saveResults: !args['no-save'],
}

const history = createBenchmarkHistory()

async function main() {
    // Handle history listing commands
    if (args['list-history']) {
        await listHistory()
        return
    }

    if (args['list-baselines']) {
        await listBaselines()
        return
    }

    if (args['delete-baseline']) {
        await deleteBaseline(args['delete-baseline'])
        return
    }

    console.log('\n🔬 buff-agents Benchmark Suite\n')
    console.log('Configuration:')
    console.log(`  Agents: ${config.agents.join(', ')}`)
    console.log(`  Categories: ${config.categories?.join(', ') ?? 'all'}`)
    console.log(`  Difficulties: ${config.difficulties?.join(', ') ?? 'all'}`)
    console.log(`  Task IDs: ${config.taskIds?.join(', ') ?? 'all'}`)
    console.log(`  Output: ${config.outputDir}`)
    console.log(`  Save Results: ${config.saveResults}`)
    if (args.compare) console.log(`  Compare: with previous run`)
    if (args['compare-with']) console.log(`  Compare: with run ${args['compare-with']}`)
    if (args.baseline) console.log(`  Compare: with baseline "${args.baseline}"`)
    if (args['save-baseline']) console.log(`  Save Baseline: "${args['save-baseline']}"`)

    // Create runner
    const runner = createBenchmarkRunner(config)

    // Register agents
    for (const agentId of config.agents) {
        const agent = availableAgents[agentId as keyof typeof availableAgents]
        if (agent) {
            runner.registerAgent(agent)
        } else {
            console.warn(`⚠️  Unknown agent: ${agentId}`)
        }
    }

    // Register all tasks
    runner.registerTasks(allTasks)

    // Run benchmarks
    const results = await runner.run()

    // Get comparison baseline if requested
    let comparisonResult = undefined
    let previousResults = null

    if (args.baseline) {
        previousResults = await history.loadBaseline(args.baseline)
        if (!previousResults) {
            console.warn(`⚠️  Baseline "${args.baseline}" not found. Run without comparison.`)
        }
    } else if (args['compare-with']) {
        previousResults = await history.loadFromHistory(args['compare-with'])
        if (!previousResults) {
            console.warn(`⚠️  Run "${args['compare-with']}" not found in history. Run without comparison.`)
        }
    } else if (args.compare) {
        previousResults = await history.getPreviousRun()
        if (!previousResults) {
            console.warn(`⚠️  No previous run found in history. Run without comparison.`)
        }
    }

    if (previousResults) {
        comparisonResult = compareBenchmarkResults(previousResults, results)
    }

    // Report results
    const reporter = createReporter(results, comparisonResult)
    reporter.printSummary()

    // Save results if configured
    if (config.saveResults && config.outputDir) {
        await reporter.saveResults(config.outputDir)
    }

    // Save to history
    if (config.saveResults) {
        await history.saveToHistory(results)
        console.log(`\n📊 Results saved to history (run ID: ${results.runId.slice(0, 8)}...)`)
    }

    // Save as baseline if requested
    if (args['save-baseline']) {
        const baselinePath = await history.saveBaseline(results, args['save-baseline'])
        console.log(`\n📌 Saved as baseline "${args['save-baseline']}" (${baselinePath})`)
    }

    // Exit with appropriate code
    const passRate = results.overallSummary.overallPassRate
    if (passRate < 50) {
        process.exit(1)
    }
}

async function listHistory() {
    console.log('\n📜 Benchmark History\n')
    const entries = await history.listHistory(20)

    if (entries.length === 0) {
        console.log('  No historical runs found.')
        console.log('  Run benchmarks to create history.')
        return
    }

    console.log('  Run ID                              | Date                | Pass Rate | Tasks | Cost')
    console.log('  ' + '─'.repeat(90))

    for (const entry of entries) {
        const date = new Date(entry.startedAt).toLocaleString()
        const passRate = entry.passRate.toFixed(1).padStart(5) + '%'
        const tasks = `${entry.totalPassed}/${entry.totalTasks}`.padStart(7)
        const cost = `$${entry.totalCostUsd.toFixed(4)}`.padStart(10)
        console.log(`  ${entry.runId} | ${date.padEnd(19)} | ${passRate} | ${tasks} | ${cost}`)
    }

    console.log('')
    console.log(`  Total: ${entries.length} runs`)
    console.log('')
}

async function listBaselines() {
    console.log('\n📌 Saved Baselines\n')
    const baselines = await history.listBaselines()

    if (baselines.length === 0) {
        console.log('  No baselines saved.')
        console.log('  Use --save-baseline <name> to create one.')
        return
    }

    console.log('  Name                 | Created             | Pass Rate | Tasks')
    console.log('  ' + '─'.repeat(70))

    for (const baseline of baselines) {
        const name = baseline.name.padEnd(20)
        const date = new Date(baseline.createdAt).toLocaleString().padEnd(19)
        const passRate = baseline.passRate.toFixed(1).padStart(5) + '%'
        const tasks = String(baseline.totalTasks).padStart(5)
        console.log(`  ${name} | ${date} | ${passRate} | ${tasks}`)
    }

    console.log('')
    console.log(`  Total: ${baselines.length} baselines`)
    console.log('')
}

async function deleteBaseline(name: string) {
    const deleted = await history.deleteBaseline(name)
    if (deleted) {
        console.log(`\n✅ Baseline "${name}" deleted.\n`)
    } else {
        console.log(`\n❌ Baseline "${name}" not found.\n`)
        process.exit(1)
    }
}

main().catch(error => {
    console.error('\n❌ Benchmark failed:', error)
    process.exit(1)
})
