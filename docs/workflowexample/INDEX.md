# Model ID Resolution Workflow - Documentation Index

**Location**: `docs/workflowexample/`  
**Purpose**: Complete documentation for building a Blueprint/GSD skill that maintains a validated registry of Cursor model IDs

---

## 📚 Documentation Files

### 1. **START HERE** → `SUMMARY.md`
**Quick overview of everything**
- What was completed
- Key findings
- High-level workflow
- Models included (5 models, 9 variants)
- Quick links to other docs

**Read this first** to understand the project scope.

---

### 2. **REFERENCE** → `README.md` (331 lines)
**Overview and quick reference**
- Problem statement
- Solution overview
- File descriptions
- High-level workflow diagram
- Key concepts
- Transformation rules
- Integration with Blueprint/GSD
- Benefits (before/after)
- Troubleshooting FAQ

**Use this** for quick lookups and understanding.

---

### 3. **DEEP DIVE** → `FetchModels and resolve to slugs.md` (2,075 lines)
**Complete comprehensive documentation**

**Contents**:
- Executive summary
- **Skill Implementation** (complete 7-step workflow)
  - Environment setup
  - Cursor docs fetching
  - Model filtering
  - Provider APIs (Anthropic, OpenAI)
  - ID transformation algorithms
  - Variant generation
  - Registry structure
  - Validation & persistence
- **Research Phase** (what was tested)
  - OpenRouter API (failed)
  - Anthropic API (success)
  - OpenAI API (success)
- **Transformation Functions** (with code)
- **Integration Guide** (GSD commands)
- **Complete Examples** (logs, outputs, errors)
- **Maintenance & Updates**

**Read this** for complete understanding before implementation.

---

### 4. **BUILD GUIDE** → `IMPLEMENTATION-GUIDE.md` (250 lines)
**Developer quick reference for building the skill**

**Contents**:
- 7-step workflow (visual)
- Model selection rationale
- Transformation logic (diagrams)
- Required API calls (with examples)
- Registry structure (JSON example)
- Implementation checklist (3 phases)
- Code snippets (ready to use)
  - `transformAnthropicId()`
  - `generateVariants()`
  - `validateRegistry()`
- Testing procedures
- Success criteria
- Common issues & fixes

**Use this** while implementing the skill.

---

### 5. **TEST CODE** → `test-model-resolution.js` (172 lines)
**Working executable test**

**Features**:
- Anthropic ID transformation
- OpenAI ID pass-through
- Variant generation
- Validation against known IDs
- 4 test cases (all passing ✓)

**Run**: `node test-model-resolution.js`

**Use this** to verify transformation logic works.

---

### 6. **THIS FILE** → `INDEX.md`
**Navigation guide for all docs**

---

## 🎯 Reading Path by Use Case

### "I need to understand what this is"
1. Read: `SUMMARY.md` (5 min)
2. Read: `README.md` (10 min)

### "I need to implement the skill"
1. Read: `SUMMARY.md` (5 min)
2. Read: `FetchModels and resolve to slugs.md` (60 min)
3. Use: `IMPLEMENTATION-GUIDE.md` (reference)
4. Run: `test-model-resolution.js` (verify)

### "I need to understand the API testing"
1. Read: `FetchModels and resolve to slugs.md`
   - Section: "Workflow Execution" (steps 2-4)
   - Section: "API Endpoints"
   - Section: "Complete API Testing Examples"

### "I need transformation code examples"
1. Read: `IMPLEMENTATION-GUIDE.md` → "Code Snippets"
2. Or: `FetchModels and resolve to slugs.md` → "Transformation Functions"
3. Run: `test-model-resolution.js` (see it work)

### "I need to integrate with GSD"
1. Read: `FetchModels and resolve to slugs.md` → "Integration with Blueprint/GSD"
2. Read: `IMPLEMENTATION-GUIDE.md` → "Implementation Checklist"

---

## 📊 Quick Stats

| Metric | Value |
|--------|-------|
| **Total Lines** | 2,800+ |
| **Total Size** | 75+ KB |
| **Documentation Files** | 5 |
| **Code Files** | 1 (test script) |
| **Models Documented** | 5 |
| **Variants Documented** | 9 |
| **API Endpoints** | 2 (Anthropic, OpenAI) |
| **Transformation Rules** | 2 (Anthropic, OpenAI) |

---

## 🔑 Key Concepts

### The 5 Models
1. Claude 4.6 Opus (Anthropic) - Most capable
2. Claude 4.5 Sonnet (Anthropic) - Balanced
3. GPT-5.3 Codex (OpenAI) - Latest coding
4. GPT-5.2 (OpenAI) - Latest general
5. Composer 1.5 (Cursor) - Native IDE

### The 2 Variants Per Model
- **default**: High reasoning + thinking (recommended)
- **base**: No enhancements (cost-effective)

### Special Model Values
- **`inherit`**: Subagent uses parent agent's model
- **`fast`**: Maps to Composer 1 (fastest/cheapest)

### The 3 Transformation Rules
1. **Anthropic**: Complex (version format + reordering)
2. **OpenAI**: Simple (use directly)
3. **Cursor**: Static (lookup table)

---

## 🚀 Quick Commands

```bash
# Test transformation logic
cd docs/workflowexample
node test-model-resolution.js

# View documentation
cat SUMMARY.md              # Quick overview
cat README.md               # Reference guide
cat IMPLEMENTATION-GUIDE.md # Build guide

# Open full docs
open "FetchModels and resolve to slugs.md"

# Future: Run the skill
/gsd:refresh-models
/gsd:list-models
```

---

## ✅ Implementation Checklist

Use this checklist when building the skill:

### Phase 1: Core Skill
- [ ] Read all documentation
- [ ] Set up environment variables
- [ ] Create skill file
- [ ] Implement 10 steps (see IMPLEMENTATION-GUIDE.md)
- [ ] Test with test-model-resolution.js

### Phase 2: GSD Integration
- [ ] Add `/gsd:refresh-models` command
- [ ] Add `/gsd:list-models` command
- [ ] Add validation to gsd-tools.js
- [ ] Update subagent creation

### Phase 3: Testing & Docs
- [ ] Test all 5 models
- [ ] Verify all 9 variants
- [ ] Test error handling
- [ ] Document in main README

---

## 🔗 External References

- **Cursor Models**: https://cursor.com/docs/models
- **Anthropic API**: https://api.anthropic.com/v1/models
- **OpenAI API**: https://api.openai.com/v1/models

---

## 📝 File Sizes

```
62K  FetchModels and resolve to slugs.md  (2,075 lines)
8.4K README.md                             (331 lines)
4.8K test-model-resolution.js              (172 lines)
~12K IMPLEMENTATION-GUIDE.md               (~250 lines)
~8K  SUMMARY.md                            (~200 lines)
~2K  INDEX.md                              (this file)
```

**Total**: ~97 KB of documentation

---

## 🎓 Learning Path

**Beginner** (Never seen this before):
```
1. SUMMARY.md          → Understand what this is
2. README.md           → Learn the concepts
3. test-model-resolution.js → See it work
```

**Intermediate** (Ready to build):
```
1. SUMMARY.md                      → Quick overview
2. FetchModels and resolve...      → Deep understanding
3. IMPLEMENTATION-GUIDE.md         → Build checklist
4. test-model-resolution.js        → Verify logic
```

**Advanced** (Just need reference):
```
→ IMPLEMENTATION-GUIDE.md → Code snippets
→ test-model-resolution.js → Working examples
```

---

## 📞 Support

**Questions about the workflow?**
- Read: `FetchModels and resolve to slugs.md`
- Check: `README.md` → "Troubleshooting"

**Questions about implementation?**
- Read: `IMPLEMENTATION-GUIDE.md`
- Check: Code snippets section

**Code not working?**
- Run: `test-model-resolution.js`
- Compare: Your code vs test script

---

**Last Updated**: February 11, 2026  
**Status**: ✅ Complete & Ready for Implementation
