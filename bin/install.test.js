/**
 * Cursor Installation Tests
 *
 * Integration tests for install.js Cursor runtime support.
 * Tests the full install/uninstall flow via child_process.execSync,
 * verifying output directory structure and file conversions.
 *
 * Uses node:test and node:assert (same patterns as blueprint-tools.test.js).
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const installScript = path.join(__dirname, 'install.js');

// ---------------------------------------------------------------------------
// Cursor Install Tests
// ---------------------------------------------------------------------------

describe('Cursor Installation Tests', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-cursor-test-'));
  const cursorDir = path.join(tmpDir, '.cursor');

  before(() => {
    // Run cursor install to temp directory
    execSync(`node "${installScript}" --cursor --local`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -----------------------------------------------------------------------
  // Skills Installation
  // -----------------------------------------------------------------------

  describe('Skills Installation', () => {
    test('creates skills/ directory', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      assert.ok(fs.existsSync(skillsDir), 'skills/ directory should exist');
    });

    test('creates at least 28 numbered skill directories', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      assert.ok(
        dirs.length >= 28,
        `Should have at least 28 skills, got ${dirs.length}`,
      );
    });

    test('creates correct numbered directory naming format', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const expected = [
        'bp-01-map-codebase',
        'bp-02-new-project',
        'bp-03-new-milestone',
        'bp-04-discuss-phase',
        'bp-05-research-phase',
        'bp-06-plan-phase',
        'bp-07-execute-phase',
        'bp-08-verify-work',
        'bp-09-audit-milestone',
        'bp-10-plan-milestone-gaps',
        'bp-11-complete-milestone',
        'bp-12-add-phase',
        'bp-13-insert-phase',
        'bp-14-remove-phase',
        'bp-15-progress',
        'bp-16-resume-work',
        'bp-17-pause-work',
        'bp-18-quick',
        'bp-19-debug',
        'bp-20-list-phase-assumptions',
        'bp-21-add-todo',
        'bp-22-check-todos',
        'bp-23-settings',
        'bp-24-set-profile',
        'bp-25-update',
        'bp-26-reapply-patches',
        'bp-27-help',
        'bp-28-join-discord',
      ];
      for (const dir of expected) {
        assert.ok(
          fs.existsSync(path.join(skillsDir, dir)),
          `Expected skill directory ${dir} to exist`,
        );
      }
    });

    test('each skill directory contains SKILL.md', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const skillFile = path.join(skillsDir, dir, 'SKILL.md');
        assert.ok(
          fs.existsSync(skillFile),
          `${dir}/SKILL.md should exist`,
        );
      }
    });

    test('SKILL.md has disable-model-invocation: true in frontmatter', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        assert.ok(
          content.includes('disable-model-invocation: true'),
          `${dir}/SKILL.md should have disable-model-invocation: true`,
        );
      }
    });

    test('SKILL.md does not contain allowed-tools', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        assert.ok(
          !content.includes('allowed-tools:'),
          `${dir}/SKILL.md should not contain allowed-tools`,
        );
      }
    });

    test('SKILL.md does not contain argument-hint', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        assert.ok(
          !content.includes('argument-hint:'),
          `${dir}/SKILL.md should not contain argument-hint`,
        );
      }
    });

    test('SKILL.md does not contain agent: field', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        // Only check within frontmatter
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx);
          assert.ok(
            !fm.includes('agent:'),
            `${dir}/SKILL.md frontmatter should not contain agent: field`,
          );
        }
      }
    });

    test('SKILL.md does not contain tools: field', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        // Only check within frontmatter
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx);
          assert.ok(
            !fm.includes('tools:'),
            `${dir}/SKILL.md frontmatter should not contain tools: field`,
          );
        }
      }
    });

    test('SKILL.md retains name and description fields', () => {
      const skillFile = path.join(
        cursorDir,
        'skills',
        'bp-01-map-codebase',
        'SKILL.md',
      );
      const content = fs.readFileSync(skillFile, 'utf8');
      assert.ok(content.includes('name:'), 'SKILL.md should have a name field');
      assert.ok(
        content.includes('description:'),
        'SKILL.md should have a description field',
      );
    });

    test('SKILL.md replaces ~/.claude/ path references with local prefix', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        assert.ok(
          !content.includes('~/.claude/'),
          `${dir}/SKILL.md should not contain ~/.claude/ references`,
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // Agent Installation
  // -----------------------------------------------------------------------

  describe('Agent Installation', () => {
    test('creates agents/ directory', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      assert.ok(fs.existsSync(agentsDir), 'agents/ directory should exist');
    });

    test('installs at least 11 agent files', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      assert.ok(
        agents.length >= 11,
        `Should have at least 11 agents, got ${agents.length}`,
      );
    });

    test('installs expected agent files', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const expected = [
        'bp-codebase-mapper.md',
        'bp-debugger.md',
        'bp-executor.md',
        'bp-integration-checker.md',
        'bp-phase-researcher.md',
        'bp-plan-checker.md',
        'bp-planner.md',
        'bp-project-researcher.md',
        'bp-research-synthesizer.md',
        'bp-roadmapper.md',
        'bp-verifier.md',
      ];
      for (const agent of expected) {
        assert.ok(
          fs.existsSync(path.join(agentsDir, agent)),
          `${agent} should be installed`,
        );
      }
    });

    test('agents have model: inherit in frontmatter', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx + 3);
          assert.ok(
            fm.includes('model: inherit'),
            `${agent} frontmatter should contain model: inherit`,
          );
        }
      }
    });

    test('agents do not contain color field in frontmatter', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx);
          assert.ok(
            !fm.includes('color:'),
            `${agent} frontmatter should not contain color: field`,
          );
        }
      }
    });

    test('agents do not contain tools field in frontmatter', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx);
          assert.ok(
            !fm.includes('tools:'),
            `${agent} frontmatter should not contain tools: field`,
          );
        }
      }
    });

    test('agents do not contain allowed-tools field in frontmatter', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        const endIdx = content.indexOf('---', 3);
        if (endIdx > 0) {
          const fm = content.substring(0, endIdx);
          assert.ok(
            !fm.includes('allowed-tools:'),
            `${agent} frontmatter should not contain allowed-tools: field`,
          );
        }
      }
    });

    test('agents replace ~/.claude/ path references with local prefix', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        assert.ok(
          !content.includes('~/.claude/'),
          `${agent} should not contain ~/.claude/ references`,
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // Blueprint Directory
  // -----------------------------------------------------------------------

  describe('Blueprint Directory', () => {
    test('installs blueprint/ directory', () => {
      assert.ok(
        fs.existsSync(path.join(cursorDir, 'blueprint')),
        'blueprint/ directory should exist',
      );
    });

    test('installs VERSION file', () => {
      const versionFile = path.join(cursorDir, 'blueprint', 'VERSION');
      assert.ok(fs.existsSync(versionFile), 'blueprint/VERSION should exist');
      const version = fs.readFileSync(versionFile, 'utf8').trim();
      assert.ok(version.length > 0, 'VERSION should not be empty');
      // Verify it looks like a semver string
      assert.ok(
        /^\d+\.\d+\.\d+/.test(version),
        `VERSION should be semver format, got "${version}"`,
      );
    });

    test('installs CHANGELOG.md', () => {
      assert.ok(
        fs.existsSync(path.join(cursorDir, 'blueprint', 'CHANGELOG.md')),
        'blueprint/CHANGELOG.md should exist',
      );
    });

    test('installs workflows/ directory', () => {
      const workflowsDir = path.join(cursorDir, 'blueprint', 'workflows');
      assert.ok(
        fs.existsSync(workflowsDir),
        'blueprint/workflows/ should exist',
      );
      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      assert.ok(
        files.length > 0,
        'workflows/ should contain .md files',
      );
    });

    test('installs templates/ directory', () => {
      const templatesDir = path.join(cursorDir, 'blueprint', 'templates');
      assert.ok(
        fs.existsSync(templatesDir),
        'blueprint/templates/ should exist',
      );
    });

    test('installs references/ directory', () => {
      const refsDir = path.join(cursorDir, 'blueprint', 'references');
      assert.ok(
        fs.existsSync(refsDir),
        'blueprint/references/ should exist',
      );
    });

    test('installs file manifest', () => {
      assert.ok(
        fs.existsSync(path.join(cursorDir, 'bp-file-manifest.json')),
        'bp-file-manifest.json should exist',
      );
    });
  });

  // -----------------------------------------------------------------------
  // No Hooks for Cursor
  // -----------------------------------------------------------------------

  describe('No Hooks for Cursor', () => {
    test('does not install Blueprint hook files', () => {
      const hooksDir = path.join(cursorDir, 'hooks');
      if (fs.existsSync(hooksDir)) {
        const bpHooks = fs
          .readdirSync(hooksDir)
          .filter(f => f.startsWith('bp-'));
        assert.strictEqual(
          bpHooks.length,
          0,
          'No Blueprint hooks should be installed for Cursor',
        );
      }
      // If hooks/ dir does not exist, that is also correct
    });
  });

  // -----------------------------------------------------------------------
  // Interaction Conversions (AskUserQuestion -> AskQuestion)
  // -----------------------------------------------------------------------

  describe('Interaction Conversions', () => {
    test('no AskUserQuestion references in skill files', () => {
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        assert.ok(
          !content.includes('AskUserQuestion'),
          `${dir}/SKILL.md should not contain AskUserQuestion`,
        );
      }
    });

    test('no AskUserQuestion references in agent files', () => {
      const agentsDir = path.join(cursorDir, 'agents');
      const agents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
      for (const agent of agents) {
        const content = fs.readFileSync(
          path.join(agentsDir, agent),
          'utf8',
        );
        assert.ok(
          !content.includes('AskUserQuestion'),
          `${agent} should not contain AskUserQuestion`,
        );
      }
    });

    test('no AskUserQuestion references in workflow files', () => {
      const workflowsDir = path.join(cursorDir, 'blueprint', 'workflows');
      if (!fs.existsSync(workflowsDir)) return;
      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        const content = fs.readFileSync(
          path.join(workflowsDir, file),
          'utf8',
        );
        assert.ok(
          !content.includes('AskUserQuestion'),
          `workflows/${file} should not contain AskUserQuestion`,
        );
      }
    });

    test('cursor_interaction blocks exist in converted files', () => {
      // Files known to have interaction conversions:
      // - workflows/discuss-phase.md, workflows/settings.md, workflows/quick.md, etc.
      // - commands/bp/debug.md -> skills/bp-19-debug/SKILL.md
      // Check that at least some cursor_interaction blocks were injected
      let foundInteraction = false;

      // Check skills
      const skillsDir = path.join(cursorDir, 'skills');
      const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
      for (const dir of dirs) {
        const content = fs.readFileSync(
          path.join(skillsDir, dir, 'SKILL.md'),
          'utf8',
        );
        if (content.includes('cursor_interaction')) {
          foundInteraction = true;
          break;
        }
      }

      if (!foundInteraction) {
        // Check workflows
        const workflowsDir = path.join(cursorDir, 'blueprint', 'workflows');
        if (fs.existsSync(workflowsDir)) {
          const files = fs
            .readdirSync(workflowsDir)
            .filter(f => f.endsWith('.md'));
          for (const file of files) {
            const content = fs.readFileSync(
              path.join(workflowsDir, file),
              'utf8',
            );
            if (content.includes('cursor_interaction')) {
              foundInteraction = true;
              break;
            }
          }
        }
      }

      assert.ok(
        foundInteraction,
        'At least one file should contain cursor_interaction blocks',
      );
    });

    test('debug skill has cursor_interaction symptom gathering block', () => {
      const debugSkill = path.join(
        cursorDir,
        'skills',
        'bp-19-debug',
        'SKILL.md',
      );
      if (fs.existsSync(debugSkill)) {
        const content = fs.readFileSync(debugSkill, 'utf8');
        assert.ok(
          content.includes('cursor_interaction'),
          'debug skill should have cursor_interaction block',
        );
        assert.ok(
          content.includes('type="symptom_gathering"') ||
            content.includes('debug-symptoms'),
          'debug skill should have symptom_gathering interaction or debug-symptoms id',
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // Command Reference Conversions (/bp:name -> /bp-NN-name)
  // -----------------------------------------------------------------------

  describe('Command Reference Conversions', () => {
    test('workflow files contain /bp-NN- style command references', () => {
      const workflowsDir = path.join(cursorDir, 'blueprint', 'workflows');
      if (!fs.existsSync(workflowsDir)) return;

      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      let foundConversion = false;
      for (const file of files) {
        const content = fs.readFileSync(
          path.join(workflowsDir, file),
          'utf8',
        );
        if (/\/bp-\d{2}-[a-z]/.test(content)) {
          foundConversion = true;
          break;
        }
      }
      assert.ok(
        foundConversion,
        'At least one workflow should have /bp-NN-name style command references',
      );
    });

    test('reference files contain /bp-NN- style command references', () => {
      const refsDir = path.join(cursorDir, 'blueprint', 'references');
      if (!fs.existsSync(refsDir)) return;

      const files = fs.readdirSync(refsDir).filter(f => f.endsWith('.md'));
      let foundConversion = false;
      for (const file of files) {
        const content = fs.readFileSync(
          path.join(refsDir, file),
          'utf8',
        );
        if (/\/bp-\d{2}-[a-z]/.test(content)) {
          foundConversion = true;
          break;
        }
      }
      assert.ok(
        foundConversion,
        'At least one reference file should have /bp-NN-name style command references',
      );
    });

    test('specific known conversions are correct', () => {
      // Check that /bp:help -> /bp-27-help and /bp:map-codebase -> /bp-01-map-codebase
      // in at least one workflow or reference file
      function findInDir(dir) {
        if (!fs.existsSync(dir)) return { foundHelp: false, foundMap: false };
        let foundHelp = false;
        let foundMap = false;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const content = fs.readFileSync(path.join(dir, file), 'utf8');
          if (content.includes('/bp-27-help')) foundHelp = true;
          if (content.includes('/bp-01-map-codebase')) foundMap = true;
        }
        return { foundHelp, foundMap };
      }

      const workflows = findInDir(
        path.join(cursorDir, 'blueprint', 'workflows'),
      );
      const refs = findInDir(
        path.join(cursorDir, 'blueprint', 'references'),
      );
      const skills = (() => {
        const skillsDir = path.join(cursorDir, 'skills');
        let foundHelp = false;
        let foundMap = false;
        if (!fs.existsSync(skillsDir)) return { foundHelp, foundMap };
        for (const dir of fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'))) {
          const content = fs.readFileSync(
            path.join(skillsDir, dir, 'SKILL.md'),
            'utf8',
          );
          if (content.includes('/bp-27-help')) foundHelp = true;
          if (content.includes('/bp-01-map-codebase')) foundMap = true;
        }
        return { foundHelp, foundMap };
      })();

      const anyHelp =
        workflows.foundHelp || refs.foundHelp || skills.foundHelp;
      const anyMap = workflows.foundMap || refs.foundMap || skills.foundMap;

      assert.ok(
        anyHelp,
        '/bp-27-help should appear somewhere in installed files',
      );
      assert.ok(
        anyMap,
        '/bp-01-map-codebase should appear somewhere in installed files',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Path Replacement
  // -----------------------------------------------------------------------

  describe('Path Replacement', () => {
    test('no ~/.claude/ references in blueprint/ markdown files (excluding CHANGELOG)', () => {
      // CHANGELOG.md is copied as-is (historical documentation), so it may
      // legitimately contain ~/.claude/ references. All other .md files
      // should have paths rewritten to .cursor/.
      function checkDir(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            checkDir(fullPath);
          } else if (entry.name.endsWith('.md') && entry.name !== 'CHANGELOG.md') {
            const content = fs.readFileSync(fullPath, 'utf8');
            assert.ok(
              !content.includes('~/.claude/'),
              `${fullPath.replace(tmpDir, '')} should not contain ~/.claude/`,
            );
          }
        }
      }
      checkDir(path.join(cursorDir, 'blueprint'));
    });

    test('blueprint files reference .cursor/ path prefix', () => {
      // Spot-check a workflow file for .cursor/ path references
      const workflowsDir = path.join(cursorDir, 'blueprint', 'workflows');
      if (!fs.existsSync(workflowsDir)) return;

      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.md'));
      let foundCursorRef = false;
      for (const file of files) {
        const content = fs.readFileSync(
          path.join(workflowsDir, file),
          'utf8',
        );
        if (content.includes('./.cursor/')) {
          foundCursorRef = true;
          break;
        }
      }
      assert.ok(
        foundCursorRef,
        'At least one workflow should reference ./.cursor/ path prefix',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Cursor Uninstall Tests
// ---------------------------------------------------------------------------

describe('Cursor Uninstall Tests', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-cursor-uninst-'));
  const cursorDir = path.join(tmpDir, '.cursor');

  before(() => {
    // Install then uninstall
    execSync(`node "${installScript}" --cursor --local`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
    execSync(`node "${installScript}" --cursor --local --uninstall`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('removes all bp- skill directories', () => {
    const skillsDir = path.join(cursorDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const bpDirs = fs
        .readdirSync(skillsDir)
        .filter(d => d.startsWith('bp-'));
      assert.strictEqual(
        bpDirs.length,
        0,
        'All bp- skill directories should be removed after uninstall',
      );
    }
  });

  test('removes all bp- agent files', () => {
    const agentsDir = path.join(cursorDir, 'agents');
    if (fs.existsSync(agentsDir)) {
      const bpAgents = fs
        .readdirSync(agentsDir)
        .filter(f => f.startsWith('bp-'));
      assert.strictEqual(
        bpAgents.length,
        0,
        'All bp- agent files should be removed after uninstall',
      );
    }
  });

  test('removes blueprint/ directory', () => {
    assert.ok(
      !fs.existsSync(path.join(cursorDir, 'blueprint')),
      'blueprint/ directory should be removed after uninstall',
    );
  });

  test('preserves .cursor/ directory itself', () => {
    assert.ok(
      fs.existsSync(cursorDir),
      '.cursor/ directory should still exist after uninstall (may have other files)',
    );
  });
});

// ---------------------------------------------------------------------------
// Reinstall Tests (install over existing install)
// ---------------------------------------------------------------------------

describe('Cursor Reinstall Tests', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-cursor-reinst-'));
  const cursorDir = path.join(tmpDir, '.cursor');

  before(() => {
    // Install twice — second install should cleanly overwrite
    execSync(`node "${installScript}" --cursor --local`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
    execSync(`node "${installScript}" --cursor --local`, {
      cwd: tmpDir,
      stdio: 'pipe',
    });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('skills are intact after reinstall', () => {
    const skillsDir = path.join(cursorDir, 'skills');
    const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
    assert.ok(
      dirs.length >= 28,
      `Should have at least 28 skills after reinstall, got ${dirs.length}`,
    );
  });

  test('agents are intact after reinstall', () => {
    const agentsDir = path.join(cursorDir, 'agents');
    const agents = fs
      .readdirSync(agentsDir)
      .filter(f => f.startsWith('bp-') && f.endsWith('.md'));
    assert.ok(
      agents.length >= 11,
      `Should have at least 11 agents after reinstall, got ${agents.length}`,
    );
  });

  test('no duplicate skill directories after reinstall', () => {
    const skillsDir = path.join(cursorDir, 'skills');
    const dirs = fs.readdirSync(skillsDir).filter(d => d.startsWith('bp-'));
    // Each skill should appear exactly once
    const seen = new Set();
    for (const dir of dirs) {
      assert.ok(!seen.has(dir), `Duplicate skill directory: ${dir}`);
      seen.add(dir);
    }
  });

  test('blueprint/ directory is clean after reinstall', () => {
    assert.ok(
      fs.existsSync(path.join(cursorDir, 'blueprint')),
      'blueprint/ should exist after reinstall',
    );
    assert.ok(
      fs.existsSync(path.join(cursorDir, 'blueprint', 'VERSION')),
      'blueprint/VERSION should exist after reinstall',
    );
  });
});
