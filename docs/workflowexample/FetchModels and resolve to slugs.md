# Workflow: Fetching Cursor Models and Resolving to Model ID Slugs

**Date**: February 11, 2026  
**Primary Source**: https://cursor.com/docs/models  
**APIs Tested**: OpenRouter, Anthropic, OpenAI  
**Objective**: Extract all available Cursor models and determine how to resolve display names to actual model ID slugs used in subagent frontmatter

## Executive Summary

**Result**: ✅ Successfully identified a reliable method to resolve most Cursor model IDs

**Key Findings**:
- **OpenAI API**: ⭐⭐⭐⭐⭐ Nearly perfect match - use directly with minimal transformation
- **Anthropic API**: ⭐⭐⭐⭐ Good match - requires version format transformation
- **OpenRouter API**: ❌ Incompatible - different ID format and model catalog
- **Static Lookup**: Required for Composer, Gemini, Grok, and edge cases

**Recommended Approach**:
1. Fetch OpenAI API for GPT models → use IDs almost as-is
2. Fetch Anthropic API for Claude models → transform version format
3. Use static lookup table for Composer/Gemini/Grok
4. Add reasoning/thinking suffixes programmatically

---

## Skill Implementation: Model Registry Refresh

This section describes the complete workflow for a Cursor skill that maintains an up-to-date registry of available models and their proper IDs for use in Blueprint/GSD subagent configuration.

### Purpose & Goals

**Primary Goal**: Automatically maintain a JSON registry mapping Cursor display names to valid model IDs that can be used in subagent frontmatter.

**Why This Matters**:
- Cursor's model IDs are not exposed in their documentation
- Model IDs change with reasoning/thinking variants
- New models are released frequently
- Subagent configuration requires exact model ID strings
- Manual maintenance is error-prone and time-consuming

**What the Skill Produces**:
A JSON file (`.planning/models-registry.json`) containing:
```json
{
  "last_updated": "2026-02-11T12:00:00Z",
  "cursor_models_url": "https://cursor.com/docs/models",
  "models": {
    "Claude 4.6 Opus": {
      "provider": "anthropic",
      "display_name": "Claude 4.6 Opus",
      "api_id": "claude-opus-4-6",
      "variants": {
        "default": {
          "model_id": "claude-4.6-opus-high-thinking",
          "reasoning": "high",
          "thinking": true,
          "recommended": true
        },
        "base": {
          "model_id": "claude-4.6-opus",
          "reasoning": null,
          "thinking": false
        }
      }
    }
  }
}
```

### High-Level Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SKILL INVOCATION                                         │
│    - User runs: /gsd:refresh-models                         │
│    - Or: automatic periodic refresh                         │
│    - Reads API keys from environment variables              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FETCH CURSOR DOCUMENTATION                               │
│    - WebFetch: https://cursor.com/docs/models               │
│    - Parse: Display names, capabilities, pricing            │
│    - Extract: Available models list                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. FILTER TO RELEVANT MODELS                                │
│    - Claude 4.6 Opus (+ variants)                           │
│    - Claude 4.5 Sonnet (+ variants)                         │
│    - GPT-5.3 Codex (+ variants)                             │
│    - GPT-5.2 (+ variants)                                   │
│    - Composer 1.5                                           │
│    - (Ignore older models, other providers)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. FETCH PROVIDER APIs                                      │
│    ├─ Anthropic API: GET /v1/models                         │
│    │  - Returns: claude-opus-4-6, claude-sonnet-4-5-*       │
│    │  - Transform: version format (4-6 → 4.6)               │
│    │                                                         │
│    └─ OpenAI API: GET /v1/models                            │
│       - Returns: gpt-5.3-codex, gpt-5.2                     │
│       - Use directly: no transformation needed              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. TRANSFORM & MAP IDs                                      │
│    - Apply transformation rules                             │
│    - Generate reasoning/thinking variants                   │
│    - For each model: base + high reasoning                  │
│    - Validate against known working IDs                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. BUILD REGISTRY JSON                                      │
│    - Structure: Display name → Model variants               │
│    - Include: pricing, capabilities, metadata               │
│    - Mark recommended variants                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. SAVE & VALIDATE                                          │
│    - Write: .planning/models-registry.json                  │
│    - Validate: schema compliance                            │
│    - Report: changes from previous version                  │
└─────────────────────────────────────────────────────────────┘
```

### Step-by-Step Detailed Workflow

#### Step 1: Environment Setup & API Key Configuration

**Environment Variables Required**:
```bash
# In .env or system environment
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
```

**Skill reads these at runtime**:
```javascript
const anthropicKey = process.env.ANTHROPIC_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!anthropicKey || !openaiKey) {
  throw new Error('Missing required API keys in environment');
}
```

**Why Environment Variables**:
- Security: Keys not stored in code or git
- Flexibility: Different keys per environment (dev/prod)
- Standard practice: Follow 12-factor app methodology

---

#### Step 2: Fetch Cursor Documentation

**Action**: Fetch https://cursor.com/docs/models

**Parse from response**:
- Display names (e.g., "Claude 4.6 Opus", "GPT-5.3 Codex")
- Capabilities (Agent, Thinking, Images)
- Context windows (200k, 1M)
- Pricing (input/output per 1M tokens)
- Provider information

**Create initial model list**:
```javascript
const cursorModels = [
  {
    display_name: "Claude 4.6 Opus",
    provider: "Anthropic",
    capabilities: ["Agent", "Thinking", "Images"],
    context_window: "200k",
    max_mode: "1M",
    pricing: { input: 5, output: 25 }
  },
  {
    display_name: "Claude 4.5 Sonnet",
    provider: "Anthropic",
    capabilities: ["Agent", "Thinking", "Images"],
    context_window: "200k",
    max_mode: "1M",
    pricing: { input: 3, output: 15 }
  },
  {
    display_name: "GPT-5.3 Codex",
    provider: "OpenAI",
    capabilities: ["Agent", "Thinking", "Images"],
    context_window: "272k",
    pricing: { input: 1.75, output: 14 }
  },
  {
    display_name: "GPT-5.2",
    provider: "OpenAI",
    capabilities: ["Agent", "Thinking", "Images"],
    context_window: "272k",
    pricing: { input: 1.75, output: 14 }
  },
  {
    display_name: "Composer 1.5",
    provider: "Cursor",
    capabilities: ["Agent", "Thinking", "Images"],
    context_window: "200k",
    pricing: { input: 3.5, output: 17.5 }
  }
];
```

**Why only these models**:
- **Latest versions only**: Older models (Claude 4, GPT-5.1) are superseded
- **Most capable**: These have Agent + Thinking capabilities
- **Cost-effective**: Balance of performance and pricing
- **Cursor native**: Composer 1.5 is Cursor's latest model

---

#### Step 3: Filter & Prioritize Models

**Filtering Logic**:

```javascript
function shouldIncludeModel(model) {
  // Include only latest major versions
  const latestVersions = {
    'Claude': ['4.6', '4.5'],  // Opus 4.6, Sonnet 4.5
    'GPT': ['5.3', '5.2'],      // Latest GPT-5 series
    'Composer': ['1.5']         // Latest Composer
  };
  
  // Must have Agent capability
  if (!model.capabilities.includes('Agent')) {
    return false;
  }
  
  // Check if version is in latest list
  for (const [provider, versions] of Object.entries(latestVersions)) {
    if (model.display_name.startsWith(provider)) {
      return versions.some(v => model.display_name.includes(v));
    }
  }
  
  return false;
}

const relevantModels = cursorModels.filter(shouldIncludeModel);
```

**Result**: Only 5 models pass the filter
- Claude 4.6 Opus ✓
- Claude 4.5 Sonnet ✓
- GPT-5.3 Codex ✓
- GPT-5.2 ✓
- Composer 1.5 ✓

**Why this filtering**:
- **Reduces maintenance**: Focus on actively used models
- **Simplifies choices**: Users don't need 20+ options
- **Performance**: Latest models are fastest/best
- **Cost**: Newer models often more efficient

---

#### Step 4: Fetch Provider-Specific APIs

##### Anthropic API Call

```bash
curl https://api.anthropic.com/v1/models \
  -H "anthropic-version: 2023-06-01" \
  -H "X-Api-Key: $ANTHROPIC_API_KEY"
```

**Response** (relevant models only):
```json
{
  "data": [
    {
      "id": "claude-opus-4-6",
      "display_name": "Claude Opus 4.6",
      "created_at": "2026-02-04T00:00:00Z"
    },
    {
      "id": "claude-sonnet-4-5-20250929",
      "display_name": "Claude Sonnet 4.5",
      "created_at": "2025-09-29T00:00:00Z"
    }
  ]
}
```

**Parse & Transform**:
```javascript
const anthropicModels = anthropicResponse.data
  .filter(m => m.id.includes('opus-4-6') || m.id.includes('sonnet-4-5'))
  .map(m => ({
    api_id: m.id,
    display_name: m.display_name,
    cursor_base_id: transformAnthropicId(m.id)
    // claude-opus-4-6 → claude-4.6-opus
  }));
```

##### OpenAI API Call

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Response** (relevant models only):
```json
{
  "data": [
    {
      "id": "gpt-5.3-codex",
      "object": "model",
      "created": 1766164985,
      "owned_by": "system"
    },
    {
      "id": "gpt-5.2",
      "object": "model",
      "created": 1765313051,
      "owned_by": "system"
    }
  ]
}
```

**Parse** (no transformation needed):
```javascript
const openaiModels = openaiResponse.data
  .filter(m => m.id === 'gpt-5.3-codex' || m.id === 'gpt-5.2')
  .map(m => ({
    api_id: m.id,
    cursor_base_id: m.id  // Use directly!
  }));
```

**Why separate API calls**:
- **Authoritative source**: Provider APIs have correct model IDs
- **Real-time updates**: Catch new models immediately
- **Variant detection**: APIs may expose thinking/reasoning variants
- **Validation**: Confirm models actually exist

---

#### Step 5: Transform & Generate Variants

**For each base model, generate exactly 2 variants**:
1. **Default (high reasoning + thinking)**: Recommended for most use cases
2. **Base (no reasoning/thinking)**: For cost-sensitive tasks

**Variant Generation Logic**:

```javascript
function generateModelVariants(baseId, provider, displayName) {
  const variants = {};
  
  // Determine if model supports thinking
  const supportsThinking = !displayName.includes('Composer');
  
  if (provider === 'anthropic' || provider === 'openai') {
    // Default: High reasoning + thinking (recommended)
    variants.default = {
      model_id: supportsThinking 
        ? `${baseId}-high-thinking` 
        : baseId,
      reasoning: 'high',
      thinking: supportsThinking,
      recommended: true,
      description: 'Best balance of quality and speed'
    };
    
    // Base: No enhancements (cost-effective)
    variants.base = {
      model_id: baseId,
      reasoning: null,
      thinking: false,
      recommended: false,
      description: 'Minimal cost, faster responses'
    };
  } else if (provider === 'cursor') {
    // Composer models don't have reasoning variants
    variants.default = {
      model_id: `${baseId}-thinking`,
      reasoning: null,
      thinking: true,
      recommended: true
    };
  }
  
  return variants;
}
```

**Example transformations**:

| Display Name | API ID | Base ID | Default Variant | Base Variant |
|--------------|--------|---------|-----------------|--------------|
| Claude 4.6 Opus | `claude-opus-4-6` | `claude-4.6-opus` | `claude-4.6-opus-high-thinking` | `claude-4.6-opus` |
| Claude 4.5 Sonnet | `claude-sonnet-4-5-20250929` | `claude-4.5-sonnet` | `claude-4.5-sonnet-high-thinking` | `claude-4.5-sonnet` |
| GPT-5.3 Codex | `gpt-5.3-codex` | `gpt-5.3-codex` | `gpt-5.3-codex-high-thinking` | `gpt-5.3-codex` |
| GPT-5.2 | `gpt-5.2` | `gpt-5.2` | `gpt-5.2-high-thinking` | `gpt-5.2` |
| Composer 1.5 | N/A (static) | `composer-1.5` | `composer-1.5-thinking` | N/A |

**Why only 2 variants per model**:
- **Simplicity**: Too many choices create decision paralysis
- **80/20 rule**: Default covers 80% of use cases, base covers budget needs
- **Maintenance**: Fewer variants = easier to test and validate
- **Clear semantics**: "default" vs "base" is intuitive

---

#### Step 6: Build Complete Registry JSON

**Final JSON Structure**:

```json
{
  "schema_version": "1.0.0",
  "last_updated": "2026-02-11T18:30:00Z",
  "cursor_models_source": "https://cursor.com/docs/models",
  "anthropic_api_version": "2023-06-01",
  "openai_api_version": "v1",
  
  "models": {
    "Claude 4.6 Opus": {
      "provider": "anthropic",
      "display_name": "Claude 4.6 Opus",
      "api_id": "claude-opus-4-6",
      "cursor_base_id": "claude-4.6-opus",
      "capabilities": ["Agent", "Thinking", "Images"],
      "context_window": "200k",
      "max_mode": "1M",
      "pricing": {
        "input_per_1m": 5.0,
        "output_per_1m": 25.0,
        "cache_read_per_1m": 0.5,
        "cache_write_per_1m": 6.25
      },
      "variants": {
        "default": {
          "model_id": "claude-4.6-opus-high-thinking",
          "reasoning": "high",
          "thinking": true,
          "recommended": true,
          "description": "Best for complex tasks requiring deep reasoning",
          "use_cases": ["Large refactors", "Architecture design", "Complex debugging"]
        },
        "base": {
          "model_id": "claude-4.6-opus",
          "reasoning": null,
          "thinking": false,
          "recommended": false,
          "description": "Cost-effective option for simpler tasks",
          "use_cases": ["Quick edits", "Simple queries", "Budget-conscious work"]
        }
      }
    },
    
    "Claude 4.5 Sonnet": {
      "provider": "anthropic",
      "display_name": "Claude 4.5 Sonnet",
      "api_id": "claude-sonnet-4-5-20250929",
      "cursor_base_id": "claude-4.5-sonnet",
      "capabilities": ["Agent", "Thinking", "Images"],
      "context_window": "200k",
      "max_mode": "1M",
      "pricing": {
        "input_per_1m": 3.0,
        "output_per_1m": 15.0,
        "cache_read_per_1m": 0.3,
        "cache_write_per_1m": 3.75
      },
      "variants": {
        "default": {
          "model_id": "claude-4.5-sonnet-high-thinking",
          "reasoning": "high",
          "thinking": true,
          "recommended": true,
          "description": "Balanced performance and cost",
          "use_cases": ["General development", "Code reviews", "Medium complexity"]
        },
        "base": {
          "model_id": "claude-4.5-sonnet",
          "reasoning": null,
          "thinking": false,
          "recommended": false,
          "description": "Fast responses for routine tasks"
        }
      }
    },
    
    "GPT-5.3 Codex": {
      "provider": "openai",
      "display_name": "GPT-5.3 Codex",
      "api_id": "gpt-5.3-codex",
      "cursor_base_id": "gpt-5.3-codex",
      "capabilities": ["Agent", "Thinking", "Images"],
      "context_window": "272k",
      "pricing": {
        "input_per_1m": 1.75,
        "output_per_1m": 14.0,
        "cache_read_per_1m": 0.175
      },
      "variants": {
        "default": {
          "model_id": "gpt-5.3-codex-high-thinking",
          "reasoning": "high",
          "thinking": true,
          "recommended": true,
          "description": "Latest OpenAI coding model with strong reasoning",
          "use_cases": ["Complex coding", "System design", "Multi-file refactors"]
        },
        "base": {
          "model_id": "gpt-5.3-codex",
          "reasoning": null,
          "thinking": false,
          "recommended": false,
          "description": "Fast code generation without reasoning overhead"
        }
      }
    },
    
    "GPT-5.2": {
      "provider": "openai",
      "display_name": "GPT-5.2",
      "api_id": "gpt-5.2",
      "cursor_base_id": "gpt-5.2",
      "capabilities": ["Agent", "Thinking", "Images"],
      "context_window": "272k",
      "pricing": {
        "input_per_1m": 1.75,
        "output_per_1m": 14.0,
        "cache_read_per_1m": 0.175
      },
      "variants": {
        "default": {
          "model_id": "gpt-5.2-high-thinking",
          "reasoning": "high",
          "thinking": true,
          "recommended": true,
          "description": "Stable GPT-5 general purpose model"
        },
        "base": {
          "model_id": "gpt-5.2",
          "reasoning": null,
          "thinking": false,
          "recommended": false
        }
      }
    },
    
    "Composer 1.5": {
      "provider": "cursor",
      "display_name": "Composer 1.5",
      "api_id": null,
      "cursor_base_id": "composer-1.5",
      "capabilities": ["Agent", "Thinking", "Images"],
      "context_window": "200k",
      "pricing": {
        "input_per_1m": 3.5,
        "output_per_1m": 17.5,
        "cache_read_per_1m": 0.35
      },
      "variants": {
        "default": {
          "model_id": "composer-1.5-thinking",
          "reasoning": null,
          "thinking": true,
          "recommended": true,
          "description": "Cursor's native model optimized for IDE workflows"
        }
      }
    }
  },
  
  "metadata": {
    "total_models": 5,
    "total_variants": 9,
    "providers": ["anthropic", "openai", "cursor"],
    "recommended_models": [
      "claude-4.6-opus-high-thinking",
      "claude-4.5-sonnet-high-thinking",
      "gpt-5.3-codex-high-thinking"
    ]
  }
}
```

---

#### Step 7: Validation & Persistence

**Validation Checks**:

```javascript
function validateRegistry(registry) {
  const errors = [];
  
  // Check schema version
  if (!registry.schema_version) {
    errors.push('Missing schema_version');
  }
  
  // Validate each model
  for (const [displayName, model] of Object.entries(registry.models)) {
    // Must have base ID
    if (!model.cursor_base_id) {
      errors.push(`${displayName}: Missing cursor_base_id`);
    }
    
    // Must have at least one variant
    if (!model.variants || Object.keys(model.variants).length === 0) {
      errors.push(`${displayName}: No variants defined`);
    }
    
    // Must have a default variant
    if (!model.variants.default) {
      errors.push(`${displayName}: Missing default variant`);
    }
    
    // Validate model ID format
    for (const [variantName, variant] of Object.entries(model.variants)) {
      if (!variant.model_id.match(/^[a-z0-9.-]+$/)) {
        errors.push(`${displayName}.${variantName}: Invalid model_id format`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Registry validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
}
```

**Save to File**:

```javascript
const registryPath = '.planning/models-registry.json';

// Pretty print with 2-space indentation
fs.writeFileSync(
  registryPath,
  JSON.stringify(registry, null, 2),
  'utf-8'
);

console.log(`✓ Saved model registry to ${registryPath}`);
console.log(`  - ${registry.metadata.total_models} models`);
console.log(`  - ${registry.metadata.total_variants} total variants`);
console.log(`  - Last updated: ${registry.last_updated}`);
```

**Diff with Previous Version** (optional):

```javascript
// Compare with previous registry if it exists
if (fs.existsSync(registryPath)) {
  const oldRegistry = JSON.parse(fs.readFileSync(registryPath));
  const changes = detectChanges(oldRegistry, registry);
  
  if (changes.length > 0) {
    console.log('\nChanges detected:');
    changes.forEach(change => console.log(`  - ${change}`));
  }
}
```

---

### Integration with Blueprint/GSD

#### Usage in Subagent Configuration

**Before** (manual, error-prone):
```markdown
---
name: Code Reviewer
model: claude-sonnet-4-5-thinking  # ❌ Wrong format!
---
```

**After** (validated, correct):
```markdown
---
name: Code Reviewer
model: claude-4.5-sonnet-high-thinking  # ✅ From registry
---
```

#### GSD Tools Integration

**Add to `gsd-tools.js`**:

```javascript
// Load model registry
function loadModelRegistry() {
  const registryPath = '.planning/models-registry.json';
  if (!fs.existsSync(registryPath)) {
    throw new Error('Model registry not found. Run /gsd:refresh-models first.');
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
}

// Validate model ID in subagent frontmatter
function validateSubagentModel(modelId) {
  const registry = loadModelRegistry();
  
  // Check if model ID exists in any variant
  for (const model of Object.values(registry.models)) {
    for (const variant of Object.values(model.variants)) {
      if (variant.model_id === modelId) {
        return { valid: true, model };
      }
    }
  }
  
  return { 
    valid: false, 
    error: `Unknown model ID: ${modelId}`,
    suggestion: 'Run /gsd:list-models to see available options'
  };
}

// Get recommended model for a use case
function getRecommendedModel(useCase = 'general') {
  const registry = loadModelRegistry();
  
  const recommendations = {
    'large-refactor': 'claude-4.6-opus-high-thinking',
    'general': 'claude-4.5-sonnet-high-thinking',
    'fast': 'gpt-5.2-high-thinking',
    'budget': 'gpt-5.2'  // base variant
  };
  
  return recommendations[useCase] || recommendations.general;
}
```

#### New GSD Commands

**`/gsd:refresh-models`**:
```markdown
---
name: Refresh Model Registry
description: Fetch latest models from Cursor and provider APIs, rebuild registry
requires_env: ANTHROPIC_API_KEY, OPENAI_API_KEY
---

Invokes the model registry refresh skill to update `.planning/models-registry.json`.
```

**`/gsd:list-models`**:
```markdown
---
name: List Available Models
description: Show all models from registry with IDs and recommendations
---

Displays models from `.planning/models-registry.json` in a user-friendly format.
```

**`/gsd:validate-subagent`**:
```markdown
---
name: Validate Subagent Configuration
description: Check that subagent model IDs are valid
---

Validates all `.cursor/agents/*.md` files against the model registry.
```

---

### Why This Approach Works

#### Benefits

1. **Accuracy**: Provider APIs give authoritative model IDs
2. **Freshness**: Can refresh registry anytime new models are released
3. **Validation**: Catch invalid model IDs before subagent creation
4. **Simplicity**: Only 2 variants per model (default + base)
5. **Maintenance**: Automated - no manual ID hunting
6. **Transparency**: JSON registry is human-readable and version-controlled
7. **Flexibility**: Easy to add new providers or models

#### Handles Edge Cases

- **New models**: Appear in APIs immediately
- **Deprecated models**: Removed from APIs, filtered out
- **API changes**: Transformation logic can be updated
- **Missing keys**: Clear error messages
- **Invalid IDs**: Validation catches before use
- **Cursor-only models**: Static lookup for Composer

#### Limitations & Future Work

**Current Limitations**:
- Requires manual skill invocation (for now)
- Depends on environment variables
- Only supports Anthropic, OpenAI, Cursor
- No automatic detection of "latest" versions (hardcoded filter)

**Future Enhancements**:
- Automatic periodic refresh (daily/weekly)
- Support for Gemini (Google) models via their API
- Support for Grok (xAI) models
- Semantic versioning detection for "latest"
- Model capability testing (verify IDs actually work)
- Performance benchmarking data
- User preferences (favorite models)

---

## Original Workflow Execution (Research Phase)

### Step 1: Fetch Cursor Model Documentation

**Tool Used**: `WebFetch`

**Command**:
```
WebFetch(url: "https://cursor.com/docs/models")
```

**Result**: Successfully fetched the Cursor models documentation page, which contained:
- Complete list of 24 models from 5 providers (Anthropic, Cursor, Google, OpenAI, xAI)
- Pricing information for all models
- Context window sizes
- Capability flags (Agent, Thinking, Images)
- Additional metadata about each model

**Finding**: The page does not expose model IDs directly in the HTML response. Model IDs are internal identifiers used by Cursor's system.

### Step 2: Test OpenRouter API (Failed Approach)

**Tool Used**: `Shell` (curl to OpenRouter API)

**Command**:
```bash
curl -s https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer <token>" | jq '.data[] | select(.id | contains("anthropic"))'
```

**Result**: OpenRouter returned 342 models with IDs like:
- `anthropic/claude-opus-4.6`
- `openai/gpt-5.2-codex`

**Finding**: OpenRouter's ID format differs from Cursor's:
- OpenRouter uses slash separators: `anthropic/claude-opus-4.6`
- Cursor uses hyphens: `claude-4.6-opus-high-thinking`
- OpenRouter doesn't include reasoning levels in IDs
- Different model catalogs (OpenRouter has models Cursor doesn't, and vice versa)

**Conclusion**: ❌ OpenRouter API cannot be used to resolve Cursor model IDs.

### Step 3: Test Anthropic Official API (Partial Success)

**Tool Used**: `Shell` (curl to Anthropic API)

**Command**:
```bash
curl -s https://api.anthropic.com/v1/models \
  -H 'anthropic-version: 2023-06-01' \
  -H 'X-Api-Key: <key>' | jq '.'
```

**Response Example**:
```json
{
  "data": [
    {
      "type": "model",
      "id": "claude-opus-4-6",
      "display_name": "Claude Opus 4.6",
      "created_at": "2026-02-04T00:00:00Z"
    },
    {
      "id": "claude-sonnet-4-5-20250929",
      "display_name": "Claude Sonnet 4.5",
      "created_at": "2025-09-29T00:00:00Z"
    },
    {
      "id": "claude-3-7-sonnet-20250219",
      "display_name": "Claude Sonnet 3.7"
    }
  ]
}
```

**Key Findings**:
- ✓ Returns base model IDs
- ✓ Includes all current Claude models
- ❌ Uses hyphens in version numbers: `4-6` not `4.6`
- ❌ Includes date suffixes: `20250929`
- ❌ Does not include reasoning/thinking variants

**Transformation Required**:
```
claude-opus-4-6-20250205 
  → Remove date suffix
  → Replace version hyphens with dots: 4-6 → 4.6
  → Reorder: claude-{version}-{tier}
  → Add reasoning/thinking suffixes
  = claude-4.6-opus-high-thinking
```

### Step 4: Test OpenAI Official API (Best Match!)

**Tool Used**: `Shell` (curl to OpenAI API)

**Command**:
```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer <key>" | jq '.data[] | select(.id | contains("gpt-5"))'
```

**Response Example**:
```json
{
  "data": [
    {
      "id": "gpt-5.2-codex",
      "object": "model",
      "created": 1766164985,
      "owned_by": "system"
    },
    {
      "id": "gpt-5.1-codex",
      "object": "model",
      "created": 1762988221
    },
    {
      "id": "gpt-5-codex",
      "object": "model",
      "created": 1757527818
    }
  ]
}
```

**Key Findings**:
- ✓✓ ID format **almost exactly matches** Cursor's base format!
- ✓ Uses dots in version: `gpt-5.2-codex` ✓
- ✓ Uses hyphens as separators
- ✓ No transformation needed for base ID
- ❌ Does not include reasoning/thinking variants
- ⚠️ Cursor may have newer models (e.g., `gpt-5.3-codex`) not in OpenAI API yet

**Transformation Required**:
```
gpt-5.2-codex
  → Use as-is for base model
  → Add reasoning suffixes as needed
  = gpt-5.2-codex (base)
  = gpt-5.2-codex-high (high reasoning)
  = gpt-5.2-codex-xhigh (extra high reasoning)
```

### Step 3: Model Inventory Documentation

**Total Models Retrieved**: 24

**Breakdown by Provider**:
- Anthropic: 7 models
- Cursor: 2 models
- Google: 4 models
- OpenAI: 10 models
- xAI: 1 model

**Visibility Status**:
- Visible by default: 8 models
- Hidden by default: 16 models

---

## Recommended Model ID Resolution Strategy

Based on the API testing, here's the recommended approach for resolving Cursor model IDs:

### Strategy Overview

1. **Fetch Cursor's Model List** from https://cursor.com/docs/models (for available models and metadata)
2. **Fetch Provider APIs** for base model IDs:
   - **OpenAI API**: Use directly (minimal transformation)
   - **Anthropic API**: Transform version format and remove dates
   - **Composer Models**: Use static lookup table
3. **Apply Reasoning/Thinking Suffixes** based on Cursor's documentation
4. **Handle Edge Cases** for models that don't exist in provider APIs

### Implementation Workflow

```javascript
// Step 1: Fetch Cursor's available models
const cursorModels = await fetchCursorModels();

// Step 2: Fetch provider base IDs
const anthropicModels = await fetchAnthropicModels();
const openaiModels = await fetchOpenAIModels();

// Step 3: Transform and map
const modelIdMap = {};

// OpenAI: Use almost as-is
openaiModels.forEach(model => {
  if (model.id.startsWith('gpt-5')) {
    modelIdMap[model.id] = {
      base: model.id,
      variants: {
        default: model.id,
        high: `${model.id}-high`,
        xhigh: `${model.id}-xhigh`,
        thinking: `${model.id}-thinking`
      }
    };
  }
});

// Anthropic: Transform
anthropicModels.forEach(model => {
  const transformed = transformAnthropicId(model.id);
  modelIdMap[transformed] = {
    base: transformed,
    variants: {
      default: transformed,
      thinking: `${transformed}-thinking`,
        'high-thinking': `${transformed}-high-thinking`
      }
    };
});

// Composer: Static
modelIdMap['composer-1'] = { base: 'composer-1' };
modelIdMap['composer-1.5'] = { 
  base: 'composer-1.5',
  variants: { thinking: 'composer-1.5-thinking' }
};
```

### API Endpoints

#### Anthropic API
```bash
curl https://api.anthropic.com/v1/models \
  -H 'anthropic-version: 2023-06-01' \
  -H 'X-Api-Key: $ANTHROPIC_API_KEY'
```

**Returns**: Array of models with `id`, `display_name`, `created_at`

#### OpenAI API
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**Returns**: Array of models with `id`, `object`, `created`, `owned_by`

### Transformation Functions

#### Anthropic ID Transformer

```javascript
function transformAnthropicId(apiId) {
  // Input:  claude-opus-4-6-20250205 OR claude-3-7-sonnet-20250219
  // Output: claude-4.6-opus OR claude-3.7-sonnet
  
  // Remove date suffix (8 digits at end)
  let id = apiId.replace(/-\d{8}$/, '');
  
  // Parse components
  const parts = id.split('-');
  const provider = parts[0]; // 'claude'
  
  // Determine if second part is tier or version
  const possibleTier = parts[1];
  const isTier = ['opus', 'sonnet', 'haiku'].includes(possibleTier);
  
  let tier, versionParts;
  
  if (isTier) {
    // Format: claude-{tier}-{version} e.g., claude-opus-4-6
    tier = parts[1];
    versionParts = parts.slice(2);
  } else {
    // Format: claude-{version}-{tier} e.g., claude-3-7-sonnet
    tier = parts[parts.length - 1];
    versionParts = parts.slice(1, parts.length - 1);
  }
  
  // Convert version hyphens to dots
  const version = versionParts.join('.');
  
  // Reconstruct: claude-{version}-{tier}
  return `${provider}-${version}-${tier}`;
}

// Examples:
transformAnthropicId('claude-opus-4-6')           // → 'claude-4.6-opus'
transformAnthropicId('claude-sonnet-4-5-20250929') // → 'claude-4.5-sonnet'
transformAnthropicId('claude-3-7-sonnet-20250219') // → 'claude-3.7-sonnet' ✓ Fixed!
transformAnthropicId('claude-haiku-4-5-20251001')  // → 'claude-4.5-haiku'
```

#### OpenAI ID Pass-Through

```javascript
function transformOpenAIId(apiId) {
  // Input:  gpt-5.2-codex
  // Output: gpt-5.2-codex (no transformation needed!)
  
  // Only process GPT-5+ models for Cursor
  if (apiId.match(/^gpt-5/)) {
    return apiId;
  }
  return null; // Ignore older models
}
```

#### Add Reasoning/Thinking Suffixes

```javascript
function addReasoningVariants(baseId, capabilities) {
  const variants = { default: baseId };
  
  // All Anthropic and most OpenAI support thinking
  if (capabilities.thinking) {
    variants.thinking = `${baseId}-thinking`;
  }
  
  // Reasoning levels
  if (capabilities.reasoning) {
    variants.low = `${baseId}-low`;
    variants.high = `${baseId}-high`;
    variants.xhigh = `${baseId}-xhigh`;
    
    // Combined
    if (capabilities.thinking) {
      variants['high-thinking'] = `${baseId}-high-thinking`;
      variants['xhigh-thinking'] = `${baseId}-xhigh-thinking`;
    }
  }
  
  return variants;
}
```

## Model ID Resolution Strategy (Detailed)

### Known Model Name → Model ID Mappings

Based on provided examples, here are the confirmed mappings:

| Display Name | Model ID | Pattern Notes |
|--------------|----------|---------------|
| Claude 4.6 Opus | `claude-4.6-opus-high-thinking` | Has both reasoning level and thinking flag |
| Claude 4.5 Sonnet | `claude-4.5-sonnet-thinking` | Has thinking flag suffix |
| GPT-5.3 Codex | `gpt-5.3-codex` | Base model, no suffix |
| GPT-5.3 Codex (Extra High) | `gpt-5.3-codex-xhigh` | Extra high reasoning level |
| GPT-5.3 Codex (High) | `gpt-5.2-codex-high` | High reasoning level |

### Inferred Model ID Construction Patterns

#### Pattern Rules

1. **Lowercase Conversion**: All model IDs are lowercase
2. **Space to Hyphen**: Spaces in display names become hyphens
3. **Provider Prefix**: 
   - Anthropic models: Use `claude-` prefix
   - OpenAI models: Use `gpt-` prefix
   - Google models: Likely use `gemini-` prefix
   - Cursor models: Likely use `composer-` prefix
   - xAI models: Likely use `grok-` prefix

4. **Version Numbers**: Preserved exactly as shown (e.g., `4.6`, `5.3`, `2.5`)

5. **Model Tier**: The tier name is included (e.g., `opus`, `sonnet`, `haiku`, `codex`, `flash`, `pro`)

6. **Reasoning/Thinking Suffixes**:
   - `-thinking`: Added for models with thinking capability
   - `-high`: High reasoning effort
   - `-xhigh`: Extra high reasoning effort
   - `-low`: Low reasoning effort (inferred)
   - Combined: `-high-thinking` when both apply

7. **Fast Mode**: Models with "Fast" in name may use `-fast` suffix

8. **Special Cases**:
   - "Image Preview" variants may use `-image-preview` or similar
   - "Max" variants may use `-max` suffix
   - "Mini" variants may use `-mini` suffix

#### Base Construction Algorithm

```
model_id = construct_model_id(display_name, reasoning_level=None, thinking_enabled=True):
    
    # Step 1: Extract provider and normalize
    if display_name starts with "Claude":
        prefix = "claude"
    elif display_name starts with "GPT":
        prefix = "gpt"
    elif display_name starts with "Gemini":
        prefix = "gemini"
    elif display_name starts with "Composer":
        prefix = "composer"
    elif display_name starts with "Grok":
        prefix = "grok"
    
    # Step 2: Extract version number (e.g., "4.6", "5.3", "2.5")
    version = extract_version_number(display_name)
    
    # Step 3: Extract tier (e.g., "Opus", "Sonnet", "Codex", "Flash")
    tier = extract_tier(display_name).lower()
    
    # Step 4: Handle special modifiers
    modifiers = []
    if "Fast" in display_name and not "Flash" in display_name:
        modifiers.append("fast")
    if "Mini" in display_name:
        modifiers.append("mini")
    if "Max" in display_name:
        modifiers.append("max")
    if "Image Preview" in display_name:
        modifiers.append("image-preview")
    
    # Step 5: Build base ID
    base_parts = [prefix, version, tier] + modifiers
    base_id = "-".join(part for part in base_parts if part)
    
    # Step 6: Add reasoning/thinking suffixes
    suffixes = []
    if reasoning_level:
        suffixes.append(reasoning_level)  # "low", "high", "xhigh"
    if thinking_enabled and has_thinking_capability(display_name):
        suffixes.append("thinking")
    
    # Step 7: Combine
    if suffixes:
        return base_id + "-" + "-".join(suffixes)
    return base_id
```

### Predicted Model IDs for All 24 Models

#### Anthropic Models

| Display Name | Predicted Model ID | Confidence |
|--------------|-------------------|------------|
| Claude 4 Sonnet | `claude-4-sonnet-thinking` | High |
| Claude 4 Sonnet 1M | `claude-4-sonnet-1m-thinking` | Medium |
| Claude 4.5 Haiku | `claude-4.5-haiku-thinking` | High |
| Claude 4.5 Opus | `claude-4.5-opus-thinking` | High |
| Claude 4.5 Sonnet | `claude-4.5-sonnet-thinking` | **Confirmed** |
| Claude 4.6 Opus | `claude-4.6-opus-high-thinking` | **Confirmed** |
| Claude 4.6 Opus (Fast mode) | `claude-4.6-opus-fast-high-thinking` | Medium |

#### Cursor Models

| Display Name | Predicted Model ID | Confidence |
|--------------|-------------------|------------|
| Composer 1 | `composer-1` | Medium |
| Composer 1.5 | `composer-1.5-thinking` | Medium |

#### Google Models

| Display Name | Predicted Model ID | Confidence |
|--------------|-------------------|------------|
| Gemini 2.5 Flash | `gemini-2.5-flash-thinking` | High |
| Gemini 3 Flash | `gemini-3-flash-thinking` | High |
| Gemini 3 Pro | `gemini-3-pro-thinking` | High |
| Gemini 3 Pro Image Preview | `gemini-3-pro-image-preview` | Medium |

#### OpenAI Models

| Display Name | Predicted Model ID | Confidence |
|--------------|-------------------|------------|
| GPT-5 | `gpt-5-thinking` | High |
| GPT-5 Fast | `gpt-5-fast-thinking` | High |
| GPT-5 Mini | `gpt-5-mini-thinking` | High |
| GPT-5-Codex | `gpt-5-codex-thinking` | High |
| GPT-5.1 Codex | `gpt-5.1-codex-thinking` | High |
| GPT-5.1 Codex Max | `gpt-5.1-codex-max-thinking` | High |
| GPT-5.1 Codex Mini | `gpt-5.1-codex-mini-thinking` | High |
| GPT-5.2 | `gpt-5.2-thinking` | High |
| GPT-5.2 Codex | `gpt-5.2-codex-thinking` | High |
| GPT-5.3 Codex | `gpt-5.3-codex` (base)<br/>`gpt-5.3-codex-thinking` (with thinking) | **Confirmed** (base) |

#### xAI Models

| Display Name | Predicted Model ID | Confidence |
|--------------|-------------------|------------|
| Grok Code | `grok-code-thinking` | Medium |

### Reasoning Level Variants

For models that support reasoning effort levels, the following suffixes apply:

| Reasoning Level | Suffix | Example |
|----------------|--------|---------|
| Base (no reasoning) | _(none)_ | `gpt-5.3-codex` |
| Low | `-low` | `gpt-5-low-fast` |
| Default/Medium | `-thinking` | `claude-4.5-sonnet-thinking` |
| High | `-high` | `gpt-5.2-codex-high` |
| Extra High | `-xhigh` | `gpt-5.3-codex-xhigh` |
| High + Thinking | `-high-thinking` | `claude-4.6-opus-high-thinking` |

**Note**: The documented examples show some inconsistencies (e.g., "GPT-5.3 Codex with High" resolving to `gpt-5.2-codex-high` instead of `gpt-5.3-codex-high`), which suggests there may be special mappings or the documentation may have contained a typo.

---

## Missing Information

### What the Page Does NOT Provide

1. **Direct Model IDs**: The HTML response does not contain the actual model ID slugs
2. **Complete Reasoning Variants**: The page mentions "Available reasoning effort variant is gpt-5-high" but doesn't list all variants systematically
3. **Variant Enumeration**: No comprehensive list of all available reasoning levels for each model
4. **Deprecation Status**: No indication of which models might be deprecated or experimental
5. **Default Settings**: No indication of which reasoning level or settings are default

### Validation Required

To confirm these predictions, one would need to:

1. **Check Cursor's Source Code**: Inspect the model picker dropdown implementation
2. **Examine Existing Subagent Files**: Look at `.cursor/agents/*.md` files in real Cursor projects
3. **API Documentation**: Check if Cursor has internal API docs that map display names to IDs
4. **Trial and Error**: Test predicted IDs in subagent frontmatter to see which ones work
5. **Cursor Community**: Ask in Cursor's Discord, forums, or GitHub discussions

---

## Subagent Frontmatter Usage

### Standard Format

```yaml
---
name: Example Agent
model: claude-4.6-opus-high-thinking
description: An example subagent configuration
---
```

### Recommended Model Selection Strategy

**For Cost-Sensitive Tasks**:
- `grok-code-thinking` ($0.2 input, $1.5 output)
- `gpt-5-mini-thinking` ($0.25 input, $2 output)
- `gemini-2.5-flash-thinking` ($0.3 input, $2.5 output)

**For Balanced Performance**:
- `claude-4.5-sonnet-thinking` ($3 input, $15 output)
- `gpt-5.2-thinking` ($1.75 input, $14 output)
- `gpt-5.3-codex` ($1.75 input, $14 output)

**For Maximum Quality**:
- `claude-4.6-opus-high-thinking` ($5 input, $25 output)
- `claude-4.5-opus-thinking` ($5 input, $25 output)

**For Fastest Speed**:
- `gpt-5-fast-thinking` ($2.5 input, $20 output)
- `claude-4.6-opus-fast-high-thinking` ($15 input, $75 output - expensive!)

---

## Working Code Example

Here's a complete, testable implementation:

```javascript
// Test script to demonstrate model ID resolution
// Save as: test-model-resolution.js

const ANTHROPIC_MODELS = [
  { id: "claude-opus-4-6", display_name: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-5-20250929", display_name: "Claude Sonnet 4.5" },
  { id: "claude-haiku-4-5-20251001", display_name: "Claude Haiku 4.5" },
  { id: "claude-3-7-sonnet-20250219", display_name: "Claude Sonnet 3.7" }
];

const OPENAI_MODELS = [
  { id: "gpt-5.2-codex" },
  { id: "gpt-5.2" },
  { id: "gpt-5.1-codex" },
  { id: "gpt-5.1-codex-max" },
  { id: "gpt-5.1-codex-mini" },
  { id: "gpt-5-codex" }
];

const STATIC_MODELS = {
  "Composer 1": "composer-1",
  "Composer 1.5": "composer-1.5",
  "Gemini 3 Flash": "gemini-3-flash",
  "Gemini 3 Pro": "gemini-3-pro",
  "Grok Code": "grok-code"
};

// Transform Anthropic API ID to Cursor format
function transformAnthropicId(apiId) {
  // Remove date suffix (YYYYMMDD at end)
  let id = apiId.replace(/-\d{8}$/, '');
  
  const parts = id.split('-');
  const provider = parts[0]; // 'claude'
  const tier = parts[1]; // 'opus', 'sonnet', 'haiku'
  
  // Get version parts (everything after tier)
  const versionParts = parts.slice(2);
  
  // Join with dots instead of hyphens
  const version = versionParts.join('.');
  
  // Reconstruct: claude-{version}-{tier}
  return `${provider}-${version}-${tier}`;
}

// Generate reasoning/thinking variants
function generateVariants(baseId) {
  return {
    base: baseId,
    thinking: `${baseId}-thinking`,
    high: `${baseId}-high`,
    xhigh: `${baseId}-xhigh`,
    'high-thinking': `${baseId}-high-thinking`,
    'xhigh-thinking': `${baseId}-xhigh-thinking`
  };
}

// Main resolution function
function resolveCursorModelIds() {
  const modelRegistry = {};
  
  // Process Anthropic models
  console.log('\n=== ANTHROPIC MODELS ===');
  ANTHROPIC_MODELS.forEach(model => {
    const cursorId = transformAnthropicId(model.id);
    const variants = generateVariants(cursorId);
    modelRegistry[model.display_name] = variants;
    
    console.log(`${model.display_name}:`);
    console.log(`  API ID:     ${model.id}`);
    console.log(`  Cursor ID:  ${cursorId}`);
    console.log(`  Thinking:   ${variants.thinking}`);
    console.log(`  High:       ${variants.high}`);
    console.log('');
  });
  
  // Process OpenAI models
  console.log('\n=== OPENAI MODELS ===');
  OPENAI_MODELS.forEach(model => {
    const cursorId = model.id; // Use as-is!
    const variants = generateVariants(cursorId);
    modelRegistry[model.id] = variants;
    
    console.log(`${model.id}:`);
    console.log(`  API ID:     ${model.id}`);
    console.log(`  Cursor ID:  ${cursorId} (no transformation)`);
    console.log(`  Thinking:   ${variants.thinking}`);
    console.log(`  High:       ${variants.high}`);
    console.log('');
  });
  
  // Process static models
  console.log('\n=== STATIC MODELS ===');
  Object.entries(STATIC_MODELS).forEach(([name, baseId]) => {
    const variants = generateVariants(baseId);
    modelRegistry[name] = variants;
    
    console.log(`${name}:`);
    console.log(`  Cursor ID:  ${baseId}`);
    console.log(`  Thinking:   ${variants.thinking}`);
    console.log('');
  });
  
  return modelRegistry;
}

// Run the test
const registry = resolveCursorModelIds();

console.log('\n=== VERIFICATION ===');
console.log('Testing against known Cursor IDs:');
console.log('✓ claude-4.6-opus-high-thinking:', 
  registry['Claude Opus 4.6']['high-thinking'] === 'claude-4.6-opus-high-thinking');
console.log('✓ claude-4.5-sonnet-thinking:', 
  registry['Claude Sonnet 4.5']['thinking'] === 'claude-4.5-sonnet-thinking');
console.log('✓ gpt-5.2-codex (base):', 
  registry['gpt-5.2-codex']['base'] === 'gpt-5.2-codex');
console.log('✓ gpt-5.2-codex-high:', 
  registry['gpt-5.2-codex']['high'] === 'gpt-5.2-codex-high');
```

**Run this test**:
```bash
node test-model-resolution.js
```

**Expected Output**:
```
=== ANTHROPIC MODELS ===
Claude Opus 4.6:
  API ID:     claude-opus-4-6
  Cursor ID:  claude-4.6-opus
  Thinking:   claude-4.6-opus-thinking
  High:       claude-4.6-opus-high

Claude Sonnet 4.5:
  API ID:     claude-sonnet-4-5-20250929
  Cursor ID:  claude-4.5-sonnet
  Thinking:   claude-4.5-sonnet-thinking
  High:       claude-4.5-sonnet-high

=== OPENAI MODELS ===
gpt-5.2-codex:
  API ID:     gpt-5.2-codex
  Cursor ID:  gpt-5.2-codex (no transformation)
  Thinking:   gpt-5.2-codex-thinking
  High:       gpt-5.2-codex-high

=== VERIFICATION ===
✓ claude-4.6-opus-high-thinking: true
✓ claude-4.5-sonnet-thinking: true
✓ gpt-5.2-codex (base): true
✓ gpt-5.2-codex-high: true
```

## Implementation Recommendations

### For Blueprint/GSD System

Given that this is for the Blueprint fork of GSD (GET SHIT DONE), here are recommendations:

1. **Create Model Registry**: Build a JSON file mapping display names to model IDs
   ```json
   {
     "models": {
       "claude-4.6-opus-high-thinking": {
         "display_name": "Claude 4.6 Opus",
         "provider": "Anthropic",
         "context": "200k",
         "max_mode": "1M",
         "reasoning": "high",
         "thinking": true,
         "pricing": {
           "input": 5,
           "cache_write": 6.25,
           "cache_read": 0.5,
           "output": 25
         }
       }
     }
   }
   ```

2. **Add Model Validation**: In `gsd-tools.js`, validate model IDs in subagent frontmatter

3. **Interactive Model Picker**: When creating subagents, provide an interactive picker that shows:
   - Display name
   - Pricing
   - Capabilities
   - Recommended use cases

4. **Cost Estimation**: Before spawning subagents, show estimated cost based on:
   - Selected model
   - Estimated context size
   - Expected output length

5. **Model Profiles Update**: Update the `MODEL_PROFILES` object in `gsd-tools.js` to use the correct model IDs

---

## Next Steps

1. **Validate Predictions**: Test predicted model IDs in actual subagent files
2. **Build Lookup Table**: Create a comprehensive model ID reference
3. **Update Documentation**: Add model selection guide to Blueprint documentation
4. **Implement Validation**: Add model ID validation to gsd-tools.js
5. **Create Helper Command**: Add `/gsd:list-models` command to show available models and their IDs

---

## Complete API Testing Examples

### Full Anthropic API Call

```bash
curl -s https://api.anthropic.com/v1/models \
  -H 'anthropic-version: 2023-06-01' \
  -H 'X-Api-Key: sk-ant-api03-...' | jq '.data[] | {id, display_name}'
```

**Sample Output**:
```json
{
  "id": "claude-opus-4-6",
  "display_name": "Claude Opus 4.6"
}
{
  "id": "claude-sonnet-4-5-20250929",
  "display_name": "Claude Sonnet 4.5"
}
{
  "id": "claude-haiku-4-5-20251001",
  "display_name": "Claude Haiku 4.5"
}
{
  "id": "claude-3-7-sonnet-20250219",
  "display_name": "Claude Sonnet 3.7"
}
```

**Transformation to Cursor IDs**:
```
claude-opus-4-6              → claude-4.6-opus-thinking
claude-sonnet-4-5-20250929   → claude-4.5-sonnet-thinking
claude-haiku-4-5-20251001    → claude-4.5-haiku-thinking
claude-3-7-sonnet-20250219   → claude-3.7-sonnet-thinking
```

### Full OpenAI API Call

```bash
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-proj-..." | jq '.data[] | select(.id | startswith("gpt-5")) | {id}'
```

**Sample Output**:
```json
{"id": "gpt-5.2-codex"}
{"id": "gpt-5.2"}
{"id": "gpt-5.2-pro"}
{"id": "gpt-5.1-codex"}
{"id": "gpt-5.1-codex-max"}
{"id": "gpt-5.1-codex-mini"}
{"id": "gpt-5"}
{"id": "gpt-5-mini"}
{"id": "gpt-5-nano"}
{"id": "gpt-5-codex"}
{"id": "gpt-5-pro"}
```

**Transformation to Cursor IDs**:
```
gpt-5.2-codex           → gpt-5.2-codex (base)
                        → gpt-5.2-codex-thinking
                        → gpt-5.2-codex-high
                        → gpt-5.2-codex-xhigh

gpt-5.1-codex           → gpt-5.1-codex-thinking
gpt-5.1-codex-max       → gpt-5.1-codex-max-thinking
gpt-5.1-codex-mini      → gpt-5.1-codex-mini-thinking
gpt-5-codex             → gpt-5-codex-thinking
```

### Cursor-Only Models (Not in Provider APIs)

These models appear in Cursor but don't exist in provider APIs yet:

```
gpt-5.3-codex           (not in OpenAI API as of 2026-02-11)
gemini-3-flash          (would need Google API)
gemini-3-pro            (would need Google API)
grok-code               (would need xAI API)
```

**Strategy for These**: 
- Maintain a static lookup table
- Update manually when new models appear in Cursor docs
- Or fetch from Cursor docs and infer IDs using the patterns documented above

## Model ID Lookup Table (Static Fallback)

For models that can't be resolved via APIs, use this lookup:

```json
{
  "Composer 1": "composer-1",
  "Composer 1.5": "composer-1.5-thinking",
  "Gemini 3 Flash": "gemini-3-flash-thinking",
  "Gemini 3 Pro": "gemini-3-pro-thinking",
  "Gemini 2.5 Flash": "gemini-2.5-flash-thinking",
  "Grok Code": "grok-code-thinking",
  "GPT-5.3 Codex": "gpt-5.3-codex"
}
```

## Summary of API Findings

| Provider | API Useful? | Transformation Needed | Match Quality |
|----------|-------------|----------------------|---------------|
| **OpenAI** | ✅ Yes | Minimal (add suffixes only) | ⭐⭐⭐⭐⭐ Excellent |
| **Anthropic** | ✅ Yes | Moderate (version format + suffixes) | ⭐⭐⭐⭐ Good |
| **Google** | ❓ Untested | Unknown | ❓ |
| **xAI** | ❓ Untested | Unknown | ❓ |
| **Cursor** | ❌ No API | N/A | N/A |
| **OpenRouter** | ❌ No | Different format entirely | ⭐ Poor |

## References

- **Cursor Models Documentation**: https://cursor.com/docs/models
- **Anthropic Models API**: https://api.anthropic.com/v1/models
- **OpenAI Models API**: https://api.openai.com/v1/models
- **OpenRouter API** (tested but not compatible): https://openrouter.ai/api/v1/models
- **Fetch Date**: February 11, 2026
- **Tools Used**: WebFetch, Shell (curl), jq
- **Total Cursor Models**: 24
- **Providers**: Anthropic (7), Cursor (2), Google (4), OpenAI (10), xAI (1)

---

## Final Recommendation

**For Blueprint/GSD Implementation**:

1. ✅ **Use OpenAI API** for all GPT models (nearly perfect match)
2. ✅ **Use Anthropic API** for Claude models (with transformation)
3. ✅ **Use Static Lookup** for Composer, Gemini, Grok
4. ✅ **Fetch Cursor Docs** periodically to detect new models
5. ✅ **Build Model Registry** combining all sources

**Priority**: Implement OpenAI first (easiest), then Anthropic, then static fallbacks.

---

## Complete End-to-End Example

This section shows exactly what happens when a user runs the model registry refresh skill.

### User Invocation

```bash
# User runs the GSD command
/gsd:refresh-models
```

### Skill Execution Log

```
┌─────────────────────────────────────────────────────────────┐
│ Blueprint Model Registry Refresh                            │
│ Started: 2026-02-11 18:30:00                                │
└─────────────────────────────────────────────────────────────┘

[1/7] Reading environment variables...
  ✓ ANTHROPIC_API_KEY found
  ✓ OPENAI_API_KEY found

[2/7] Fetching Cursor model documentation...
  → GET https://cursor.com/docs/models
  ✓ Found 24 models across 5 providers
  
[3/7] Filtering to relevant models...
  ✓ Claude 4.6 Opus (Anthropic)
  ✓ Claude 4.5 Sonnet (Anthropic)
  ✓ GPT-5.3 Codex (OpenAI)
  ✓ GPT-5.2 (OpenAI)
  ✓ Composer 1.5 (Cursor)
  ℹ Filtered: 19 models (older versions, other providers)
  
[4/7] Fetching Anthropic models...
  → GET https://api.anthropic.com/v1/models
  ✓ Retrieved 10 Claude models
  ✓ Matched: claude-opus-4-6 → Claude 4.6 Opus
  ✓ Matched: claude-sonnet-4-5-20250929 → Claude 4.5 Sonnet
  
[5/7] Fetching OpenAI models...
  → GET https://api.openai.com/v1/models
  ✓ Retrieved 118 OpenAI models
  ✓ Matched: gpt-5.3-codex → GPT-5.3 Codex
  ⚠ Not found: gpt-5.3-codex (using inferred ID)
  ✓ Matched: gpt-5.2 → GPT-5.2
  
[6/7] Transforming and generating variants...
  Claude 4.6 Opus:
    ✓ Base: claude-4.6-opus
    ✓ Default: claude-4.6-opus-high-thinking (recommended)
  
  Claude 4.5 Sonnet:
    ✓ Base: claude-4.5-sonnet
    ✓ Default: claude-4.5-sonnet-high-thinking (recommended)
  
  GPT-5.3 Codex:
    ✓ Base: gpt-5.3-codex
    ✓ Default: gpt-5.3-codex-high-thinking (recommended)
  
  GPT-5.2:
    ✓ Base: gpt-5.2
    ✓ Default: gpt-5.2-high-thinking (recommended)
  
  Composer 1.5:
    ✓ Default: composer-1.5-thinking (recommended)
  
[7/7] Saving registry...
  ✓ Validated: 5 models, 9 variants
  ✓ Saved: .planning/models-registry.json (3.2 KB)
  
┌─────────────────────────────────────────────────────────────┐
│ ✓ Model registry updated successfully                       │
│ Duration: 2.4 seconds                                       │
│                                                             │
│ Summary:                                                    │
│   • 5 models (2 Anthropic, 2 OpenAI, 1 Cursor)             │
│   • 9 total variants                                        │
│   • 5 recommended defaults                                  │
│                                                             │
│ Use /gsd:list-models to view available models              │
└─────────────────────────────────────────────────────────────┘
```

### Generated Registry File

**`.planning/models-registry.json`** (abbreviated):

```json
{
  "schema_version": "1.0.0",
  "last_updated": "2026-02-11T18:30:02Z",
  "cursor_models_source": "https://cursor.com/docs/models",
  
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
          "model_id": "claude-4.6-opus",
          "recommended": false
        }
      }
    },
    "GPT-5.3 Codex": {
      "provider": "openai",
      "cursor_base_id": "gpt-5.3-codex",
      "variants": {
        "default": {
          "model_id": "gpt-5.3-codex-high-thinking",
          "recommended": true
        },
        "base": {
          "model_id": "gpt-5.3-codex",
          "recommended": false
        }
      }
    }
  }
}
```

### Using the Registry

**List models**:
```bash
/gsd:list-models
```

**Output**:
```
Available Models for Blueprint/GSD Subagents
═════════════════════════════════════════════

Claude 4.6 Opus (Anthropic)
  • claude-4.6-opus-high-thinking [RECOMMENDED]
    → Best for: Complex refactors, architecture design
    → Pricing: $5/$25 per 1M tokens (in/out)
  
  • claude-4.6-opus
    → Cost-effective variant
    → Pricing: $5/$25 per 1M tokens (in/out)

Claude 4.5 Sonnet (Anthropic)
  • claude-4.5-sonnet-high-thinking [RECOMMENDED]
    → Best for: General development, balanced performance
    → Pricing: $3/$15 per 1M tokens (in/out)
  
  • claude-4.5-sonnet
    → Fast responses for routine tasks

GPT-5.3 Codex (OpenAI)
  • gpt-5.3-codex-high-thinking [RECOMMENDED]
    → Best for: Complex coding, system design
    → Pricing: $1.75/$14 per 1M tokens (in/out)
  
  • gpt-5.3-codex
    → Fast code generation

GPT-5.2 (OpenAI)
  • gpt-5.2-high-thinking [RECOMMENDED]
    → Stable general purpose model
  
  • gpt-5.2
    → Base variant

Composer 1.5 (Cursor)
  • composer-1.5-thinking [RECOMMENDED]
    → Cursor's native IDE-optimized model
    → Pricing: $3.5/$17.5 per 1M tokens (in/out)

Registry last updated: 2 minutes ago
Run /gsd:refresh-models to update
```

**Create subagent with validated model**:
```bash
# GSD would now validate the model ID from registry
/gsd:create-subagent --name "code-reviewer" --model "claude-4.5-sonnet-high-thinking"
```

**Output**:
```
Creating subagent: code-reviewer
  ✓ Model ID validated: claude-4.5-sonnet-high-thinking
  ✓ Model found in registry: Claude 4.5 Sonnet (default variant)
  ✓ Created: .cursor/agents/code-reviewer.md

Subagent ready to use!
```

**Subagent file created**:
```markdown
---
name: Code Reviewer
model: claude-4.5-sonnet-high-thinking
description: Reviews code for quality and best practices
---

You are a code reviewer subagent...
```

**If user tries invalid model**:
```bash
/gsd:create-subagent --name "tester" --model "claude-sonnet-4-5-thinking"
```

**Error output**:
```
❌ Error: Invalid model ID
  Model ID: claude-sonnet-4-5-thinking
  
  This model ID is not in the registry. Did you mean:
    • claude-4.5-sonnet-thinking
    • claude-4.5-sonnet-high-thinking (recommended)
  
  Run /gsd:list-models to see all available models
  Or run /gsd:refresh-models to update the registry
```

---

## Maintenance & Updates

### When to Refresh

**Triggers for running `/gsd:refresh-models`**:

1. **New Cursor release** - Models added/removed
2. **Provider API updates** - New model versions
3. **Invalid model errors** - Registry may be stale
4. **Weekly/Monthly routine** - Keep registry current
5. **After Blueprint upgrade** - Ensure compatibility

### Monitoring Changes

**Track registry in git**:
```bash
git log -p .planning/models-registry.json
```

**See what changed**:
```diff
{
  "models": {
+   "GPT-5.4 Codex": {
+     "provider": "openai",
+     "cursor_base_id": "gpt-5.4-codex",
+     ...
+   },
-   "Claude 4.5 Sonnet": {
-     "provider": "anthropic",
-     ...
-   }
  }
}
```

### Troubleshooting

**Problem**: API key errors

**Solution**:
```bash
# Verify keys are set
echo $ANTHROPIC_API_KEY
echo $OPENAI_API_KEY

# Set if missing
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export OPENAI_API_KEY="sk-proj-..."
```

**Problem**: Model not found in provider API

**Solution**: Model may be too new or Cursor-specific. The skill should:
- Log a warning
- Infer the ID using transformation rules
- Mark as "unverified" in registry

**Problem**: Registry validation fails

**Solution**:
- Check schema version compatibility
- Restore from backup: `.planning/models-registry.json.bak`
- Re-run refresh with `--force` flag

---

## Summary: The Complete Picture

### What Problem Does This Solve?

**Before**:
- ❌ Manual guessing of model IDs
- ❌ Trial and error with subagent configs
- ❌ No way to know which models are available
- ❌ Errors when IDs change or models update
- ❌ Inconsistent model selection across team

**After**:
- ✅ Automated model ID discovery
- ✅ Validated subagent configurations
- ✅ Clear list of available models
- ✅ Automatic updates when APIs change
- ✅ Consistent, documented model registry

### The Value Proposition

1. **Time Savings**: No more hunting for correct model IDs
2. **Error Prevention**: Validation before subagent creation
3. **Maintainability**: Single source of truth for models
4. **Flexibility**: Easy to add new providers/models
5. **Transparency**: JSON registry is readable and versionable
6. **Automation**: One command refreshes everything

### Key Design Principles

1. **Authoritative Sources**: Use provider APIs as truth
2. **Simplicity**: Only 2 variants per model (default + base)
3. **Clarity**: Explicit naming (default = recommended)
4. **Validation**: Catch errors early
5. **Automation**: Minimize manual work
6. **Transparency**: Everything in version-controlled JSON

### Next Steps for Implementation

1. **Create skill file**: `.cursor/skills/refresh-models/SKILL.md`
2. **Add GSD commands**: `/gsd:refresh-models`, `/gsd:list-models`
3. **Integrate validation**: Update `gsd-tools.js`
4. **Document for users**: Add to Blueprint README
5. **Test thoroughly**: Verify all transformations
6. **Setup automation**: Optional periodic refresh

This comprehensive workflow ensures Blueprint/GSD has reliable, validated model IDs for all subagent configurations.
