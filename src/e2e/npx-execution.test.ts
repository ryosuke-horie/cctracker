import { exec } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

describe('npx cctracker E2E tests', () => {
  let testDir: string;

  beforeAll(async () => {
    // Create temporary directory for testing
    testDir = await mkdtemp(join(tmpdir(), 'cctracker-e2e-'));

    // Build the project
    await execAsync('npm run build');
  });

  afterAll(async () => {
    // Clean up
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('CLI interface validation', () => {
    it('should display help when --help flag is used', async () => {
      const { stdout } = await execAsync('node dist/cli.js --help');

      expect(stdout).toContain('cctracker');
      expect(stdout).toContain('Usage:');
      expect(stdout).toContain('Options:');
      expect(stdout).toContain('--help');
    });

    it('should display version when --version flag is used', async () => {
      const { stdout } = await execAsync('node dist/cli.js --version');

      expect(stdout).toContain('0.1.0');
    });

    it('should handle unknown commands gracefully', async () => {
      try {
        await execAsync('node dist/cli.js unknown-command');
        expect.fail('Should have thrown an error');
      } catch (error: unknown) {
        const execError = error as { stderr?: string; stdout?: string; message?: string };
        const errorOutput = execError.stderr || execError.stdout || execError.message || '';
        expect(errorOutput).toContain('unknown command');
      }
    });
  });

  describe('local npm link simulation', () => {
    it('should work when installed via npm link', async () => {
      // Test npm link workflow
      await execAsync('npm link');

      try {
        // Test execution via npx
        const { stdout } = await execAsync('npx cctracker --help');
        expect(stdout).toContain('cctracker');
        expect(stdout).toContain('--help');
      } finally {
        // Clean up
        await execAsync('npm unlink cctracker').catch(() => {
          // Ignore errors during cleanup
        });
      }
    });
  });

  describe('publication readiness checks', () => {
    it('should validate that all required files are included in package', async () => {
      // Test npm pack to simulate publication
      const { stdout } = await execAsync('npm pack --dry-run');

      // Check that package tarball is created
      expect(stdout).toContain('cctracker-0.1.0.tgz');

      // If the output contains detailed file list, check the files
      if (stdout.includes('Tarball Contents')) {
        expect(stdout).toMatch(/\d+(\.\d+)?\s*(kB|B)\s+package\.json/);
        expect(stdout).toMatch(/\d+(\.\d+)?\s*(kB|B)\s+dist\/cli\.js/);
        expect(stdout).toMatch(/\d+(\.\d+)?\s*(kB|B)\s+README\.md/);

        // Check that unnecessary files are excluded
        expect(stdout).not.toContain('src/');
        expect(stdout).not.toContain('node_modules/');
        expect(stdout).not.toContain('.git/');
      }
    });

    it('should validate package metadata is npm-ready', async () => {
      const { stdout } = await execAsync('npm pack --dry-run');

      // Extract package info
      const lines = stdout.split('\n');
      const packageLine = lines.find((line) => line.includes('cctracker'));

      expect(packageLine).toBeTruthy();
      expect(packageLine).toContain('0.1.0');
    });
  });

  describe('deployment workflow validation', () => {
    it('should validate pre-publish script execution', async () => {
      // Simulate prepublishOnly script
      await expect(execAsync('npm run prepublishOnly')).resolves.not.toThrow();

      // Verify dist directory was created
      const { stdout } = await execAsync('ls -la dist/');
      expect(stdout).toContain('cli.js');
    });

    it('should validate build artifacts are correct', async () => {
      await execAsync('npm run build');

      // Check CLI file structure
      const { stdout } = await execAsync('head -n 1 dist/cli.js');
      expect(stdout).toContain('#!/usr/bin/env node');
    });
  });
});
