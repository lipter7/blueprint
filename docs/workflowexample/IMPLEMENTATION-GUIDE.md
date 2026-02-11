# Implementation Guide: Model Registry Skill

**Quick Reference for Building the Skill**

---

## What This Skill Does

Automatically maintains a JSON registry of Cursor models with validated IDs for Blueprint/GSD subagent configuration.

**Input**: `/gsd:refresh-models` command  
**Output**: `.planning/models-registry.json` with 5 models, 9 variants

---

## The 7-Step Workflow

```
1. ENV SETUP          → Read ANTHROPIC_API_KEY, OPENAI_API_KEY
2. FETCH CURSOR       → WebFetch https://cursor.com/docs/models
3. FILTER MODELS      → Keep only latest 5 models
4. FETCH APIS         → Anthropic + OpenAI model lists
5. TRANSFORM IDs      → Apply conversion rules
6. GENERATE VARIANTS  → Create default + base for each
7. SAVE & VALIDATE    → Write .planning/models-registry.json
```

---

## Models Included (5 Total)

| Provider | Model | Why Included |
|----------|-------|--------------|
| Anthropic | Claude 4.6 Opus | Latest, most capable |
| Anthropic | Claude 4.5 Sonnet | Latest Sonnet, balanced |
| OpenAI | GPT-5.3 Codex | Latest coding model |
| OpenAI | GPT-5.2 | Latest general model |
| Cursor | Composer 1.5 | Native IDE model |

**Special Values**:
- `model: inherit` - Subagent uses parent's model
- `model: fast` - Maps to Composer 1 (fastest/cheapest)

**Excluded**: Older versions (Claude 4, GPT-5.1), other providers (Gemini, Grok)

---

## Transformation Logic

### Anthropic (Complex)

```
API Response:        claude-opus-4-6-20250205
    ↓ Remove date:   claude-opus-4-6
    ↓ Parse:         tier=opus, version=[4,6]
    ↓ Join version:  4.6
    ↓ Reorder:       claude-{version}-{tier}
Cursor ID:           claude-4.6-opus
```

### OpenAI (Simple)

```
API Response:  gpt-5.2-codex
Cursor ID:     gpt-5.2-codex  (no change!)
```

### Add Variants

```
Base ID:       claude-4.6-opus
    ↓ default: claude-4.6-opus-high-thinking (recommended)
    ↓ base:    claude-4.6-opus (cost-effective)
```

---

## API Calls Required

### Anthropic
```bash
curl https://api.anthropic.com/v1/models \
  -H "anthropic-version: 2023-06-01" \
  -H "X-Api-Key: $ANTHROPIC_API_KEY"
```

Returns: `claude-opus-4-6`, `claude-sonnet-4-5-20250929`

### OpenAI
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Returns: `gpt-5.3-codex`, `gpt-5.2`

---

## Registry Output Structure

```json
{
  "schema_version": "1.0.0",
  "last_updated": "2026-02-11T18:30:00Z",
  
  "special_values": {
    "inherit": {
      "description": "Subagent inherits parent agent's model",
      "use_case": "Maintains consistency across agent chains"
    },
    "fast": {
      "description": "Maps to Composer 1 (fastest, most cost-effective)",
      "resolves_to": "composer-1",
      "use_case": "Quick tasks with minimal cost/latency"
    }
  },
  
  "models": {
    "Claude 4.6 Opus": {
      "provider": "anthropic",
      "api_id": "claude-opus-4-6",
      "cursor_base_id": "claude-4.6-opus",
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
      },
      "pricing": {
        "input_per_1m": 5.0,
        "output_per_1m": 25.0
      }
    }
  }
}
```

---

## Implementation Checklist

### Phase 1: Core Skill
- [ ] Create `.cursor/skills/refresh-models/SKILL.md`
- [ ] Implement step 1: Read environment variables
- [ ] Implement step 2: Fetch Cursor docs (WebFetch)
- [ ] Implement step 3: Filter to 5 relevant models
- [ ] Implement step 4: Fetch Anthropic API
- [ ] Implement step 5: Fetch OpenAI API
- [ ] Implement step 6: Transform Anthropic IDs
- [ ] Implement step 7: Generate variants
- [ ] Implement step 8: Build JSON structure
- [ ] Implement step 9: Validate schema
- [ ] Implement step 10: Save to file

### Phase 2: GSD Integration
- [ ] Add `/gsd:refresh-models` command
- [ ] Add `/gsd:list-models` command
- [ ] Add `loadModelRegistry()` to gsd-tools.js
- [ ] Add `validateSubagentModel()` to gsd-tools.js
- [ ] Update subagent creation to validate models

### Phase 3: Testing & Documentation
- [ ] Test with all 5 models
- [ ] Verify all 9 variants work
- [ ] Test invalid model ID rejection
- [ ] Document in main README
- [ ] Add troubleshooting guide

---

## Code Snippets

### Transform Anthropic ID
```javascript
function transformAnthropicId(apiId) {
  let id = apiId.replace(/-\d{8}$/, ''); // Remove date
  const parts = id.split('-');
  const provider = parts[0];
  const possibleTier = parts[1];
  const isTier = ['opus', 'sonnet', 'haiku'].includes(possibleTier);
  
  let tier, versionParts;
  if (isTier) {
    tier = parts[1];
    versionParts = parts.slice(2);
  } else {
    tier = parts[parts.length - 1];
    versionParts = parts.slice(1, parts.length - 1);
  }
  
  const version = versionParts.join('.');
  return `${provider}-${version}-${tier}`;
}
```

### Generate Variants
```javascript
function generateVariants(baseId, provider) {
  const supportsThinking = provider !== 'cursor';
  
  return {
    default: {
      model_id: supportsThinking 
        ? `${baseId}-high-thinking` 
        : `${baseId}-thinking`,
      reasoning: supportsThinking ? 'high' : null,
      thinking: true,
      recommended: true
    },
    base: {
      model_id: baseId,
      reasoning: null,
      thinking: false,
      recommended: false
    }
  };
}
```

### Validate Registry
```javascript
function validateRegistry(registry) {
  if (!registry.schema_version) {
    throw new Error('Missing schema_version');
  }
  
  for (const [name, model] of Object.entries(registry.models)) {
    if (!model.cursor_base_id) {
      throw new Error(`${name}: Missing cursor_base_id`);
    }
    if (!model.variants.default) {
      throw new Error(`${name}: Missing default variant`);
    }
  }
  
  return true;
}
```

---

## Testing

### Manual Test
```bash
# 1. Set API keys
export ANTHROPIC_API_KEY="sk-ant-api03-..."
export OPENAI_API_KEY="sk-proj-..."

# 2. Run skill
/gsd:refresh-models

# 3. Verify output
cat .planning/models-registry.json

# 4. List models
/gsd:list-models

# 5. Test in subagent
/gsd:create-subagent --name "test" \
  --model "claude-4.5-sonnet-high-thinking"
```

### Automated Test
```bash
cd docs/workflowexample
node test-model-resolution.js

# Expected: 4/4 tests passed ✓
```

---

## Success Criteria

✅ Registry contains exactly 5 models  
✅ Registry contains exactly 9 variants  
✅ All model IDs follow pattern: `{provider}-{version}-{tier}[-{reasoning}][-thinking]`  
✅ Anthropic IDs transformed correctly (dots in version)  
✅ OpenAI IDs preserved (used directly)  
✅ Each model has "default" variant marked as recommended  
✅ Registry validates against schema  
✅ File saved to `.planning/models-registry.json`  
✅ Invalid model IDs rejected during subagent creation  
✅ `/gsd:list-models` displays correctly

---

## Common Issues

**Issue**: API key not found  
**Fix**: Set environment variables before running skill

**Issue**: Model not in API response  
**Fix**: Use inferred ID, mark as unverified in registry

**Issue**: Transformation produces wrong format  
**Fix**: Check version parsing logic for edge cases

**Issue**: Validation fails  
**Fix**: Verify JSON structure matches schema

---

## References

- **Full Documentation**: `FetchModels and resolve to slugs.md` (2000+ lines)
- **Test Script**: `test-model-resolution.js`
- **Quick Reference**: `README.md`
- **This Guide**: `IMPLEMENTATION-GUIDE.md`

---

## Quick Commands

```bash
# Test transformation logic
node docs/workflowexample/test-model-resolution.js

# Refresh registry
/gsd:refresh-models

# List available models
/gsd:list-models

# Validate subagent
/gsd:validate-subagent path/to/agent.md

# View registry
cat .planning/models-registry.json | jq .
```

---

**Ready to implement?** Start with Phase 1, test each step, then move to GSD integration.
