#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Test 1: Check if .husky directory exists
const huskyDir = join(projectRoot, '.husky');
const huskyDirExists = existsSync(huskyDir);
console.log(`✓ .husky directory exists: ${huskyDirExists}`);

// Test 2: Check if pre-push hook exists
const prePushHook = join(huskyDir, 'pre-push');
const prePushExists = existsSync(prePushHook);
console.log(`✓ pre-push hook exists: ${prePushExists}`);

// Test 3: Check if husky is in package.json devDependencies
const packageJsonPath = join(projectRoot, 'package.json');
if (existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(await import('node:fs').then(fs => fs.promises.readFile(packageJsonPath, 'utf-8')));
  const hasHusky = packageJson.devDependencies?.husky !== undefined;
  console.log(`✓ husky in devDependencies: ${hasHusky}`);
} else {
  console.log('✗ package.json not found');
}

// Summary
const allTestsPassed = huskyDirExists && prePushExists;
if (!allTestsPassed) {
  console.log('\n❌ Husky setup is incomplete');
  process.exit(1);
} else {
  console.log('\n✅ Husky setup is complete');
}