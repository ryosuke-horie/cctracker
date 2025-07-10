import { addMinutes, subMinutes } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionBlock, UsageEntry } from '../models/types.js';
import { BurnRateCalculator } from './burnRateCalculator.js';

// Type for session blocks with optional durationMinutes for testing
type TestSessionBlock = Omit<SessionBlock, 'durationMinutes'> & { durationMinutes?: number };

describe('BurnRateCalculator', () => {
  let calculator: BurnRateCalculator;
  const fixedDate = new Date('2024-01-15T14:30:00Z'); // Fixed current time

  beforeEach(() => {
    calculator = new BurnRateCalculator();
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper function to create mock session blocks
  const createMockBlock = (
    startTime: Date,
    actualEndTime?: Date,
    inputTokens = 100,
    outputTokens = 50,
    model = 'claude-3-sonnet-20240229'
  ): SessionBlock => {
    const entries: UsageEntry[] = [
      {
        timestamp: startTime,
        inputTokens,
        outputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        model,
      },
    ];

    return {
      id: `block-${startTime.getTime()}`,
      startTime,
      endTime: addMinutes(startTime, 300), // 5 hours later
      actualEndTime,
      isActive: false,
      isGap: false,
      entries,
      tokenCounts: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      costUSD: 0,
      models: [model],
      durationMinutes: actualEndTime
        ? Math.floor((actualEndTime.getTime() - startTime.getTime()) / 60000)
        : 60,
    };
  };

  describe('calculateHourlyBurnRate', () => {
    it('should calculate burn rate for blocks within the last hour', () => {
      // Create blocks: one recent (within last hour), one old
      const oneHourAgo = subMinutes(fixedDate, 60);
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);
      const twoHoursAgo = subMinutes(fixedDate, 120);

      const blocks = [
        createMockBlock(twoHoursAgo, subMinutes(fixedDate, 90), 200, 100), // Too old
        createMockBlock(oneHourAgo, thirtyMinutesAgo, 300, 150), // Within last hour
        createMockBlock(thirtyMinutesAgo, fixedDate, 400, 200), // Recent
      ];

      const result = calculator.calculateHourlyBurnRate(blocks);

      // Should only count the last two blocks
      // Tokens: (300+150) + (400+200) = 1050 tokens total
      // Time: 30 + 30 = 60 minutes total
      // Rate: 1050/60 = 17.5 tokens per minute
      expect(result.tokensPerMinute).toBeCloseTo(17.5, 1);
      expect(result.costPerHour).toBeGreaterThan(0);
    });

    it('should handle blocks that partially overlap with the last hour', () => {
      const twoHoursAgo = subMinutes(fixedDate, 120);
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);

      const blocks = [
        // Block spans from 2 hours ago to 30 minutes ago
        // Only the last 30 minutes should count
        createMockBlock(twoHoursAgo, thirtyMinutesAgo, 600, 300), // 900 tokens total
      ];

      const result = calculator.calculateHourlyBurnRate(blocks);

      // Proportional calculation: (900 tokens * 30 minutes) / 90 minutes total = 300 tokens
      // Rate: 300 tokens / 30 minutes = 10 tokens per minute
      expect(result.tokensPerMinute).toBeCloseTo(10, 1);
    });

    it('should return zero burn rate when no recent activity', () => {
      const twoHoursAgo = subMinutes(fixedDate, 120);
      const threeHoursAgo = subMinutes(fixedDate, 180);

      const blocks = [createMockBlock(threeHoursAgo, twoHoursAgo, 100, 50)];

      const result = calculator.calculateHourlyBurnRate(blocks);

      expect(result.tokensPerMinute).toBe(0);
      expect(result.costPerHour).toBe(0);
    });

    it('should ignore gap blocks', () => {
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);

      const gapBlock: SessionBlock = {
        id: 'gap-block',
        startTime: thirtyMinutesAgo,
        endTime: fixedDate,
        isActive: false,
        isGap: true, // Should be ignored
        entries: [],
        tokenCounts: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        costUSD: 0,
        models: [],
        durationMinutes: 30,
      };

      const regularBlock = createMockBlock(thirtyMinutesAgo, fixedDate, 100, 50);

      const blocks = [gapBlock, regularBlock];
      const result = calculator.calculateHourlyBurnRate(blocks);

      // Should only count the regular block
      expect(result.tokensPerMinute).toBeCloseTo(5, 1); // 150 tokens / 30 minutes = 5
    });

    it('should handle empty blocks array', () => {
      const result = calculator.calculateHourlyBurnRate([]);

      expect(result.tokensPerMinute).toBe(0);
      expect(result.costPerHour).toBe(0);
    });

    it('should handle blocks with weighted tokens (Opus)', () => {
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);

      const blocks = [
        createMockBlock(thirtyMinutesAgo, fixedDate, 100, 50, 'claude-3-opus-20240229'),
      ];

      const result = calculator.calculateHourlyBurnRate(blocks);

      // Opus tokens are weighted 5x: (100+50)*5 = 750 tokens
      // Rate: 750 tokens / 30 minutes = 25 tokens per minute
      expect(result.tokensPerMinute).toBeCloseTo(25, 1);
    });
  });

  describe('projectUsage', () => {
    it('should project usage for active block with positive burn rate', () => {
      const activeBlock = createMockBlock(
        subMinutes(fixedDate, 60),
        undefined, // Still active
        200,
        100
      );
      activeBlock.isActive = true;
      activeBlock.endTime = addMinutes(fixedDate, 120); // Ends 2 hours from now

      const burnRate = { tokensPerMinute: 10, costPerHour: 0.01 };
      const currentTokens = 500;
      const tokenLimit = 1000;

      const result = calculator.projectUsage(activeBlock, currentTokens, tokenLimit, burnRate);

      expect(result).toBeDefined();
      expect(result?.remainingMinutes).toBe(120); // 2 hours remaining
      expect(result?.projectedTotalTokens).toBe(1700); // 500 + (10 * 120)
      expect(result?.projectedTotalCost).toBeGreaterThan(0);
    });

    it('should return null for null block', () => {
      const burnRate = { tokensPerMinute: 10, costPerHour: 0.01 };
      const result = calculator.projectUsage(null, 500, 1000, burnRate);

      expect(result).toBeNull();
    });

    it('should return null for zero burn rate', () => {
      const activeBlock = createMockBlock(subMinutes(fixedDate, 60));
      activeBlock.isActive = true;
      activeBlock.endTime = addMinutes(fixedDate, 120);

      const zeroBurnRate = { tokensPerMinute: 0, costPerHour: 0 };
      const result = calculator.projectUsage(activeBlock, 500, 1000, zeroBurnRate);

      expect(result).toBeNull();
    });

    it('should return null when session has already ended', () => {
      const expiredBlock = createMockBlock(subMinutes(fixedDate, 60));
      expiredBlock.isActive = true;
      expiredBlock.endTime = subMinutes(fixedDate, 30); // Already ended

      const burnRate = { tokensPerMinute: 10, costPerHour: 0.01 };
      const result = calculator.projectUsage(expiredBlock, 500, 1000, burnRate);

      expect(result).toBeNull();
    });
  });

  describe('calculateDepletionTime', () => {
    it('should calculate when tokens will be depleted', () => {
      const currentTokens = 800;
      const tokenLimit = 1000;
      const burnRate = { tokensPerMinute: 10, costPerHour: 0.01 };

      const result = calculator.calculateDepletionTime(currentTokens, tokenLimit, burnRate);

      expect(result).toBeDefined();
      // Remaining tokens: 1000 - 800 = 200
      // Time to deplete: 200 / 10 = 20 minutes
      const expectedTime = addMinutes(fixedDate, 20);
      expect(result?.getTime()).toBeCloseTo(expectedTime.getTime(), -3); // Allow some millisecond difference
    });

    it('should return null for zero burn rate', () => {
      const zeroBurnRate = { tokensPerMinute: 0, costPerHour: 0 };
      const result = calculator.calculateDepletionTime(500, 1000, zeroBurnRate);

      expect(result).toBeNull();
    });

    it('should return null when already at or above limit', () => {
      const burnRate = { tokensPerMinute: 10, costPerHour: 0.01 };

      const atLimitResult = calculator.calculateDepletionTime(1000, 1000, burnRate);
      expect(atLimitResult).toBeNull();

      const aboveLimitResult = calculator.calculateDepletionTime(1200, 1000, burnRate);
      expect(aboveLimitResult).toBeNull();
    });
  });

  describe('getBurnRateIndicator', () => {
    it('should return appropriate emoji indicators', () => {
      expect(calculator.getBurnRateIndicator(0)).toBe('⏸️');
      expect(calculator.getBurnRateIndicator(5)).toBe('🐌');
      expect(calculator.getBurnRateIndicator(25)).toBe('🚶');
      expect(calculator.getBurnRateIndicator(75)).toBe('🏃');
      expect(calculator.getBurnRateIndicator(150)).toBe('🚗');
      expect(calculator.getBurnRateIndicator(300)).toBe('✈️');
      expect(calculator.getBurnRateIndicator(600)).toBe('🚀');
    });
  });

  describe('Edge cases', () => {
    it('should handle very high burn rates', () => {
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);

      const blocks = [
        createMockBlock(thirtyMinutesAgo, fixedDate, 10000, 5000), // Very high usage
      ];

      const result = calculator.calculateHourlyBurnRate(blocks);

      expect(result.tokensPerMinute).toBeGreaterThan(100);
      expect(calculator.getBurnRateIndicator(result.tokensPerMinute)).toBe('🚀');
    });

    it('should handle fractional minutes correctly', () => {
      const now = fixedDate;
      const start = new Date(now.getTime() - 90000); // 1.5 minutes ago

      const blocks = [createMockBlock(start, now, 150, 0)];

      const result = calculator.calculateHourlyBurnRate(blocks);

      // The implementation might calculate differently, let's check actual behavior
      expect(result.tokensPerMinute).toBeGreaterThan(0);
      expect(result.tokensPerMinute).toBeLessThan(200); // Reasonable upper bound
    });

    it('should handle blocks with very short durations', () => {
      const start = subMinutes(fixedDate, 1);
      const blocks = [createMockBlock(start, fixedDate, 60, 0)];

      const result = calculator.calculateHourlyBurnRate(blocks);

      // 60 tokens in 1 minute = 60 tokens per minute
      expect(result.tokensPerMinute).toBe(60);
    });

    it('should handle blocks without durationMinutes set', () => {
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);
      const block = createMockBlock(thirtyMinutesAgo, fixedDate, 100, 50);

      // Remove durationMinutes to force fallback calculation
      delete (block as TestSessionBlock).durationMinutes;

      const blocks = [block];
      const result = calculator.calculateHourlyBurnRate(blocks);

      // Should use differenceInMinutes as fallback
      expect(result.tokensPerMinute).toBeGreaterThan(0);
    });

    it('should handle blocks with zero duration', () => {
      const now = fixedDate;
      const block = createMockBlock(now, now, 100, 50); // Same start and end time
      block.durationMinutes = 0; // Zero duration

      const blocks = [block];
      const result = calculator.calculateHourlyBurnRate(blocks);

      // Should return 0 due to proportionalTokens = 0
      expect(result.tokensPerMinute).toBe(0);
    });

    it('should handle blocks with calculated zero duration', () => {
      const thirtyMinutesAgo = subMinutes(fixedDate, 30);
      const block = createMockBlock(thirtyMinutesAgo, thirtyMinutesAgo, 100, 50); // Same start and actual end time

      // Remove durationMinutes to force calculation, and set actualEndTime = startTime
      delete (block as TestSessionBlock).durationMinutes;
      block.actualEndTime = block.startTime; // This will make calculated duration 0

      const blocks = [block];
      const result = calculator.calculateHourlyBurnRate(blocks);

      // Should hit the `: 0` fallback when blockDuration <= 0
      expect(result.tokensPerMinute).toBe(0);
    });
  });
});
