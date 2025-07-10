#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Test pre-push hook content
const prePushPath = join(projectRoot, '.husky/pre-push');

if (!existsSync(prePushPath)) {
  console.error('❌ pre-push hook file not found');
  process.exit(1);
}

const prePushContent = readFileSync(prePushPath, 'utf-8');

// Test 1: Check if the hook runs lint
const hasLint = prePushContent.includes('npm run lint');
console.log(`✓ pre-push runs lint: ${hasLint}`);

// Test 2: Check if the hook runs typecheck
const hasTypecheck = prePushContent.includes('npm run typecheck');
console.log(`✓ pre-push runs typecheck: ${hasTypecheck}`);

// Test 3: Check if the hook runs tests
const hasTests = prePushContent.includes('npm run test:run');
console.log(`✓ pre-push runs tests: ${hasTests}`);

// Test 4: Check if the hook exits on failure
const hasExitOnFailure = prePushContent.includes('exit 1');
console.log(`✓ pre-push exits on failure: ${hasExitOnFailure}`);

// Summary
const allTestsPassed = hasLint && hasTypecheck && hasTests && hasExitOnFailure;
if (!allTestsPassed) {
  console.log('\n❌ pre-push hook is not properly configured');
  process.exit(1);
} else {
  console.log('\n✅ pre-push hook is properly configured');
}