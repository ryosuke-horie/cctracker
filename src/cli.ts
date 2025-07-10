#!/usr/bin/env node

import { program } from 'commander';
import { Monitor } from './cli/monitor.js';
import { Plan } from './models/types.js';
import { DataLoader } from './core/dataLoader.js';
import { SessionIdentifier } from './core/sessionIdentifier.js';
import { PlanDetector } from './core/planDetector.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  .option('-r, --refresh <seconds>', 'Refresh interval in seconds', '3')
  .option('--no-auto-detect', 'Disable automatic plan detection')
  .action(async (options) => {
    // Handle plan detection
    let plan: Plan = 'pro';
    
    if (options.plan === 'auto' || (options.autoDetect && options.plan === 'pro')) {
      // Auto-detect plan from usage data
      console.log('🔍 Auto-detecting plan from usage history...');
      
      try {
        const dataLoader = new DataLoader(options.dataPath);
        const sessionIdentifier = new SessionIdentifier();
        const planDetector = new PlanDetector();
        
        const entries = await dataLoader.loadUsageData();
        const blocks = sessionIdentifier.createSessionBlocks(entries);
        const analysis = planDetector.analyzePlanUsage(blocks);
        
        plan = analysis.detectedPlan;
        
        console.log(`✅ Detected plan: ${plan} (confidence: ${analysis.confidence})`);
        if (analysis.recommendation) {
          console.log(`💡 ${analysis.recommendation}`);
        }
        console.log(`📊 Max tokens used: ${analysis.maxTokensUsed.toLocaleString()}`);
        
      } catch (error) {
        console.warn('⚠️  Could not auto-detect plan, using default (pro)');
        plan = 'pro';
      }
    } else {
      // Validate manual plan option
      const validPlans: Plan[] = ['pro', 'max5', 'max20', 'custom_max'];
      if (!validPlans.includes(options.plan as Plan)) {
        console.error(`Invalid plan: ${options.plan}`);
        console.error(`Valid plans are: ${validPlans.join(', ')}`);
        process.exit(1);
      }
      plan = options.plan as Plan;
    }

    // Parse refresh interval
    const refreshInterval = parseInt(options.refresh) * 1000;
    if (isNaN(refreshInterval) || refreshInterval < 1000) {
      console.error('Refresh interval must be at least 1 second');
      process.exit(1);
    }

    // Create and start monitor
    const monitor = new Monitor({
      plan,
      dataPath: options.dataPath,
      refreshInterval
    });

    console.log('\n🚀 Starting Claude Code Usage Monitor...');
    console.log(`📋 Plan: ${plan}`);
    console.log(`🔄 Refresh interval: ${options.refresh}s`);
    
    if (options.dataPath) {
      console.log(`📁 Data path: ${options.dataPath}`);
    }

    try {
      await monitor.start();
    } catch (error) {
      console.error('Failed to start monitor:', error);
      process.exit(1);
    }
  });

// Add info command
program
  .command('info')
  .description('Show information about Claude data paths and configuration')
  .option('-d, --data-path <path>', 'Custom path to Claude data directory')
  .action(async (options) => {
    const { getDefaultDataPaths, discoverClaudeDataPaths } = await import('./utils/pathDiscovery.js');
    
    console.log('\n📍 Claude Data Paths:\n');
    
    const defaultPaths = getDefaultDataPaths();
    console.log('Default paths:');
    defaultPaths.forEach(path => console.log(`  - ${path}`));
    
    const discoveredPaths = await discoverClaudeDataPaths();
    console.log('\nDiscovered paths:');
    
    if (discoveredPaths.length === 0) {
      console.log('  No Claude data directories found');
    } else {
      discoveredPaths.forEach(path => console.log(`  ✅ ${path}`));
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
        
        console.log('\n📊 Usage Analysis:\n');
        console.log(`Detected plan: ${analysis.detectedPlan}`);
        console.log(`Max tokens used: ${analysis.maxTokensUsed.toLocaleString()} (weighted)`);
        console.log(`Confidence: ${analysis.confidence}`);
        if (analysis.recommendation) {
          console.log(`Note: ${analysis.recommendation}`);
        }
        
        // Estimate actual tokens
        const actualTokens = planDetector.estimateActualTokens(
          analysis.maxTokensUsed, 
          blocks
        );
        console.log(`Estimated actual tokens: ~${actualTokens.toLocaleString()}`);
      }
    } catch (error) {
      // Silent fail - info command should work even without data
    }
    
    console.log('\n💡 Tips:');
    console.log('  - Use CLAUDE_DATA_PATH environment variable to set custom path');
    console.log('  - Use --data-path option to override the default path');
    console.log('  - Use --plan auto (or just omit --plan) for automatic plan detection');
    console.log('  - Make sure Claude Code is running and has created session data');
  });

program.parse();