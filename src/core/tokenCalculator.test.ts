import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionBlock, UsageEntry } from '../models/types.js';
import { PLAN_LIMITS, TokenCalculator } from './tokenCalculator.js';

describe('TokenCalculator', () => {
  let calculator: TokenCalculator;

  beforeEach(() => {
    calculator = new TokenCalculator();
  });

  describe('calculateWeightedTokens', () => {
    it('should calculate weighted tokens for Opus model with 5x multiplier', () => {
      // Red: Write failing test first
      const entries: UsageEntry[] = [
        {
          timestamp: new Date(),
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-3-opus-20240229',
        },
      ];

      const result = calculator.calculateWeightedTokens(entries);

      // Should be (100 + 50) * 5 = 750
      expect(result).toBe(750);
    });

    it('should calculate weighted tokens for Sonnet model with 1x multiplier', () => {
      const entries: UsageEntry[] = [
        {
          timestamp: new Date(),
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-3-sonnet-20240229',
        },
      ];

      const result = calculator.calculateWeightedTokens(entries);

      // Should be (100 + 50) * 1 = 150
      expect(result).toBe(150);
    });

    it('should calculate weighted tokens for unknown model with 1x multiplier', () => {
      const entries: UsageEntry[] = [
        {
          timestamp: new Date(),
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-unknown-model',
        },
      ];

      const result = calculator.calculateWeightedTokens(entries);

      // Should be (100 + 50) * 1 = 150
      expect(result).toBe(150);
    });

    it('should handle multiple entries with different models', () => {
      const entries: UsageEntry[] = [
        {
          timestamp: new Date(),
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-3-opus-20240229',
        },
        {
          timestamp: new Date(),
          inputTokens: 200,
          outputTokens: 100,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model: 'claude-3-sonnet-20240229',
        },
      ];

      const result = calculator.calculateWeightedTokens(entries);

      // Should be (100 + 50) * 5 + (200 + 100) * 1 = 750 + 300 = 1050
      expect(result).toBe(1050);
    });

    it('should handle empty entries array', () => {
      const result = calculator.calculateWeightedTokens([]);
      expect(result).toBe(0);
    });
  });

  describe('calculateBlockWeightedTokens', () => {
    it('should calculate weighted tokens for a session block', () => {
      const block: SessionBlock = {
        id: 'test-block',
        startTime: new Date(),
        endTime: new Date(),
        isActive: false,
        isGap: false,
        entries: [
          {
            timestamp: new Date(),
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            model: 'claude-3-opus-20240229',
          },
        ],
        tokenCounts: {
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        costUSD: 0,
        models: ['claude-3-opus-20240229'],
        durationMinutes: 60,
      };

      const result = calculator.calculateBlockWeightedTokens(block);

      // Should be (100 + 50) * 5 = 750
      expect(result).toBe(750);
    });
  });

  describe('getTotalWeightedTokens', () => {
    it('should calculate total weighted tokens across all non-gap blocks', () => {
      const blocks: SessionBlock[] = [
        {
          id: 'block-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-opus-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-opus-20240229'],
          durationMinutes: 60,
        },
        {
          id: 'gap-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: true, // Should be excluded
          entries: [],
          tokenCounts: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: [],
          durationMinutes: 120,
        },
        {
          id: 'block-2',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 200,
              outputTokens: 100,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-sonnet-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 200,
            outputTokens: 100,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-sonnet-20240229'],
          durationMinutes: 30,
        },
      ];

      const result = calculator.getTotalWeightedTokens(blocks);

      // Should be 750 (opus) + 300 (sonnet) = 1050, gap excluded
      expect(result).toBe(1050);
    });
  });

  describe('getActiveSessionTokens', () => {
    it('should return tokens for the most recent active session', () => {
      const blocks: SessionBlock[] = [
        {
          id: 'block-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: true,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-opus-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-opus-20240229'],
          durationMinutes: 60,
        },
      ];

      const result = calculator.getActiveSessionTokens(blocks);

      // Should be (100 + 50) * 5 = 750
      expect(result).toBe(750);
    });

    it('should return 0 when no active sessions exist', () => {
      const blocks: SessionBlock[] = [
        {
          id: 'block-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false, // Not active
          isGap: false,
          entries: [],
          tokenCounts: {
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: [],
          durationMinutes: 60,
        },
      ];

      const result = calculator.getActiveSessionTokens(blocks);
      expect(result).toBe(0);
    });
  });

  describe('detectMaxTokensFromHistory', () => {
    it('should return the highest token count from non-gap blocks', () => {
      const blocks: SessionBlock[] = [
        {
          id: 'block-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 100,
              outputTokens: 50,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-opus-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 100,
            outputTokens: 50,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-opus-20240229'],
          durationMinutes: 60,
        },
        {
          id: 'block-2',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-sonnet-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-sonnet-20240229'],
          durationMinutes: 60,
        },
      ];

      const result = calculator.detectMaxTokensFromHistory(blocks);

      // Should be max of: 750 (opus) and 1500 (sonnet) = 1500
      expect(result).toBe(1500);
    });

    it('should return 0 for empty blocks array', () => {
      const result = calculator.detectMaxTokensFromHistory([]);
      expect(result).toBe(0);
    });
  });

  describe('determinePlanLimit', () => {
    it('should return detected limit for custom_max plan', () => {
      const blocks: SessionBlock[] = [
        {
          id: 'block-1',
          startTime: new Date(),
          endTime: new Date(),
          isActive: false,
          isGap: false,
          entries: [
            {
              timestamp: new Date(),
              inputTokens: 1000,
              outputTokens: 500,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
              model: 'claude-3-sonnet-20240229',
            },
          ],
          tokenCounts: {
            inputTokens: 1000,
            outputTokens: 500,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
          },
          costUSD: 0,
          models: ['claude-3-sonnet-20240229'],
          durationMinutes: 60,
        },
      ];

      const result = calculator.determinePlanLimit('custom_max', blocks);

      // Should return detected max tokens: 1500
      expect(result).toBe(1500);
    });

    it('should return pro limit for custom_max plan when no history exists', () => {
      const result = calculator.determinePlanLimit('custom_max', []);
      expect(result).toBe(PLAN_LIMITS.pro);
    });

    it('should return correct limits for known plans', () => {
      expect(calculator.determinePlanLimit('pro', [])).toBe(PLAN_LIMITS.pro);
      expect(calculator.determinePlanLimit('max5', [])).toBe(PLAN_LIMITS.max5);
      expect(calculator.determinePlanLimit('max20', [])).toBe(PLAN_LIMITS.max20);
    });
  });

  describe('calculateTokenPercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calculator.calculateTokenPercentage(250, 1000)).toBe(25);
      expect(calculator.calculateTokenPercentage(500, 1000)).toBe(50);
      expect(calculator.calculateTokenPercentage(1000, 1000)).toBe(100);
    });

    it('should handle edge cases', () => {
      expect(calculator.calculateTokenPercentage(0, 1000)).toBe(0);
      expect(calculator.calculateTokenPercentage(1500, 1000)).toBe(100); // Capped at 100%
      expect(calculator.calculateTokenPercentage(100, 0)).toBe(0); // Division by zero
    });
  });

  describe('getTokenStatus', () => {
    it('should return correct status based on percentage', () => {
      expect(calculator.getTokenStatus(30)).toBe('safe');
      expect(calculator.getTokenStatus(49)).toBe('safe');
      expect(calculator.getTokenStatus(50)).toBe('warning');
      expect(calculator.getTokenStatus(89)).toBe('warning');
      expect(calculator.getTokenStatus(90)).toBe('critical');
      expect(calculator.getTokenStatus(100)).toBe('critical');
    });
  });
});
