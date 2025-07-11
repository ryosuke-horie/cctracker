#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { program } from 'commander';
import { Monitor } from './cli/monitor.js';
import { DataLoader } from './core/dataLoader.js';
import { PlanDetector } from './core/planDetector.js';
import { SessionIdentifier } from './core/sessionIdentifier.js';
import type { Locale } from './i18n/messages.js';
import { messages } from './i18n/messages.js';
import type { Plan } from './models/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const version = packageJson.version;

program
  .name('cctracker')
  .description('Claude Code Rate Limit Tracker - Real-time monitoring for Claude AI token usage')
  .version(version);

program
  .option('-p, --plan <type>', 'Subscription plan (pro, max5, max20, custom_max, auto)', 'auto')
  .option('-d, --data-path <path>', 'Custom path to Claude data directory')
  .option('--no-auto-detect', 'Disable automatic plan detection')
  .option('--ja', '日本語で表示')
  .action(async (options) => {
    const locale: Locale = options.ja ? 'ja' : 'en';
    const msg = messages[locale];
    
    // Handle plan detection
    let plan: Plan = 'pro';

    if (options.plan === 'auto' || (options.autoDetect && options.plan === 'pro')) {
      // Auto-detect plan from usage data
      console.log(`🔍 ${msg.autoDetectingPlan}`);

      try {
        const dataLoader = new DataLoader(options.dataPath);
        const sessionIdentifier = new SessionIdentifier();
        const planDetector = new PlanDetector();

        const entries = await dataLoader.loadUsageData();
        const blocks = sessionIdentifier.createSessionBlocks(entries);
        const analysis = planDetector.analyzePlanUsage(blocks);

        plan = analysis.detectedPlan;

        console.log(`✅ ${msg.detectedPlan}: ${plan} (${msg.confidence}: ${analysis.confidence})`);
        if (analysis.recommendation) {
          console.log(`💡 ${analysis.recommendation}`);
        }
        console.log(`📊 ${msg.maxTokensUsed}: ${analysis.maxTokensUsed.toLocaleString()}`);
      } catch (_error) {
        console.warn(`⚠️  ${msg.couldNotAutoDetect}`);
        plan = 'pro';
      }
    } else {
      // Validate manual plan option
      const validPlans: Plan[] = ['pro', 'max5', 'max20', 'custom_max'];
      if (!validPlans.includes(options.plan as Plan)) {
        console.error(`${msg.invalidPlan}: ${options.plan}`);
        console.error(`${msg.validPlans}: ${validPlans.join(', ')}`);
        process.exit(1);
      }
      plan = options.plan as Plan;
    }

    // Create monitor
    const monitor = new Monitor({
      plan,
      dataPath: options.dataPath,
      locale,
    });

    try {
      await monitor.runOnce();
    } catch (error) {
      console.error(`${msg.failedToFetchUsageData}:`, error);
      process.exit(1);
    }
  });

// Add info command
program
  .command('info')
  .description('Show information about Claude data paths and configuration')
  .option('-d, --data-path <path>', 'Custom path to Claude data directory')
  .action(async (options, command) => {
    // Get locale from parent command (global options)
    const parentOpts = command.parent?.opts() || {};
    const locale: Locale = parentOpts.ja ? 'ja' : 'en';
    const msg = messages[locale];
    const { getDefaultDataPaths, discoverClaudeDataPaths } = await import(
      './utils/pathDiscovery.js'
    );

    console.log(`\n📍 ${msg.dataPathsInfo}:\n`);

    const defaultPaths = getDefaultDataPaths();
    console.log(`${msg.defaultPaths}:`);
    defaultPaths.forEach((path) => console.log(`  - ${path}`));

    const discoveredPaths = await discoverClaudeDataPaths();
    console.log(`\n${msg.discoveredPaths}:`);

    if (discoveredPaths.length === 0) {
      console.log(`  ${msg.noClaudeDataFound}`);
    } else {
      discoveredPaths.forEach((path) => console.log(`  ✅ ${path}`));
    }

    // Try to analyze plan usage
    try {
      const dataLoader = new DataLoader(options.dataPath);
      const sessionIdentifier = new SessionIdentifier();
      const planDetector = new PlanDetector();

      const entries = await dataLoader.loadUsageData();
      if (entries.length > 0) {
        const blocks = sessionIdentifier.createSessionBlocks(entries);
        const analysis = planDetector.analyzePlanUsage(blocks);

        console.log(`\n📊 ${msg.usageAnalysis}:\n`);
        console.log(`${msg.detectedPlan}: ${analysis.detectedPlan}`);
        console.log(`${msg.maxTokensUsed}: ${analysis.maxTokensUsed.toLocaleString()} (weighted)`);
        console.log(`${msg.confidence}: ${analysis.confidence}`);
        if (analysis.recommendation) {
          console.log(`Note: ${analysis.recommendation}`);
        }

        // Estimate actual tokens
        const actualTokens = planDetector.estimateActualTokens(analysis.maxTokensUsed, blocks);
        console.log(`${msg.estimatedActualTokens}: ~${actualTokens.toLocaleString()}`);
      }
    } catch (_error) {
      // Silent fail - info command should work even without data
    }

    console.log(`\n💡 ${msg.tips}:`);
    console.log(`  - ${msg.tipEnvVar}`);
    console.log(`  - ${msg.tipDataPath}`);
    console.log(`  - ${msg.tipAutoDetect}`);
    console.log(`  - ${msg.tipEnsureRunning}`);
  });

// Add watch command for continuous monitoring
program
  .command('watch')
  .description('Continuously monitor Claude usage with live updates')
  .option('-p, --plan <type>', 'Subscription plan (pro, max5, max20, custom_max, auto)', 'auto')
  .option('-d, --data-path <path>', 'Custom path to Claude data directory')
  .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '3')
  .option('--no-auto-detect', 'Disable automatic plan detection')
  .action(async (options, command) => {
    // Get locale from parent command (global options)
    const parentOpts = command.parent?.opts() || {};
    const locale: Locale = parentOpts.ja ? 'ja' : 'en';
    const msg = messages[locale];
    // Handle plan detection (same as default command)
    let plan: Plan = 'pro';

    if (options.plan === 'auto' || (options.autoDetect && options.plan === 'pro')) {
      console.log(`🔍 ${msg.autoDetectingPlan}`);

      try {
        const dataLoader = new DataLoader(options.dataPath);
        const sessionIdentifier = new SessionIdentifier();
        const planDetector = new PlanDetector();

        const entries = await dataLoader.loadUsageData();
        const blocks = sessionIdentifier.createSessionBlocks(entries);
        const analysis = planDetector.analyzePlanUsage(blocks);

        plan = analysis.detectedPlan;

        console.log(`✅ ${msg.detectedPlan}: ${plan} (${msg.confidence}: ${analysis.confidence})`);
        if (analysis.recommendation) {
          console.log(`💡 ${analysis.recommendation}`);
        }
        console.log(`📊 ${msg.maxTokensUsed}: ${analysis.maxTokensUsed.toLocaleString()}`);
      } catch (_error) {
        console.warn(`⚠️  ${msg.couldNotAutoDetect}`);
        plan = 'pro';
      }
    } else {
      const validPlans: Plan[] = ['pro', 'max5', 'max20', 'custom_max'];
      if (!validPlans.includes(options.plan as Plan)) {
        console.error(`${msg.invalidPlan}: ${options.plan}`);
        console.error(`${msg.validPlans}: ${validPlans.join(', ')}`);
        process.exit(1);
      }
      plan = options.plan as Plan;
    }

    // Parse refresh interval
    const refreshInterval = parseInt(options.refresh) * 1000;
    if (Number.isNaN(refreshInterval) || refreshInterval < 1000) {
      console.error('Refresh interval must be at least 1 second');
      process.exit(1);
    }

    // Create and start monitor
    const monitor = new Monitor({
      plan,
      dataPath: options.dataPath,
      refreshInterval,
      locale,
    });

    console.log(`\n🚀 ${msg.startingMonitor}`);
    console.log(`📋 ${msg.plan}: ${plan}`);
    console.log(`🔄 ${msg.refreshInterval}: ${options.refresh}s`);

    if (options.dataPath) {
      console.log(`📁 ${msg.dataPath}: ${options.dataPath}`);
    }

    try {
      await monitor.start();
    } catch (error) {
      console.error(`${msg.failedToStartMonitor}:`, error);
      process.exit(1);
    }
  });

// Parse and check for unknown commands
program.parse();

// Check if any arguments were not handled by commander
const remainingArgs = program.args;
if (remainingArgs.length > 0 && !['info', 'watch'].includes(remainingArgs[0])) {
  const locale: Locale = process.argv.includes('--ja') ? 'ja' : 'en';
  const msg = messages[locale];
  console.error(`${msg.unknownCommand}: ${remainingArgs[0]}`);
  console.error(msg.seeHelp);
  process.exit(1);
}
