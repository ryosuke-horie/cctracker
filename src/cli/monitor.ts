import { isBefore } from 'date-fns';
import { BurnRateCalculator } from '../core/burnRateCalculator.js';
import { DataLoader } from '../core/dataLoader.js';
import { SessionIdentifier } from '../core/sessionIdentifier.js';
import { TokenCalculator } from '../core/tokenCalculator.js';
import type { BurnRate, Plan, SessionBlock, UsageProjection } from '../models/types.js';
import { Formatter } from './formatter.js';

interface MonitorOptions {
  plan: Plan;
  refreshInterval?: number;
  dataPath?: string;
}

export class Monitor {
  private options: MonitorOptions;
  private dataLoader: DataLoader;
  private sessionIdentifier: SessionIdentifier;
  private tokenCalculator: TokenCalculator;
  private burnRateCalculator: BurnRateCalculator;
  private formatter: Formatter;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(options: MonitorOptions) {
    this.options = options;
    this.dataLoader = new DataLoader(options.dataPath);
    this.sessionIdentifier = new SessionIdentifier();
    this.tokenCalculator = new TokenCalculator();
    this.burnRateCalculator = new BurnRateCalculator();
    this.formatter = new Formatter();
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.formatter.hideCursor();

    // Initial display
    await this.update();

    // Set up refresh interval
    const refreshInterval = this.options.refreshInterval || 3000;
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.update();
      }
    }, refreshInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.formatter.showCursor();
    console.log(`\n${this.formatter.formatSuccess('Monitor stopped')}`);
    process.exit(0);
  }

  private async update(): Promise<void> {
    try {
      // Load and process data
      const entries = await this.dataLoader.loadUsageData();
      const blocks = this.sessionIdentifier.createSessionBlocks(entries);

      // Find active session
      const activeBlock = blocks.find((b) => b.isActive && !b.isGap) || null;

      // Calculate metrics
      const currentTokens = activeBlock
        ? this.tokenCalculator.calculateBlockWeightedTokens(activeBlock)
        : 0;

      const limit = this.tokenCalculator.determinePlanLimit(this.options.plan, blocks);
      const percentage = this.tokenCalculator.calculateTokenPercentage(currentTokens, limit);
      const burnRate = this.burnRateCalculator.calculateHourlyBurnRate(blocks);
      const burnRateIndicator = this.burnRateCalculator.getBurnRateIndicator(
        burnRate.tokensPerMinute
      );

      // Check for plan auto-switching
      if (this.options.plan === 'pro' && currentTokens > 44000) {
        this.options.plan = 'custom_max';
        console.log(
          this.formatter.formatWarning(
            'Detected usage above Pro limit. Switching to custom_max mode.'
          )
        );
      }

      // Calculate projections
      const projection = this.burnRateCalculator.projectUsage(
        activeBlock,
        currentTokens,
        limit,
        burnRate
      );

      const depletionTime = this.burnRateCalculator.calculateDepletionTime(
        currentTokens,
        limit,
        burnRate
      );

      // Display
      this.display({
        plan: this.options.plan,
        currentTokens,
        limit,
        percentage,
        burnRate,
        burnRateIndicator,
        activeBlock,
        projection,
        depletionTime,
      });
    } catch (error) {
      console.error(
        this.formatter.formatError(
          `Error updating monitor: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      );
    }
  }

  private display(data: {
    plan: Plan;
    currentTokens: number;
    limit: number;
    percentage: number;
    burnRate: BurnRate;
    burnRateIndicator: string;
    activeBlock: SessionBlock | null;
    projection: UsageProjection | null;
    depletionTime: Date | null;
  }): void {
    this.formatter.clearScreen();

    console.log('\n🎯 Claude Code Usage Monitor\n');
    console.log(`Plan: ${this.formatter.formatPlan(data.plan)}`);
    console.log('─'.repeat(60));

    // Token usage
    console.log(this.formatter.formatTokenStatus(data.currentTokens, data.limit, data.percentage));
    console.log(this.formatter.formatProgressBar(data.percentage));

    console.log('─'.repeat(60));

    // Burn rate
    console.log(this.formatter.formatBurnRate(data.burnRate, data.burnRateIndicator));

    // Session info
    console.log(this.formatter.formatSessionInfo(data.activeBlock));

    // Warnings
    if (data.depletionTime && data.activeBlock) {
      if (isBefore(data.depletionTime, data.activeBlock.endTime)) {
        console.log(this.formatter.formatWarning(`Tokens will deplete before session reset!`));
      }
    }

    if (data.percentage >= 90) {
      console.log(this.formatter.formatWarning('Token limit nearly reached!'));
    }

    console.log(`\n${this.formatter.formatSuccess('Press Ctrl+C to exit')}`);
  }
}
