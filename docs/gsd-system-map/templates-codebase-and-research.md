# GSD Templates: Codebase Analysis and Research Project

## Overview

The GSD framework uses two distinct sets of templates that produce structured documentation in the `.planning/` directory. These templates serve as scaffolding instructions -- they define the shape, sections, and filling guidelines for documents that agents write during project setup and analysis.

**Codebase Templates (7 files)** live in `get-shit-done/templates/codebase/` and produce documents at `.planning/codebase/`. They describe an *existing* codebase -- what is already built, how it works, what patterns it follows, and what problems it has. These are retrospective analysis documents used when working on brownfield projects or when code already exists.

**Research Project Templates (5 files)** live in `get-shit-done/templates/research-project/` and produce documents at `.planning/research/`. They describe a *domain ecosystem* -- what technologies to use, what features to build, what architecture to follow, and what mistakes to avoid. These are prospective research documents used when starting new projects or new milestones.

Both sets feed downstream into roadmap creation and phase planning. The codebase templates answer "what do we have?", the research templates answer "what should we build?". Together they give the planning system a complete picture: existing state plus future direction.

---

## Codebase Templates (7 files)

All codebase templates share a common structure:
- A header describing what the template is and where the output goes
- A `## File Template` section containing the actual markdown template in a fenced code block
- A `<good_examples>` XML tag with a fully filled-out example
- A `<guidelines>` XML tag with filling instructions, scope rules, and usage notes

### architecture.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/architecture.md`

**What it scaffolds:** `.planning/codebase/ARCHITECTURE.md` -- captures the conceptual code organization of an existing codebase.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Pattern Overview** -- Overall architectural pattern name (e.g., "Monolithic CLI", "Serverless API", "Full-stack MVC") plus key characteristics as bullet list
- **Layers** -- Repeating structure per layer: Purpose, Contains, Depends on, Used by
- **Data Flow** -- Named flow (e.g., "HTTP Request", "CLI Command") with numbered lifecycle steps, plus State Management subsection
- **Key Abstractions** -- Repeating structure: Purpose, Examples (file paths), Pattern name
- **Entry Points** -- Location, Triggers, Responsibilities
- **Error Handling** -- Strategy statement plus patterns list
- **Cross-Cutting Concerns** -- Logging, Validation, Authentication approaches
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `arch`. This agent is spawned by the `/gsd:map-codebase` command's workflow. The mapper agent writes ARCHITECTURE.md directly to `.planning/codebase/` and returns only a confirmation to the orchestrator.

**Downstream consumers:**
- `/gsd:plan-phase` loads ARCHITECTURE.md for API/backend/endpoint phases and refactor/cleanup phases
- `/gsd:execute-phase` references it to understand where new code fits in existing layers
- `/gsd:new-project` reads it for brownfield projects to infer Validated requirements from existing capabilities

**Paths referenced:** `.planning/codebase/ARCHITECTURE.md` (output location). The template itself uses generic `src/` paths in examples.

**Notable patterns:**
- Uses `<good_examples>` XML tag wrapping a complete filled example (a CLI application with plugin system)
- Uses `<guidelines>` XML tag with explicit "What belongs" / "What does NOT belong" / "When filling" / "Useful for" sections
- The example includes a `Location:` field on layers that the template itself does not -- showing the mapper agent is expected to enrich beyond the template skeleton
- Explicitly states "File paths ARE welcome" and "Include file paths as concrete examples of abstractions"
- Distinguishes itself from STRUCTURE.md (physical files) and STACK.md (technology choices)

**Prescriptiveness:** Moderately prescriptive. The section structure is fixed but the content within each section is entirely flexible. The template provides placeholder patterns like `[Layer Name]` that repeat as needed. The guidelines are strongly worded ("Keep descriptions conceptual, not mechanical") directing the filling agent's judgment.

---

### concerns.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/concerns.md`

**What it scaffolds:** `.planning/codebase/CONCERNS.md` -- captures known issues and areas requiring care.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Tech Debt** -- Repeating: Area/Component name, Issue, Why, Impact, Fix approach
- **Known Bugs** -- Repeating: Bug description, Symptoms, Trigger, Workaround, Root cause, Blocked by
- **Security Considerations** -- Repeating: Area, Risk, Current mitigation, Recommendations
- **Performance Bottlenecks** -- Repeating: Slow operation, Problem, Measurement (actual numbers), Cause, Improvement path
- **Fragile Areas** -- Repeating: Component, Why fragile, Common failures, Safe modification, Test coverage
- **Scaling Limits** -- Repeating: Resource/System, Current capacity (numbers), Limit, Symptoms at limit, Scaling path
- **Dependencies at Risk** -- Repeating: Package, Risk, Impact, Migration plan
- **Missing Critical Features** -- Repeating: Feature gap, Problem, Current workaround, Blocks, Implementation complexity
- **Test Coverage Gaps** -- Repeating: Untested area, What's not tested, Risk, Priority, Difficulty to test
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `concerns`. This is the only focus area that produces a single document rather than a pair.

**Downstream consumers:**
- `/gsd:plan-phase` loads CONCERNS.md for refactor/cleanup phases
- `/gsd:execute-phase` references it to avoid introducing more technical debt
- Concerns may be promoted into future roadmap phases

**Paths referenced:** `.planning/codebase/CONCERNS.md` (output location). Template and example both emphasize file paths with backticks for every finding.

**Notable patterns:**
- The most detailed `<good_examples>` section of all codebase templates (139 lines of filled example)
- The example demonstrates a full Next.js + Supabase + Stripe application with concrete file paths, line numbers, and specific measurements
- Example includes `Files:` fields listing exact file paths for every concern -- reinforcing the "always include file paths" philosophy
- Guidelines include **Tone guidelines** (unique to this template): "Professional, not emotional", "Solution-oriented", "Risk-focused", "Factual"
- States: "How this gets populated: Explore agents detect these during codebase mapping. Manual additions welcome for human-discovered issues."
- Explicitly excludes: "Opinions without evidence", "Complaints without solutions", "Normal TODOs"
- This is described as "living documentation, not a complaint list"

**Prescriptiveness:** Highly prescriptive about tone and format, but the number and nature of sections to fill is flexible. Sections with no findings should use "None detected" implicitly. The template demands measurements ("500ms p95" not "slow") and file paths for every finding.

---

### conventions.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/conventions.md`

**What it scaffolds:** `.planning/codebase/CONVENTIONS.md` -- captures coding style and patterns as a prescriptive guide.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Naming Patterns** -- Files, Functions, Variables, Types (each with bullet pattern examples)
- **Code Style** -- Formatting (tool, line length, quotes, semicolons), Linting (tool, rules, run command)
- **Import Organization** -- Ordered numbered list of import groups, Grouping rules, Path Aliases
- **Error Handling** -- Patterns, Error Types (when to throw, when to return, logging)
- **Logging** -- Framework, Patterns (format, when, where)
- **Comments** -- When to Comment, JSDoc/TSDoc, TODO Comments
- **Function Design** -- Size, Parameters, Return Values
- **Module Design** -- Exports, Barrel Files
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `quality`. This agent also produces TESTING.md.

**Downstream consumers:**
- `/gsd:plan-phase` loads CONVENTIONS.md for UI/frontend/component phases, API/backend phases, and testing phases
- `/gsd:execute-phase` uses it to write code that matches existing style

**Paths referenced:** `.planning/codebase/CONVENTIONS.md` (output location).

**Notable patterns:**
- The template header explicitly states: "Prescriptive guide for Claude to match existing style"
- Guidelines instruct: "Be prescriptive: 'Use X' not 'Sometimes Y is used'"
- Guidelines note: "Note deviations: 'Legacy code uses Y, new code should use X'"
- Analysis approach is specified: scan `src/` for patterns, check `package.json` scripts, read 5-10 files, look for config files
- Guidelines say "Keep under ~150 lines total" -- the only template with an explicit length recommendation
- Cross-references other templates in "What does NOT belong": ARCHITECTURE.md, STACK.md, TESTING.md, STRUCTURE.md

**Prescriptiveness:** The most prescriptive template of the set. It explicitly aims to produce a prescriptive document -- one that tells future Claude instances how to write code, not merely describes what exists. The filling agent is told to state patterns as directives.

---

### integrations.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/integrations.md`

**What it scaffolds:** `.planning/codebase/INTEGRATIONS.md` -- captures external service dependencies.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **APIs & External Services** -- Categories: Payment Processing, Email/SMS, External APIs. Each with Service, SDK/Client, Auth, Endpoints/Templates/Rate limits
- **Data Storage** -- Databases (Type, Connection, Client, Migrations), File Storage (Service, SDK, Auth, Buckets), Caching (Service, Connection, Client)
- **Authentication & Identity** -- Auth Provider (Service, Implementation, Token storage, Session management), OAuth Integrations (Provider, Credentials, Scopes)
- **Monitoring & Observability** -- Error Tracking (Service, DSN, Release tracking), Analytics (Service, Token, Events), Logs (Service, Integration)
- **CI/CD & Deployment** -- Hosting (Platform, Deployment, Env vars), CI Pipeline (Service, Workflows, Secrets)
- **Environment Configuration** -- Development (required env vars, secrets location, mock services), Staging (differences, data), Production (secrets management, failover)
- **Webhooks & Callbacks** -- Incoming (Service, Endpoint, Verification, Events), Outgoing (Service, Trigger, Endpoint, Retry logic)
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `tech`. This agent also produces STACK.md.

**Downstream consumers:**
- `/gsd:plan-phase` loads INTEGRATIONS.md for integration/external API phases
- `/gsd:execute-phase` references it for understanding external dependencies

**Paths referenced:** `.planning/codebase/INTEGRATIONS.md` (output location).

**Notable patterns:**
- Contains a prominent **Security note** in guidelines: "Document WHERE secrets live (env vars, Vercel dashboard, 1Password), never WHAT the secrets are"
- The example demonstrates a complete Stripe + SendGrid + Supabase + OpenAI integration landscape
- Cross-references: "Internal architecture (that's ARCHITECTURE.md)", "Technology choices (that's STACK.md)", "Performance issues (that's CONCERNS.md)"
- Analysis instructions: "Check .env.example or .env.template for required env vars", "Look for SDK imports"
- The most externally-focused template -- everything here is about what lives outside the codebase

**Prescriptiveness:** Moderate. The section structure is prescriptive (specific categories like Payment Processing, Email/SMS are named), but each section can be filled freely or marked "None". The template is more of a checklist-driven inventory than a prescriptive guide.

---

### stack.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/stack.md`

**What it scaffolds:** `.planning/codebase/STACK.md` -- captures the technology foundation.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Languages** -- Primary (Language, Version, Where used), Secondary (same format)
- **Runtime** -- Environment (Runtime, Version), Package Manager (Manager, Version, Lockfile status)
- **Frameworks** -- Core, Testing, Build/Dev (each: Framework, Version, Purpose)
- **Key Dependencies** -- Critical and Infrastructure (each: Package, Version, Why it matters). Note: "Only include dependencies critical to understanding the stack - limit to 5-10 most important"
- **Configuration** -- Environment (how configured, key configs), Build (config files)
- **Platform Requirements** -- Development (OS, tooling), Production (deployment target, versions)
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `tech`. This agent also produces INTEGRATIONS.md.

**Downstream consumers:**
- `/gsd:plan-phase` loads STACK.md for database/schema/model phases, integration phases, and setup/config phases
- `/gsd:execute-phase` references it for compatibility decisions
- `/gsd:new-project` reads it for brownfield projects to infer Validated requirements

**Paths referenced:** `.planning/codebase/STACK.md` (output location).

**Notable patterns:**
- Explicitly limits key dependencies to "5-10 most important" -- prevents exhaustive package.json dumps
- The good example shows a CLI tool with zero framework dependencies, demonstrating that "None" is a valid answer
- Guidelines state: "Include only dependencies that affect understanding (not every utility)"
- Focuses on "what executes when you run the code" -- runtime and build-time, not development opinion
- The shortest template of the codebase set (187 lines including all sections)

**Prescriptiveness:** Low to moderate. The section structure is fixed but sparse. This is an inventory template, not a prescriptive guide. The filling agent reports what exists rather than making recommendations.

---

### structure.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/structure.md`

**What it scaffolds:** `.planning/codebase/STRUCTURE.md` -- captures physical file organization.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Directory Layout** -- ASCII box-drawing tree using `(U+251C) (U+2500) (U+2514) (U+2502)` characters, showing top-level directories with `# Purpose` comments
- **Directory Purposes** -- Repeating: Directory Name, Purpose, Contains, Key files, Subdirectories
- **Key File Locations** -- Entry Points, Configuration, Core Logic, Testing, Documentation (each with Path and Purpose)
- **Naming Conventions** -- Files (patterns with examples), Directories (patterns), Special Patterns (e.g., index.ts)
- **Where to Add New Code** -- New Feature (Primary code, Tests, Config paths), New Component/Module, New Route/Command, Utilities
- **Special Directories** -- Purpose, Source, Committed status (gitignored or not)
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `arch`. This agent also produces ARCHITECTURE.md.

**Downstream consumers:**
- `/gsd:plan-phase` loads STRUCTURE.md for UI/frontend/component phases and setup/config phases
- `/gsd:execute-phase` uses it to know where to place new files
- The execute-phase workflow specifically updates STRUCTURE.md when structural changes occur (new directories, renamed paths)

**Paths referenced:** `.planning/codebase/STRUCTURE.md` (output location). The good example uses GSD's own directory structure as the example.

**Notable patterns:**
- Explicitly instructs use of ASCII box-drawing characters for the tree diagram
- The "Where to Add New Code" section is unique and forward-looking -- it is the only section in any codebase template that provides guidance for future actions rather than documenting current state
- Guidelines specify: "Keep directory tree concise (max 2-3 levels)"
- Guidelines suggest: "Use `tree -L 2` or similar to visualize structure"
- The good example self-referentially documents the GSD framework itself
- Execute-phase workflow has specific rules for when to update this document: "new src/ dir -> STRUCTURE.md"

**Prescriptiveness:** Moderate. The tree format is prescribed. The "Where to Add New Code" section is explicitly prescriptive (telling future agents where to put things). The rest is descriptive inventory.

---

### testing.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/codebase/testing.md`

**What it scaffolds:** `.planning/codebase/TESTING.md` -- captures test framework and patterns.

**Template structure:**
- **Analysis Date** -- `[YYYY-MM-DD]` placeholder
- **Test Framework** -- Runner (Framework, Config), Assertion Library (Library, Matchers), Run Commands (bash code block with common commands)
- **Test File Organization** -- Location (pattern), Naming (per test type), Structure (directory tree pattern)
- **Test Structure** -- Suite Organization (TypeScript code block showing describe/it pattern), Patterns (setup, teardown, structure notes)
- **Mocking** -- Framework (Tool, Import mocking), Patterns (TypeScript code block with mock examples), What to Mock (list), What NOT to Mock (list)
- **Fixtures and Factories** -- Test Data (TypeScript code block with factory pattern), Location (where fixtures live)
- **Coverage** -- Requirements (target, enforcement), Configuration (tool, exclusions), View Coverage (commands)
- **Test Types** -- Unit Tests (scope, mocking, speed), Integration Tests (scope, mocking, setup), E2E Tests (framework, scope, location)
- **Common Patterns** -- Async Testing (code block), Error Testing (code block), Snapshot Testing (usage notes)
- **Footer** -- Date stamp and update instruction

**Producer:** The `gsd-codebase-mapper` agent with focus area `quality`. This agent also produces CONVENTIONS.md.

**Downstream consumers:**
- `/gsd:plan-phase` loads TESTING.md for testing/tests phases
- `/gsd:execute-phase` uses it to match existing test patterns when writing new tests

**Paths referenced:** `.planning/codebase/TESTING.md` (output location).

**Notable patterns:**
- The most code-heavy template -- contains multiple TypeScript code block placeholders for real patterns
- The good example shows a complete Vitest setup with factory functions, mock patterns, and assertion styles
- Guidelines instruct: "Document actual patterns used, not ideal patterns" -- emphasizing descriptive accuracy
- Analysis approach is detailed: "Check package.json for test framework and scripts", "Read test config file", "Examine test file organization", "Review 5 test files for patterns"
- The "What to Mock" / "What NOT to Mock" guidance is prescriptive and helps future agents make correct decisions
- The template shows both describe/it syntax and standalone test patterns

**Prescriptiveness:** High. While the template documents what exists, it structures that documentation as prescriptive guidance. The code blocks serve as copy-paste patterns for future test writing. "What to Mock" / "What NOT to Mock" are explicit directives.

---

## Research Project Templates (5 files)

Research project templates differ structurally from codebase templates. They use:
- A `<template>` XML tag wrapping the markdown template in a fenced code block
- A `<guidelines>` XML tag with filling instructions
- No `<good_examples>` section (unlike codebase templates)
- Section names use ALL CAPS filenames (ARCHITECTURE.md, FEATURES.md, etc.)

### ARCHITECTURE.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/research-project/ARCHITECTURE.md`

**What it scaffolds:** `.planning/research/ARCHITECTURE.md` -- system structure patterns for the project domain.

**Template structure:**
- **Domain** -- `[domain type]` placeholder
- **Researched** -- `[date]` placeholder
- **Confidence** -- `[HIGH/MEDIUM/LOW]` tri-level assessment
- **Standard Architecture** -- System Overview with ASCII box-drawing diagram (multi-layer component diagram), Component Responsibilities table (Component, Responsibility, Typical Implementation)
- **Recommended Project Structure** -- Directory tree with purpose annotations, Structure Rationale explanations
- **Architectural Patterns** -- Repeating numbered patterns: What, When to use, Trade-offs, Example (TypeScript code block)
- **Data Flow** -- Request Flow (ASCII arrow diagram), State Management (ASCII diagram), Key Data Flows (numbered descriptions)
- **Scaling Considerations** -- Table by user scale (0-1k, 1k-100k, 100k+), Scaling Priorities (first bottleneck, second bottleneck)
- **Anti-Patterns** -- Repeating: What people do, Why it's wrong, Do this instead
- **Integration Points** -- External Services table (Service, Integration Pattern, Notes), Internal Boundaries table (Boundary, Communication, Notes)
- **Sources** -- References list
- **Footer** -- Domain and date stamp

**Producer:** The `gsd-project-researcher` agent. This agent is spawned by `/gsd:new-project` or `/gsd:new-milestone` orchestrators. It writes ARCHITECTURE.md as part of its research output (step 5 in its execution flow), but only "if patterns discovered" -- this is the one optional file in the research set.

**Downstream consumers:**
- The `gsd-research-synthesizer` agent reads it to extract patterns, component boundaries, and data flow for the SUMMARY.md
- The `gsd-roadmapper` agent uses the synthesized architecture findings for phase structure decisions
- The `/gsd:new-project` workflow loads research/SUMMARY.md (which aggregates ARCHITECTURE.md findings) during roadmap creation

**Paths referenced:** `.planning/research/ARCHITECTURE.md` (output location).

**Notable patterns:**
- Contains elaborate ASCII box-drawing diagrams as placeholders -- multi-layer component diagrams with boxes and connectors
- Includes TypeScript code examples in the architectural patterns section
- Has a dedicated Anti-Patterns section (unique among research templates -- PITFALLS.md covers similar ground but at a higher level)
- Scaling Considerations uses a 3-tier scale table -- realistic about "most projects don't need to scale to millions"
- Guidelines warn: "Note when patterns are overkill for small projects"
- Unlike codebase ARCHITECTURE.md, this is prescriptive about what to BUILD, not descriptive of what EXISTS

**Prescriptiveness:** Highly prescriptive. This template recommends architecture for new projects rather than documenting existing ones. The "Recommended Project Structure" section directly tells the builder what directory layout to create. Anti-patterns provide explicit "Do this instead" directives.

---

### FEATURES.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/research-project/FEATURES.md`

**What it scaffolds:** `.planning/research/FEATURES.md` -- feature landscape for the project domain.

**Template structure:**
- **Domain** -- `[domain type]` placeholder
- **Researched** -- `[date]` placeholder
- **Confidence** -- `[HIGH/MEDIUM/LOW]` tri-level assessment
- **Feature Landscape:**
  - **Table Stakes** -- Table: Feature, Why Expected, Complexity (LOW/MEDIUM/HIGH), Notes. Described as "Features users assume exist. Missing these = product feels incomplete."
  - **Differentiators** -- Table: Feature, Value Proposition, Complexity, Notes. "Features that set the product apart."
  - **Anti-Features** -- Table: Feature, Why Requested, Why Problematic, Alternative. "Features that seem good but create problems."
- **Feature Dependencies** -- ASCII tree showing requires/enhances/conflicts relationships, with Dependency Notes
- **MVP Definition:**
  - **Launch With (v1)** -- Checklist: Feature + why essential
  - **Add After Validation (v1.x)** -- Checklist: Feature + trigger for adding
  - **Future Consideration (v2+)** -- Checklist: Feature + why defer
- **Feature Prioritization Matrix** -- Table: Feature, User Value, Implementation Cost, Priority (P1/P2/P3). Includes priority key definition.
- **Competitor Feature Analysis** -- Table: Feature, Competitor A, Competitor B, Our Approach
- **Sources** -- References list
- **Footer** -- Domain and date stamp

**Producer:** The `gsd-project-researcher` agent. Always produced (not optional).

**Downstream consumers:**
- The `gsd-research-synthesizer` reads it to extract must-have, should-have, and defer features for SUMMARY.md
- The `gsd-roadmapper` uses feature groupings and dependencies to structure phases
- The `/gsd:new-project` workflow reads research/FEATURES.md to extract feature categories when defining requirements

**Paths referenced:** `.planning/research/FEATURES.md` (output location).

**Notable patterns:**
- The **Anti-Features** concept is distinctive -- explicitly documenting what NOT to build, with reasons
- Feature Dependencies use ASCII tree notation with semantic relationships: `requires`, `enhances`, `conflicts`
- The guidelines note: "Anti-Features prevent scope creep by documenting what seems good but isn't"
- MVP Definition section uses checkbox format, making it directly convertible to task lists
- Guidelines reference integration: "Differentiators should align with the Core Value from PROJECT.md"
- Feature Dependencies are flagged as "Critical for roadmap phase ordering" -- dependencies inform which phases come first
- Guidelines enforce ruthlessness: "'Nice to have' is not MVP"

**Prescriptiveness:** Highly prescriptive about prioritization methodology. The three-tier feature classification (Table Stakes / Differentiators / Anti-Features) is a fixed framework. The MVP Definition enforces a specific phasing discipline. The Prioritization Matrix provides a formal scoring system.

---

### PITFALLS.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/research-project/PITFALLS.md`

**What it scaffolds:** `.planning/research/PITFALLS.md` -- common mistakes to avoid in the project domain.

**Template structure:**
- **Domain** -- `[domain type]` placeholder
- **Researched** -- `[date]` placeholder
- **Confidence** -- `[HIGH/MEDIUM/LOW]` tri-level assessment
- **Critical Pitfalls** -- Repeating (numbered with horizontal rule separators): Name, What goes wrong, Why it happens, How to avoid, Warning signs, Phase to address
- **Technical Debt Patterns** -- Table: Shortcut, Immediate Benefit, Long-term Cost, When Acceptable (or "never")
- **Integration Gotchas** -- Table: Integration, Common Mistake, Correct Approach
- **Performance Traps** -- Table: Trap, Symptoms, Prevention, When It Breaks (scale threshold)
- **Security Mistakes** -- Table: Mistake, Risk, Prevention
- **UX Pitfalls** -- Table: Pitfall, User Impact, Better Approach
- **"Looks Done But Isn't" Checklist** -- Checkbox format: Feature, what's often missing, what to verify
- **Recovery Strategies** -- Table: Pitfall, Recovery Cost (LOW/MEDIUM/HIGH), Recovery Steps
- **Pitfall-to-Phase Mapping** -- Table: Pitfall, Prevention Phase, Verification method
- **Sources** -- References list (Post-mortems, community discussions, official "gotchas")
- **Footer** -- Domain and date stamp

**Producer:** The `gsd-project-researcher` agent. Always produced (not optional).

**Downstream consumers:**
- The `gsd-research-synthesizer` reads it to extract top 3-5 pitfalls for SUMMARY.md
- The `gsd-roadmapper` uses the Pitfall-to-Phase Mapping to inform phase ordering and success criteria
- Phase planners reference pitfalls to add prevention measures to their plans

**Paths referenced:** `.planning/research/PITFALLS.md` (output location).

**Notable patterns:**
- **"Looks Done But Isn't" Checklist** is a unique and practical section -- designed for verification during execution phases
- **Phase to address** field on each critical pitfall creates direct links to the roadmap, making pitfalls actionable rather than merely informational
- **Pitfall-to-Phase Mapping** table at the bottom is explicitly "Critical for roadmap creation"
- **Recovery Strategies** acknowledge that prevention may fail, providing fallback plans
- **Technical Debt Patterns** include "When Acceptable" column, acknowledging that some shortcuts are valid (e.g., "only in MVP")
- Guidelines note: "Focus on domain-specific issues, not generic mistakes" and "Include scale thresholds"
- This is the most action-oriented research template -- every section either prevents or recovers from problems

**Prescriptiveness:** Very high. The template structures problem avoidance as a systematic process: identify, prevent, detect, recover. The Phase-to-Pitfall mapping enforces that every pitfall has an owner phase. The "Looks Done But Isn't" checklist is a verification gate.

---

### STACK.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/research-project/STACK.md`

**What it scaffolds:** `.planning/research/STACK.md` -- recommended technologies for the project domain.

**Template structure:**
- **Domain** -- `[domain type]` placeholder
- **Researched** -- `[date]` placeholder
- **Confidence** -- `[HIGH/MEDIUM/LOW]` tri-level assessment
- **Recommended Stack:**
  - **Core Technologies** -- Table: Technology, Version, Purpose, Why Recommended
  - **Supporting Libraries** -- Table: Library, Version, Purpose, When to Use
  - **Development Tools** -- Table: Tool, Purpose, Notes (configuration tips)
- **Installation** -- Bash code block with npm install commands (Core, Supporting, Dev dependencies)
- **Alternatives Considered** -- Table: Recommended, Alternative, When to Use Alternative
- **What NOT to Use** -- Table: Avoid, Why, Use Instead
- **Stack Patterns by Variant** -- Conditional recommendations: "If [condition], Use [variation], Because [reason]"
- **Version Compatibility** -- Table: Package A, Compatible With, Notes
- **Sources** -- References list (Context7 library IDs, official docs)
- **Footer** -- Domain and date stamp

**Producer:** The `gsd-project-researcher` agent. Always produced (not optional).

**Downstream consumers:**
- The `gsd-research-synthesizer` reads it to extract core technologies for SUMMARY.md
- The `gsd-roadmapper` uses technology decisions for phase planning
- The project's requirements definition may reference recommended technologies

**Paths referenced:** `.planning/research/STACK.md` (output location).

**Notable patterns:**
- **"What NOT to Use"** section mirrors the Anti-Features concept from FEATURES.md -- explicitly warning against bad choices
- **"Why Recommended"** column requires rationale, not just listing -- "why experts use it for this domain"
- **"Stack Patterns by Variant"** allows conditional recommendations (e.g., "If real-time needed, use Socket.io")
- **Installation** section provides copy-paste-ready npm commands
- **Sources** section specifically requests Context7 library IDs, reflecting the research agent's tool hierarchy
- Guidelines: "Don't just dismiss alternatives. Explain when alternatives make sense."
- Guidelines: "Actively warn against outdated or problematic choices. Explain the specific problem, not just 'it's old'"
- Version Compatibility section prevents debugging time later -- a pragmatic addition

**Prescriptiveness:** Highly prescriptive. This is an opinionated recommendation document. The "Why Recommended" column demands justification. The "What NOT to Use" section is explicitly directive. The Installation section provides exact commands.

---

### SUMMARY.md

**File:** `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/templates/research-project/SUMMARY.md`

**What it scaffolds:** `.planning/research/SUMMARY.md` -- executive summary of project research with roadmap implications.

**Template structure:**
- **Project** -- `[name from PROJECT.md]` placeholder
- **Domain** -- `[inferred domain type]` placeholder
- **Researched** -- `[date]` placeholder
- **Confidence** -- `[HIGH/MEDIUM/LOW]` tri-level assessment
- **Executive Summary** -- 2-3 paragraphs covering: product type and how experts build it, recommended approach, key risks and mitigations
- **Key Findings:**
  - **Recommended Stack** -- Summary from STACK.md with core technologies list
  - **Expected Features** -- Summary from FEATURES.md: must-have, should-have, defer
  - **Architecture Approach** -- Summary from ARCHITECTURE.md with major components
  - **Critical Pitfalls** -- Top 3-5 from PITFALLS.md with prevention strategies
- **Implications for Roadmap:**
  - Suggested phases (numbered): each with Rationale, Delivers, Addresses (features), Avoids (pitfalls), Uses (stack), Implements (architecture)
  - **Phase Ordering Rationale** -- Why this order based on dependencies, groupings, and pitfall avoidance
  - **Research Flags** -- Phases needing deeper research vs. phases with standard patterns
- **Confidence Assessment** -- Table: Area (Stack/Features/Architecture/Pitfalls), Confidence level, Notes
  - **Overall confidence** level
  - **Gaps to Address** -- Areas needing validation during implementation
- **Sources** -- Three-tier: Primary (HIGH confidence), Secondary (MEDIUM), Tertiary (LOW)
- **Footer** -- Date stamp and "Ready for roadmap: yes"

**Producer:** The `gsd-research-synthesizer` agent. This is the only template filled by a synthesizer rather than a researcher. The synthesizer reads the other 4 research files (STACK, FEATURES, ARCHITECTURE, PITFALLS) produced by parallel `gsd-project-researcher` agents, then produces SUMMARY.md. The template is explicitly referenced in the synthesizer agent: "Use template: ~/.claude/get-shit-done/templates/research-project/SUMMARY.md".

**Downstream consumers:**
- The `gsd-roadmapper` agent is the primary consumer -- SUMMARY.md is loaded as context during roadmap creation. Phase suggestions become the starting point for the roadmap.
- The `/gsd:new-project` workflow loads `@.planning/research/SUMMARY.md` as input to the roadmap creation step.
- The `/gsd:new-milestone` workflow similarly loads SUMMARY.md.

**Paths referenced:** `.planning/research/SUMMARY.md` (output location). References `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` as input sources.

**Notable patterns:**
- This is the **aggregation point** for all research -- it synthesizes, does not duplicate
- Guidelines explicitly state: "Summarize, don't duplicate full documents"
- **Implications for Roadmap** is called out as "the most important section" -- it directly informs roadmap creation
- **Research Flags** per phase tell the roadmapper which phases need `/gsd:research-phase` during planning vs. which can skip it
- The three-tier source classification (PRIMARY/SECONDARY/TERTIARY) maps to confidence levels (HIGH/MEDIUM/LOW)
- Footer includes "Ready for roadmap: yes" -- a signal that the research pipeline is complete
- Guidelines: "Write for someone who will only read this section" (about Executive Summary)
- The template acknowledges its integration point: "This file is loaded as context during roadmap creation"

**Prescriptiveness:** Highly prescriptive about structure but flexible in content. The sections are mandatory. The Implications for Roadmap section must include specific phase suggestions with rationale. The confidence assessment must be honest. This template defines the interface between research and planning.

---

## Comparison: Codebase vs Research Project

### Fundamental Difference in Purpose

| Aspect | Codebase Templates | Research Project Templates |
|--------|-------------------|---------------------------|
| **Temporal orientation** | Retrospective (what IS) | Prospective (what SHOULD BE) |
| **Subject** | An existing codebase | A domain ecosystem |
| **Question answered** | "What do we have?" | "What should we build?" |
| **When used** | Brownfield projects, ongoing maintenance | New projects, new milestones |
| **Output location** | `.planning/codebase/` | `.planning/research/` |
| **Producer agent** | `gsd-codebase-mapper` (4 instances) | `gsd-project-researcher` (4 instances) + `gsd-research-synthesizer` (1 instance) |

### Structural Differences

**Template wrapping:** Codebase templates use a `## File Template` header with `<good_examples>` and `<guidelines>` XML tags. Research templates use `<template>` and `<guidelines>` XML tags. Research templates omit worked examples entirely.

**Confidence tracking:** Research templates include a `**Confidence:** [HIGH/MEDIUM/LOW]` header field. Codebase templates do not -- they document observed facts, so confidence is implicit.

**Source attribution:** Research templates include a `## Sources` section for citing Context7, official docs, and web searches. Codebase templates do not cite sources because the source is the codebase itself.

**Metadata fields:** Research templates have a `**Domain:**` field (describing the product category). Codebase templates have `**Analysis Date:**` instead. Both use date stamps.

### Overlapping Topics

Two topic areas appear in both template sets with different framing:

**Architecture:**
- Codebase `architecture.md` documents how the *existing code* is organized: layers, data flow, entry points, error handling
- Research `ARCHITECTURE.md` recommends how *new code should* be organized: standard patterns, recommended structure, anti-patterns, scaling considerations
- The codebase version is descriptive; the research version is prescriptive with trade-off analysis

**Stack/Technology:**
- Codebase `stack.md` inventories what technologies the *existing code* uses: languages, runtime, frameworks, key dependencies
- Research `STACK.md` recommends what technologies *should be used*: recommended stack, alternatives considered, what NOT to use, installation commands
- The codebase version reports facts; the research version makes opinionated recommendations with justifications

### Why Both Exist

The framework supports two project lifecycles:

1. **Greenfield (new project):** Only research templates are used. The `gsd-project-researcher` investigates the domain, the `gsd-research-synthesizer` produces a summary, and the `gsd-roadmapper` creates phases based on recommendations. No codebase templates are needed because there is no existing code.

2. **Brownfield (existing project):** Both sets may be used. The `gsd-codebase-mapper` documents what exists (codebase templates), then the `/gsd:new-project` workflow can optionally run research to investigate what to build next (research templates). The brownfield path also uses codebase documents to infer "Validated requirements" from existing capabilities.

3. **New milestone on existing project:** The `/gsd:new-milestone` workflow can spawn new research (research templates) while the existing codebase map (codebase templates) is already available and may be refreshed with `/gsd:map-codebase`.

### Template Maturity

The codebase templates are more mature:
- They include extensive `<good_examples>` sections with realistic filled documents
- They have more detailed guidelines with explicit "What belongs" / "What does NOT belong" lists
- They include analysis approaches (what commands to run, how many files to read)
- They cross-reference each other carefully ("that's ARCHITECTURE.md", "that's STACK.md")

The research templates are more streamlined:
- They omit worked examples, relying on the template structure itself to guide filling
- Their guidelines are shorter and more principle-based
- They rely more on the `gsd-project-researcher` agent's extensive process documentation to guide filling
- The agent definition (619 lines) contains its own inline template versions that are slightly simplified from the full templates

### Agent Pipeline Comparison

**Codebase pipeline:**
```
/gsd:map-codebase (command)
  -> map-codebase.md (workflow)
    -> 4x gsd-codebase-mapper agents (parallel, write directly)
      -> tech:     STACK.md + INTEGRATIONS.md
      -> arch:     ARCHITECTURE.md + STRUCTURE.md
      -> quality:  CONVENTIONS.md + TESTING.md
      -> concerns: CONCERNS.md
    -> orchestrator verifies, scans for secrets, commits
```

**Research pipeline:**
```
/gsd:new-project (command) [or /gsd:new-milestone]
  -> new-project.md (workflow, Phase 6: Research)
    -> 4x gsd-project-researcher agents (parallel, write directly)
      -> STACK.md
      -> FEATURES.md
      -> ARCHITECTURE.md
      -> PITFALLS.md
    -> 1x gsd-research-synthesizer agent (sequential)
      -> reads all 4 files
      -> writes SUMMARY.md
      -> commits all research files
```

---

## Cross-References

### Agent-to-Template Mapping

| Agent | Reads Templates | Writes Output |
|-------|----------------|---------------|
| `gsd-codebase-mapper` (tech) | `templates/codebase/stack.md`, `templates/codebase/integrations.md` | `.planning/codebase/STACK.md`, `.planning/codebase/INTEGRATIONS.md` |
| `gsd-codebase-mapper` (arch) | `templates/codebase/architecture.md`, `templates/codebase/structure.md` | `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` |
| `gsd-codebase-mapper` (quality) | `templates/codebase/conventions.md`, `templates/codebase/testing.md` | `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md` |
| `gsd-codebase-mapper` (concerns) | `templates/codebase/concerns.md` | `.planning/codebase/CONCERNS.md` |
| `gsd-project-researcher` | `templates/research-project/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` | `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` |
| `gsd-research-synthesizer` | `templates/research-project/SUMMARY.md` | `.planning/research/SUMMARY.md` |

Note: The `gsd-codebase-mapper` agent contains its own inline copies of the templates in its agent definition (at `/Users/miles-mac-mini/Desktop/custom-gsd-framework/agents/gsd-codebase-mapper.md`, lines 169-712, in a `<templates>` XML section). These inline versions are slightly simplified compared to the full templates in the templates directory. Similarly, the `gsd-project-researcher` agent contains inline output format templates (lines 168-491 in an `<output_formats>` XML section).

### Command-to-Template Flow

| Command | Triggers | Uses Templates (indirectly) |
|---------|----------|----------------------------|
| `/gsd:map-codebase` | Spawns 4 `gsd-codebase-mapper` agents | All 7 codebase templates |
| `/gsd:new-project` | Spawns 4 `gsd-project-researcher` + 1 `gsd-research-synthesizer` | All 5 research templates |
| `/gsd:new-milestone` | Same research pipeline as new-project | All 5 research templates |
| `/gsd:plan-phase` | Loads filled codebase documents based on phase type | Consumes filled codebase documents |
| `/gsd:execute-phase` | References filled codebase documents during code writing | Consumes filled codebase documents; may update STRUCTURE.md, STACK.md, CONVENTIONS.md, INTEGRATIONS.md |

### Phase-Type to Codebase Document Loading

The `gsd-codebase-mapper` agent definition documents which codebase files are loaded by `/gsd:plan-phase` based on phase type:

| Phase Type | Codebase Documents Loaded |
|------------|--------------------------|
| UI, frontend, components | CONVENTIONS.md, STRUCTURE.md |
| API, backend, endpoints | ARCHITECTURE.md, CONVENTIONS.md |
| Database, schema, models | ARCHITECTURE.md, STACK.md |
| Testing, tests | TESTING.md, CONVENTIONS.md |
| Integration, external API | INTEGRATIONS.md, STACK.md |
| Refactor, cleanup | CONCERNS.md, ARCHITECTURE.md |
| Setup, config | STACK.md, STRUCTURE.md |

### Workflow Files

| Workflow | Location | Template Relationship |
|----------|----------|----------------------|
| `map-codebase.md` | `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/workflows/map-codebase.md` | Orchestrates codebase template filling |
| `new-project.md` | `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/workflows/new-project.md` | Orchestrates research template filling (Phase 6) |
| `new-milestone.md` | `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/workflows/new-milestone.md` | Orchestrates research template filling |
| `execute-plan.md` | `/Users/miles-mac-mini/Desktop/custom-gsd-framework/get-shit-done/workflows/execute-plan.md` | Consumes and updates codebase documents |

### gsd-tools.js Integration

The `gsd-tools.js` CLI utility supports the template system through:
- `init map-codebase` command: provides initialization context (mapper_model, codebase_dir, existing_maps, has_maps, codebase_dir_exists) used by the map-codebase workflow
- `commit` command: handles git commits for both codebase and research documents after agents write them

### Key Design Principles Across Both Template Sets

1. **Agents write directly** -- Templates are filled by subagents that write documents to disk, not by returning content to orchestrators. This minimizes context window usage.

2. **File paths are mandatory** -- Both template sets demand concrete file paths in backtick formatting. Vague descriptions without paths are explicitly forbidden.

3. **Parallel execution** -- Both pipelines spawn 4 agents in parallel (one per focus area / research domain), with sequential synthesis only for the research pipeline's SUMMARY.md.

4. **Templates are duplicated in agents** -- Both the `gsd-codebase-mapper` and `gsd-project-researcher` agents contain inline simplified copies of their templates. The full templates in the `templates/` directory serve as the authoritative reference, while the inline versions provide agents with self-contained context.

5. **Forbidden content** -- The codebase mapper has an explicit `<forbidden_files>` section listing secret files that must never be read or quoted. Research templates handle this through confidence levels and source attribution.

6. **Living documents** -- Both sets include update instructions in their footers. Codebase documents may be updated by the execute-phase workflow. Research documents are typically written once per project/milestone initialization.
