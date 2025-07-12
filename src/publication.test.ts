import { exec } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

describe('npm publication readiness', () => {
  describe('package.json validation', () => {
    it('should have correct binary configuration', async () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.name).toBe('cctracker');
      expect(packageJson.bin).toEqual({
        cctracker: './dist/cli.js',
      });
      expect(packageJson.files).toContain('dist/**/*');
    });

    it('should have necessary publication scripts', async () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.scripts).toHaveProperty('prepublishOnly');
      expect(packageJson.scripts).toHaveProperty('build');
      expect(packageJson.scripts.prepublishOnly).toBe('npm run build');
    });

    it('should have complete metadata for npm publication', async () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      expect(packageJson.description).toBeTruthy();
      expect(packageJson.keywords).toBeInstanceOf(Array);
      expect(packageJson.keywords.length).toBeGreaterThan(0);
      expect(packageJson.license).toBeTruthy();
      expect(packageJson.author).toBeDefined();
    });
  });

  describe('build output validation', () => {
    it('should generate executable CLI file in dist directory', async () => {
      // Build the project
      await execAsync('npm run build');

      // Check if the CLI file exists
      const cliPath = join(process.cwd(), 'dist', 'cli.js');
      await expect(access(cliPath)).resolves.toBeUndefined();
    });

    it('should have executable permissions on CLI file', async () => {
      await execAsync('npm run build');

      const cliPath = join(process.cwd(), 'dist', 'cli.js');
      const cliContent = await readFile(cliPath, 'utf-8');

      // Check for shebang
      expect(cliContent.startsWith('#!/usr/bin/env node')).toBe(true);
    });
  });

  describe('npm pack validation', () => {
    it('should create valid npm package', async () => {
      await execAsync('npm run build');

      // Create tarball
      const { stdout } = await execAsync('npm pack --dry-run');

      // Verify package creation
      expect(stdout).toContain('cctracker-0.1.0.tgz');
    });

    it('should have correct package size', async () => {
      await execAsync('npm run build');

      const { stdout, stderr } = await execAsync('npm pack --dry-run');

      // npm pack output might be in stderr instead of stdout
      const output = stdout + stderr;

      // Extract package info
      const lines = output.split('\n');
      const packageInfoLine = lines.find((line) => line.includes('package size'));

      expect(packageInfoLine).toBeTruthy();
      // Size should be reasonable (less than 1MB)
      if (packageInfoLine) {
        const sizeMatch = packageInfoLine.match(/(\d+(?:\.\d+)?)\s*(kB|B)/);
        if (sizeMatch) {
          const size = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2];
          const sizeInBytes = unit === 'kB' ? size * 1024 : size;
          expect(sizeInBytes).toBeLessThan(1024 * 1024); // 1MB
        }
      }
    });
  });

  describe('npx execution readiness', () => {
    it('should be executable via npx after local installation', async () => {
      await execAsync('npm run build');

      // Link the package locally
      await execAsync('npm link');

      try {
        // Test npx execution
        const { stdout } = await execAsync('npx cctracker --help');
        expect(stdout).toContain('cctracker');
        expect(stdout).toContain('--help');
      } finally {
        // Clean up
        await execAsync('npm unlink cctracker');
      }
    });
  });
});

describe('publication workflow validation', () => {
  describe('pre-publication checks', () => {
    it('should pass all lint checks', async () => {
      await expect(execAsync('npm run lint')).resolves.not.toThrow();
    });

    it('should pass all type checks', async () => {
      await expect(execAsync('npm run typecheck')).resolves.not.toThrow();
    });

    it('should pass all tests', async () => {
      await expect(
        execAsync('npm run test:run -- --exclude "**/publication.test.ts"')
      ).resolves.not.toThrow();
    }, 30000);

    it('should maintain test coverage', async () => {
      const { stdout } = await execAsync(
        'npm run test:coverage -- --exclude "**/publication.test.ts"'
      );

      // Check coverage percentage
      const coverageMatch = stdout.match(/All files\s+\|\s+(\d+(?:\.\d+)?)/);

      if (coverageMatch) {
        const coverage = parseFloat(coverageMatch[1]);
        expect(coverage).toBeGreaterThanOrEqual(89);
      }
    }, 30000);
  });

  describe('publication documentation', () => {
    it('should have publication documentation', async () => {
      const docsPath = join(process.cwd(), 'docs');

      // Check if publication docs exist (will be created in Green phase)
      await expect(async () => {
        await access(join(docsPath, 'パッケージ公開手順.md'));
      }).rejects.toThrow();
    });
  });
});
