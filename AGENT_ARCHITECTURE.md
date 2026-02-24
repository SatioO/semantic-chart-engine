# Agentic Data Agent Architecture

## Overview

This document describes the advanced agentic data agent system being implemented to transform the semantic chart engine from a linear prompt-based system into a self-learning, self-correcting, multi-step reasoning agent.

## Implemented Components (Phase 1 - Foundation)

### 1. Type System ✅
**File**: `src/types/agent.types.ts`

Comprehensive type definitions for the entire agentic system:
- `AgentConfig` - Configuration for agent behavior
- `AgentResponse` - Rich response with reasoning trace
- `ExecutionStep` - Individual execution steps
- `Issue` & `Correction` - Problem detection and fixing
- `ReasoningStep` - Thought process tracking
- `Learning` & `Pattern` - Memory system types
- `ToolInput/Output` - Tool system interfaces

### 2. Agent State Management ✅
**File**: `src/agents/AgentState.ts`

Manages evolving state during execution:
- Tracks steps, learnings, reasoning
- Monitors confidence and issues
- Enforces iteration and timeout limits
- Provides rich state inspection

### 3. Memory System ✅
**Files**:
- `src/agents/memory/PatternMemory.ts` - Learns from successes/failures
- `src/agents/memory/ConversationMemory.ts` - Retains conversation context
- `src/agents/memory/MemoryManager.ts` - Unified memory access

Key Features:
- Semantic similarity matching for pattern recall
- Frequency-based pattern prioritization
- Success and failure pattern tracking
- Session-based conversation history

## Remaining Components (In Progress)

### 4. Tool System 🔄
**Files to Create**:
- `src/agents/tools/IAgentTool.ts` - Tool interface
- `src/agents/tools/DataSourceTool.ts` - Wraps identifyDataSources
- `src/agents/tools/VisualizationTool.ts` - Wraps orchestrateVisualization
- `src/agents/tools/DataValidationTool.ts` - Validates data quality
- `src/agents/tools/QueryDecompositionTool.ts` - Breaks down complex queries

### 5. Executors 🔄
**Files to Create**:
- `src/agents/executors/IExecutor.ts` - Executor interface
- `src/agents/executors/SinglePassExecutor.ts` - Backward compatible (current behavior)
- `src/agents/executors/MultiStepExecutor.ts` - Multi-step query handling
- `src/agents/executors/ReasoningExecutor.ts` - Self-correcting loop

### 6. Evaluators 🔄
**Files to Create**:
- `src/agents/evaluators/IEvaluator.ts` - Evaluator interface
- `src/agents/evaluators/DataQualityEvaluator.ts` - Checks for zero rows, bad data
- `src/agents/evaluators/RelevanceEvaluator.ts` - Validates relevance
- `src/agents/evaluators/CompletenessEvaluator.ts` - Checks completeness

### 7. Main Agent Orchestrator 🔄
**File to Create**: `src/agents/DataAgent.ts`

Core orchestrator that:
- Selects appropriate executor based on query complexity
- Manages execution loop
- Coordinates tools and memory
- Returns enriched responses

### 8. Service Wrapper 🔄
**File to Create**: `src/services/AgentService.ts`

Provides backward-compatible interface:
- Wraps DataAgent
- Maintains existing API signatures
- Enables gradual migration

### 9. New API Endpoint 🔄
**File to Modify**: `src/routes/platforms.routes.ts`

Add new endpoint:
```typescript
POST /api/platforms/:platformId/agent-query
```

Returns enriched response with reasoning trace.

## Architecture Diagram

```
User Query
    ↓
AgentService (API Layer)
    ↓
DataAgent (Orchestrator)
    ↓
┌─────────────────────────────────────┐
│  Select Executor Based on Complexity │
│  - Simple → SinglePassExecutor       │
│  - Complex → MultiStepExecutor       │
│  - Very Complex → ReasoningExecutor  │
└─────────────────────────────────────┘
    ↓
Executor Runs Loop:
    1. Plan (using Memory)
    2. Execute (using Tools)
    3. Evaluate (using Evaluators)
    4. Learn (update Memory)
    5. Correct if needed
    6. Repeat or Complete
    ↓
AgentResponse with:
    - Visualizations
    - Reasoning Trace
    - Learnings
    - Corrections
```

## Key Features

### 1. Self-Evaluation
- Every step is evaluated for quality
- Detects: zero rows, missing data, irrelevant results
- Confidence scoring

### 2. Self-Correction
- Automatic retry with adjustments when issues detected
- Learns from corrections for future queries
- Multiple correction strategies

### 3. Multi-Step Analysis
- Breaks complex queries into sequential steps
- Handles dependencies between steps
- Synthesizes results from multiple data sources

### 4. Continuous Learning
- Pattern memory stores successful approaches
- Failure patterns guide future executions
- Similarity matching recalls relevant learnings

### 5. Backward Compatibility
- Existing `/userquery` endpoint unchanged
- New `/agent-query` endpoint opt-in
- SinglePassExecutor mirrors current behavior

## Usage Example

### Simple Query (Backward Compatible)
```typescript
POST /api/platforms/3danalytics/userquery
{
  "query": "Show me revenue for startups"
}

// Uses SinglePassExecutor
// Returns standard visualization response
```

### Complex Query (New Agentic)
```typescript
POST /api/platforms/3danalytics/agent-query
{
  "query": "Which NYC taxi ZIP pairs have the largest gap between typical and worst-case travel times?",
  "config": {
    "enableSelfCorrection": true,
    "verboseLogging": true
  }
}

// Uses ReasoningExecutor
// Returns enriched response:
{
  "finalAnswer": "...",
  "visualizations": [...],
  "reasoningTrace": [
    {
      "step": 1,
      "thought": "Need to decompose this into steps",
      "action": "Use QueryDecompositionTool",
      "observation": "Identified 5 sequential steps",
      "evaluation": "Complete decomposition"
    },
    // ... more steps
  ],
  "corrections": [
    {
      "issue": {
        "type": "zero_rows",
        "description": "Sparse data for rare ZIP pairs"
      },
      "action": "Filter to ZIP pairs with >= 10 trips",
      "result": "success"
    }
  ],
  "confidence": 0.85,
  "meta": {
    "iterations": 3,
    "executionTime": 2500
  }
}
```

## Configuration

```typescript
interface AgentConfig {
  maxIterations: number;        // Max reasoning loops (default: 5)
  minConfidence: number;         // Min confidence to accept (default: 0.7)
  enableLearning: boolean;       // Store learnings (default: true)
  enableSelfCorrection: boolean; // Retry on errors (default: true)
  verboseLogging: boolean;       // Detailed logs (default: false)
  timeoutMs: number;             // Max execution time (default: 60000)
}
```

## Implementation Status

- ✅ Phase 1: Foundation (Types, State, Memory) - **COMPLETE**
- 🔄 Phase 2: Tools & Executors - **IN PROGRESS**
- ⏳ Phase 3: Evaluators & Main Agent - **PENDING**
- ⏳ Phase 4: Service Integration - **PENDING**
- ⏳ Phase 5: Testing & Documentation - **PENDING**

## Next Steps

1. Complete tool system implementation
2. Implement SinglePassExecutor (mirrors current behavior)
3. Create DataAgent orchestrator
4. Add AgentService wrapper
5. Integrate with routes
6. Comprehensive testing
7. Documentation and examples

## Benefits

1. **Better Answers**: Self-correction ensures high-quality results
2. **Complex Queries**: Handle multi-step analytical questions
3. **Learning**: Improves over time from successes and failures
4. **Transparency**: Full reasoning trace for explainability
5. **Reliability**: Detects and fixes common issues automatically
6. **Backward Compatible**: Existing functionality unchanged
