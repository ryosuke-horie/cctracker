import { SessionBlock, BurnRate, UsageProjection } from '../models/types.js';
import { subHours, isAfter, isBefore, differenceInMinutes, addMinutes } from 'date-fns';
import { TokenCalculator } from './tokenCalculator.js';

export class BurnRateCalculator {
  private tokenCalculator: TokenCalculator;

  constructor() {
    this.tokenCalculator = new TokenCalculator();
  }

  calculateHourlyBurnRate(blocks: SessionBlock[]): BurnRate {
    const now = new Date();
    const oneHourAgo = subHours(now, 1);
    
    let totalTokens = 0;
    let totalMinutes = 0;

    for (const block of blocks) {
      if (block.isGap) continue;

      // Check if block overlaps with the last hour
      if (isAfter(block.endTime, oneHourAgo) || 
          (block.actualEndTime && isAfter(block.actualEndTime, oneHourAgo))) {
        
        const blockStart = isAfter(block.startTime, oneHourAgo) 
          ? block.startTime 
          : oneHourAgo;
        
        const blockEnd = block.actualEndTime || now;
        const effectiveEnd = isBefore(blockEnd, now) ? blockEnd : now;
        
        const minutes = differenceInMinutes(effectiveEnd, blockStart);
        
        if (minutes > 0) {
          // Calculate proportional tokens for the time window
          const blockTokens = this.tokenCalculator.calculateBlockWeightedTokens(block);
          const blockDuration = block.durationMinutes || differenceInMinutes(
            block.actualEndTime || now,
            block.startTime
          );
          
          const proportionalTokens = blockDuration > 0 
            ? (blockTokens * minutes) / blockDuration
            : 0;
          
          totalTokens += proportionalTokens;
          totalMinutes += minutes;
        }
      }
    }

    const tokensPerMinute = totalMinutes > 0 ? totalTokens / totalMinutes : 0;
    const tokensPerHour = tokensPerMinute * 60;
    
    // Rough cost estimation (can be improved with actual pricing data)
    const costPerHour = tokensPerHour * 0.00001; // Placeholder rate

    return {
      tokensPerMinute,
      costPerHour
    };
  }

  projectUsage(
    activeBlock: SessionBlock | null,
    currentTokens: number,
    _tokenLimit: number,
    burnRate: BurnRate
  ): UsageProjection | null {
    if (!activeBlock || burnRate.tokensPerMinute === 0) {
      return null;
    }

    const now = new Date();
    const remainingMinutes = differenceInMinutes(activeBlock.endTime, now);
    
    if (remainingMinutes <= 0) {
      return null;
    }

    const projectedAdditionalTokens = burnRate.tokensPerMinute * remainingMinutes;
    const projectedTotalTokens = currentTokens + projectedAdditionalTokens;
    
    // Rough cost projection
    const projectedTotalCost = projectedTotalTokens * 0.00001;

    return {
      projectedTotalTokens,
      projectedTotalCost,
      remainingMinutes
    };
  }

  calculateDepletionTime(
    currentTokens: number,
    tokenLimit: number,
    burnRate: BurnRate
  ): Date | null {
    if (burnRate.tokensPerMinute === 0 || currentTokens >= tokenLimit) {
      return null;
    }

    const remainingTokens = tokenLimit - currentTokens;
    const minutesToDepletion = remainingTokens / burnRate.tokensPerMinute;
    
    return addMinutes(new Date(), minutesToDepletion);
  }

  getBurnRateIndicator(tokensPerMinute: number): string {
    if (tokensPerMinute === 0) return '⏸️';
    if (tokensPerMinute < 10) return '🐌';
    if (tokensPerMinute < 50) return '🚶';
    if (tokensPerMinute < 100) return '🏃';
    if (tokensPerMinute < 200) return '🚗';
    if (tokensPerMinute < 500) return '✈️';
    return '🚀';
  }
}