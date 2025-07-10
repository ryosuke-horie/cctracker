import type { Plan, PlanLimits, SessionBlock, UsageEntry } from '../models/types.js';

export const PLAN_LIMITS: PlanLimits = {
  pro: 44000, // ~7,000 actual tokens with 5x weighting
  max5: 220000, // ~35,000 actual tokens with 5x weighting
  max20: 880000, // ~140,000 actual tokens with 5x weighting
};

export class TokenCalculator {
  calculateWeightedTokens(entries: UsageEntry[]): number {
    let totalTokens = 0;

    for (const entry of entries) {
      const modelName = entry.model.toLowerCase();
      const baseTokens = entry.inputTokens + entry.outputTokens;

      if (modelName.includes('opus')) {
        // Opus models count as 5x
        totalTokens += 5 * baseTokens;
      } else if (modelName.includes('sonnet')) {
        // Sonnet models count as 1x
        totalTokens += baseTokens;
      } else {
        // Default: count as 1x
        totalTokens += baseTokens;
      }
    }

    return totalTokens;
  }

  calculateBlockWeightedTokens(block: SessionBlock): number {
    return this.calculateWeightedTokens(block.entries);
  }

  getTotalWeightedTokens(blocks: SessionBlock[]): number {
    return blocks
      .filter((block) => !block.isGap)
      .reduce((total, block) => total + this.calculateBlockWeightedTokens(block), 0);
  }

  getActiveSessionTokens(blocks: SessionBlock[]): number {
    const activeBlocks = blocks.filter((block) => block.isActive && !block.isGap);

    if (activeBlocks.length === 0) {
      return 0;
    }

    // Get the most recent active block (should typically be one)
    const mostRecentBlock = activeBlocks[activeBlocks.length - 1];
    return this.calculateBlockWeightedTokens(mostRecentBlock);
  }

  detectMaxTokensFromHistory(blocks: SessionBlock[]): number {
    let maxTokens = 0;

    for (const block of blocks) {
      if (!block.isGap) {
        const blockTokens = this.calculateBlockWeightedTokens(block);
        maxTokens = Math.max(maxTokens, blockTokens);
      }
    }

    return maxTokens;
  }

  determinePlanLimit(plan: Plan, blocks: SessionBlock[]): number {
    if (plan === 'custom_max') {
      const detected = this.detectMaxTokensFromHistory(blocks);
      return detected > 0 ? detected : PLAN_LIMITS.pro;
    }

    return PLAN_LIMITS[plan];
  }

  calculateTokenPercentage(currentTokens: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min((currentTokens / limit) * 100, 100);
  }

  getTokenStatus(percentage: number): 'safe' | 'warning' | 'critical' {
    if (percentage >= 90) return 'critical';
    if (percentage >= 50) return 'warning';
    return 'safe';
  }
}
