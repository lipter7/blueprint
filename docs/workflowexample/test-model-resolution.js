#!/usr/bin/env node
// Test script to demonstrate model ID resolution for Cursor
// Based on findings from API testing (2026-02-11)

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

const tests = [
  {
    name: 'claude-4.6-opus-high-thinking',
    actual: registry['Claude Opus 4.6']['high-thinking'],
    expected: 'claude-4.6-opus-high-thinking'
  },
  {
    name: 'claude-4.5-sonnet-thinking',
    actual: registry['Claude Sonnet 4.5']['thinking'],
    expected: 'claude-4.5-sonnet-thinking'
  },
  {
    name: 'gpt-5.2-codex (base)',
    actual: registry['gpt-5.2-codex']['base'],
    expected: 'gpt-5.2-codex'
  },
  {
    name: 'gpt-5.2-codex-high',
    actual: registry['gpt-5.2-codex']['high'],
    expected: 'gpt-5.2-codex-high'
  }
];

let passed = 0;
let failed = 0;

tests.forEach(test => {
  const success = test.actual === test.expected;
  if (success) {
    console.log(`✓ ${test.name}: ${test.actual}`);
    passed++;
  } else {
    console.log(`✗ ${test.name}: Expected ${test.expected}, got ${test.actual}`);
    failed++;
  }
});

console.log(`\n${passed}/${tests.length} tests passed`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Model ID resolution working correctly.');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed.`);
  process.exit(1);
}
