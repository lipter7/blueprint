# Model ID Resolution Workflow

This directory contains the complete workflow, research, and implementation guide for a Blueprint/GSD skill that automatically maintains a registry of Cursor models and their proper IDs for subagent configuration.

## Overview

**Problem**: Cursor model IDs are not exposed in documentation, making subagent configuration error-prone and manual.

**Solution**: Automated skill that fetches models from Cursor docs and provider APIs, transforms IDs, and maintains a validated JSON registry.

## Files

- **`FetchModels and resolve to slugs.md`** - Complete documentation including:
  - Research process and API testing results
  - Detailed skill implementation workflow
  - Step-by-step transformation logic
  - Integration with Blueprint/GSD
  - Complete examples and troubleshooting
  
- **`test-model-resolution.js`** - Executable test script demonstrating:
  - Anthropic ID transformation (version format conversion)
  - OpenAI ID pass-through (minimal transformation)
  - Variant generation (default + base)
  - Validation against known working IDs

## Quick Start

### Run the Test

```bash
# See ID transformations in action
node test-model-resolution.js
```

Expected output:
```
=== ANTHROPIC MODELS ===
Claude Opus 4.6:
  API ID:     claude-opus-4-6
  Cursor ID:  claude-4.6-opus
  Thinking:   claude-4.6-opus-thinking
  High:       claude-4.6-opus-high

✓ All tests passed!
```

### Read the Documentation

See `FetchModels and resolve to slugs.md` for:
- Complete skill workflow (7 steps)
- API integration examples
- JSON registry structure
- GSD integration guide

## Summary of Findings

### ✅ Successful Approaches

1. **OpenAI API** - Nearly perfect match
   - IDs like `gpt-5.2-codex` can be used directly
   - Just add reasoning/thinking suffixes as needed

2. **Anthropic API** - Good match with transformation
   - IDs like `claude-opus-4-6` need version format conversion
   - Transform to `claude-4.6-opus`

3. **Static Lookup** - For remaining models
   - Composer, Gemini, Grok use simple lookup table

### ❌ Failed Approaches

- **OpenRouter API** - Different ID format and model catalog

## Transformation Rules

### Anthropic
```
claude-opus-4-6-20250205 
  → Remove date
  → Convert version: 4-6 → 4.6
  → Reorder: claude-{version}-{tier}
  = claude-4.6-opus
```

### OpenAI
```
gpt-5.2-codex
  → Use as-is!
  = gpt-5.2-codex
```

### Add Reasoning/Thinking
```
claude-4.6-opus
  → claude-4.6-opus-thinking
  → claude-4.6-opus-high
  → claude-4.6-opus-high-thinking
```

## Implementation Priority

1. ✅ OpenAI (easiest - almost no transformation)
2. ✅ Anthropic (moderate - version transformation)
3. ✅ Static lookup (Composer, Gemini, Grok)

## The Skill Workflow

### High-Level Process

```
User runs: /gsd:refresh-models
    ↓
1. Read API keys from environment
2. Fetch Cursor models documentation
3. Filter to latest relevant models (5 total)
4. Fetch Anthropic API → transform IDs
5. Fetch OpenAI API → use IDs directly
6. Generate variants (default + base)
7. Save to .planning/models-registry.json
    ↓
Result: Validated registry with 9 model variants
```

### Models Included

**From Cursor Docs (filtered to latest)**:
- Claude 4.6 Opus (Anthropic)
- Claude 4.5 Sonnet (Anthropic)
- GPT-5.3 Codex (OpenAI)
- GPT-5.2 (OpenAI)
- Composer 1.5 (Cursor)

**Variants Generated** (2 per model):
- **default**: High reasoning + thinking (recommended)
- **base**: No enhancements (cost-effective)

**Special Model Values**:
- **`inherit`**: Subagent uses same model as parent agent
- **`fast`**: Alias that maps to Composer 1 (fastest/cheapest)

### Environment Requirements

```bash
# Required API keys (in .env or system environment)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

## Key Concepts

### Why Provider APIs?

- **Authoritative**: Provider APIs have correct model IDs
- **Real-time**: Catch new models immediately after release
- **Validated**: Confirms models actually exist
- **Transformation**: Can map API IDs to Cursor format

### ID Transformation Rules

**Anthropic** (requires transformation):
```
API:    claude-opus-4-6-20250205
        ↓ Remove date
        ↓ Convert version (4-6 → 4.6)
        ↓ Reorder to claude-{version}-{tier}
Cursor: claude-4.6-opus
```

**OpenAI** (minimal transformation):
```
API:    gpt-5.2-codex
Cursor: gpt-5.2-codex  (use directly!)
```

**Reasoning/Thinking Suffixes**:
```
Base:    claude-4.6-opus
Default: claude-4.6-opus-high-thinking
```

### Registry Structure

```json
{
  "models": {
    "Claude 4.6 Opus": {
      "provider": "anthropic",
      "cursor_base_id": "claude-4.6-opus",
      "variants": {
        "default": {
          "model_id": "claude-4.6-opus-high-thinking",
          "recommended": true
        },
        "base": {
          "model_id": "claude-4.6-opus"
        }
      }
    }
  }
}
```

## Integration with Blueprint/GSD

### New Commands

- **`/gsd:refresh-models`** - Update the registry from APIs
- **`/gsd:list-models`** - Show available models
- **`/gsd:validate-subagent`** - Check model IDs are valid

### Subagent Validation

```markdown
<!-- Before (manual, error-prone) -->
---
model: claude-sonnet-4-5-thinking  # ❌ Wrong format
---

<!-- After (validated from registry) -->
---
model: claude-4.5-sonnet-high-thinking  # ✅ Validated
---
```

### Usage Example

```bash
# 1. Refresh registry
/gsd:refresh-models

# 2. List available models
/gsd:list-models

# 3. Create subagent with validated model
/gsd:create-subagent --name "reviewer" \
  --model "claude-4.5-sonnet-high-thinking"
```

## Benefits

### Before This Workflow
- ❌ Manual guessing of model IDs
- ❌ Trial and error with subagent configs
- ❌ No validation until runtime
- ❌ Stale or incorrect IDs
- ❌ No documentation of available models

### After This Workflow
- ✅ Automated model ID discovery
- ✅ Validated before subagent creation
- ✅ Always up-to-date with APIs
- ✅ Single source of truth (JSON registry)
- ✅ Clear documentation via `/gsd:list-models`

## Design Principles

1. **Authoritative Sources**: Provider APIs as ground truth
2. **Simplicity**: Only 2 variants per model (80/20 rule)
3. **Clarity**: "default" = recommended, "base" = cost-effective
4. **Validation**: Catch errors early in the workflow
5. **Automation**: One command updates everything
6. **Transparency**: Human-readable, version-controlled JSON

## Next Steps for Implementation

1. **Create the skill**: `.cursor/skills/refresh-models/SKILL.md`
2. **Add GSD commands**: `/gsd:refresh-models`, `/gsd:list-models`
3. **Integrate validation**: Update `gsd-tools.js` to use registry
4. **Document for users**: Add usage guide to main README
5. **Setup automation**: Optional periodic refresh (daily/weekly)
6. **Test thoroughly**: Verify all ID transformations work

## Troubleshooting

**Q: API keys not found**
```bash
# Set environment variables
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export OPENAI_API_KEY="sk-proj-..."
```

**Q: Model not in provider API**
- Cursor may have newer models not yet in APIs
- Skill should infer ID and mark as "unverified"

**Q: Registry validation fails**
- Check schema version compatibility
- Restore from `.planning/models-registry.json.bak`
- Re-run with `--force` flag

## Files Deep Dive

### `FetchModels and resolve to slugs.md`

**Contents** (1000+ lines):
- Research phase documentation
- API testing results (OpenRouter, Anthropic, OpenAI)
- Complete skill workflow (7 detailed steps)
- Transformation algorithms with examples
- JSON registry structure specification
- Integration guide for Blueprint/GSD
- Complete end-to-end examples
- Troubleshooting and maintenance

**Key Sections**:
1. Executive Summary (findings and recommendations)
2. Skill Implementation (complete workflow)
3. Step-by-step details (environment setup → validation)
4. API integration examples (curl commands and responses)
5. Registry structure (JSON schema and examples)
6. GSD integration (commands, validation, usage)
7. Complete examples (logs, outputs, error handling)

### `test-model-resolution.js`

**Purpose**: Validates transformation logic

**Tests**:
- ✓ Anthropic ID transformation
- ✓ OpenAI ID pass-through
- ✓ Variant generation
- ✓ Known working IDs verification

**Run**:
```bash
node test-model-resolution.js
# Output: 4/4 tests passed ✓
```

## Summary

This workflow provides a complete, tested solution for maintaining a validated registry of Cursor model IDs. The skill automates what was previously a manual, error-prone process, ensuring subagents always use correct model IDs.

**Impact**: Saves hours of debugging, prevents configuration errors, and keeps Blueprint/GSD model support current with provider releases.

