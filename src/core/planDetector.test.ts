import { beforeEach, describe, expect, it } from 'vitest';
import type { SessionBlock } from '../models/types.js';
import { PlanDetector } from './planDetector.js';

describe('PlanDetector', () => {
  let detector: PlanDetector;

  beforeEach(() => {
    detector = new PlanDetector();
  });

  // Helper function to create mock session blocks
  const createMockBlock = (
    tokenUsage: number,
    model: string = 'claude-3-sonnet-20240229'
  ): SessionBlock => {
    const inputTokens = Math.floor(tokenUsage / 2);
    const outputTokens = tokenUsage - inputTokens;

    return {
      id: `block-${Date.now()}`,
      startTime: new Date(),
      endTime: new Date(),
      isActive: false,
      isGap: false,
      entries: [
        {
          timestamp: new Date(),
          inputTokens,
          outputTokens,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          model,
        },
      ],
      tokenCounts: {
        inputTokens,
        outputTokens,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      costUSD: 0,
      models: [model],
      durationMinutes: 60,
    };
  };

  describe('detectPlan', () => {
    it('should detect Pro plan for low usage', () => {
      // Create blocks with usage well within Pro limits
      const blocks = [
        createMockBlock(5000), // Well within Pro limit
        createMockBlock(3000),
      ];

      const result = detector.detectPlan(blocks);
      expect(result).toBe('pro');
    });

    it('should detect Max5 plan for moderate usage', () => {
      // Create blocks with usage exceeding Pro but within Max5
      const blocks = [
        createMockBlock(180000), // Above Pro (44000) but within Max5 threshold
        createMockBlock(150000),
      ];

      const result = detector.detectPlan(blocks);
      expect(result).toBe('max5');
    });

    it('should detect Max20 plan for high usage', () => {
      // Create blocks with usage exceeding Max5 limits
      const blocks = [
        createMockBlock(750000), // Above Max5 (220000) threshold
        createMockBlock(600000),
      ];

      const result = detector.detectPlan(blocks);
      expect(result).toBe('max20');
    });

    it('should upgrade Pro to Max5 when usage exceeds Pro limits', () => {
      // Usage exceeds Pro limit but is not quite at Max5 threshold
      const blocks = [
        createMockBlock(50000), // Exceeds Pro limit (44000)
      ];

      const result = detector.detectPlan(blocks);
      expect(result).toBe('max5');
    });

    it('should return Pro for empty blocks', () => {
      const result = detector.detectPlan([]);
      expect(result).toBe('pro');
    });

    it('should handle Opus model weighting correctly', () => {
      // Create block with Opus model (5x weighting)
      const block = createMockBlock(10000, 'claude-3-opus-20240229');
      // With 5x weighting: 10000 * 5 = 50000, which exceeds Pro

      const result = detector.detectPlan([block]);
      expect(result).toBe('max5');
    });
  });

  describe('analyzePlanUsage', () => {
    it('should provide detailed analysis with high confidence for clear Max20 usage', () => {
      const blocks = [
        createMockBlock(850000), // Very close to Max20 limit
      ];

      const analysis = detector.analyzePlanUsage(blocks);

      expect(analysis.detectedPlan).toBe('max20');
      expect(analysis.confidence).toBe('high');
      expect(analysis.maxTokensUsed).toBe(850000);
      expect(analysis.recommendation).toContain('Max20');
    });

    it('should provide medium confidence for borderline usage', () => {
      const blocks = [
        createMockBlock(40000), // Near Pro threshold but not exceeding
      ];

      const analysis = detector.analyzePlanUsage(blocks);

      expect(analysis.detectedPlan).toBe('pro');
      expect(analysis.confidence).toBe('medium');
      expect(analysis.recommendation).toContain('uncertain');
    });

    it('should provide low confidence for no data', () => {
      const analysis = detector.analyzePlanUsage([]);

      expect(analysis.detectedPlan).toBe('pro');
      expect(analysis.confidence).toBe('low');
      expect(analysis.maxTokensUsed).toBe(0);
      expect(analysis.recommendation).toContain('No usage data');
    });

    it('should detect when usage exceeds Pro limits', () => {
      const blocks = [
        createMockBlock(50000), // Exceeds Pro limit
      ];

      const analysis = detector.analyzePlanUsage(blocks);

      expect(analysis.confidence).toBe('medium');
      expect(analysis.recommendation).toContain('exceeds Pro limits');
    });
  });

  describe('estimateActualTokens', () => {
    it('should estimate actual tokens from weighted tokens with mixed models', () => {
      const blocks = [
        createMockBlock(10000, 'claude-3-opus-20240229'), // 1 Opus entry
        createMockBlock(10000, 'claude-3-sonnet-20240229'), // 1 Sonnet entry
        createMockBlock(10000, 'claude-3-sonnet-20240229'), // Another Sonnet entry
      ];

      // With the above: 1 Opus, 2 Sonnet entries
      // Opus ratio: 1/3 = 0.33
      // Average weight: 0.33 * 5 + 0.67 * 1 = 1.65 + 0.67 = 2.32
      // Weighted tokens: (10000 * 5) + 10000 + 10000 = 70000
      // Estimated actual: 70000 / 2.32 ≈ 30172

      const weightedTokens = 70000; // Total weighted from above calculation
      const result = detector.estimateActualTokens(weightedTokens, blocks);

      expect(result).toBe(30000); // Correct expected value: 70000 / 2.333 ≈ 30000
    });

    it('should return same value for all Sonnet models', () => {
      const blocks = [
        createMockBlock(10000, 'claude-3-sonnet-20240229'),
        createMockBlock(10000, 'claude-3-sonnet-20240229'),
      ];

      const weightedTokens = 20000; // No weighting for Sonnet
      const result = detector.estimateActualTokens(weightedTokens, blocks);

      expect(result).toBe(20000);
    });

    it('should handle empty blocks gracefully', () => {
      const result = detector.estimateActualTokens(1000, []);
      expect(result).toBe(1000);
    });

    it('should handle all Opus models correctly', () => {
      const blocks = [
        createMockBlock(10000, 'claude-3-opus-20240229'),
        createMockBlock(10000, 'claude-3-opus-20240229'),
      ];

      // All Opus: ratio = 1.0, average weight = 5
      // Weighted tokens: 50000 + 50000 = 100000
      // Estimated actual: 100000 / 5 = 20000

      const weightedTokens = 100000;
      const result = detector.estimateActualTokens(weightedTokens, blocks);

      expect(result).toBe(20000);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle blocks with gap entries correctly', () => {
      const regularBlock = createMockBlock(50000);
      const gapBlock: SessionBlock = {
        id: 'gap-block',
        startTime: new Date(),
        endTime: new Date(),
        isActive: false,
        isGap: true, // This should be ignored
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
      };

      const blocks = [regularBlock, gapBlock];
      const result = detector.detectPlan(blocks);

      // Should only consider regularBlock, ignore gap
      expect(result).toBe('max5');
    });

    it('should handle exact threshold values', () => {
      // Test exact Pro threshold (80% of 44000 = 35200)
      const proThresholdBlock = createMockBlock(35200);
      expect(detector.detectPlan([proThresholdBlock])).toBe('pro');

      // Test just over Pro threshold
      const overProBlock = createMockBlock(35300);
      expect(detector.detectPlan([overProBlock])).toBe('pro');

      // Test exact Max5 threshold (80% of 220000 = 176000)
      const max5ThresholdBlock = createMockBlock(176000);
      expect(detector.detectPlan([max5ThresholdBlock])).toBe('max5');
    });

    it('should handle models with partial name matches', () => {
      const blocks = [
        createMockBlock(10000, 'claude-opus-experimental'),
        createMockBlock(10000, 'new-sonnet-model'),
        createMockBlock(10000, 'unknown-model'),
      ];

      // Should detect opus in first model name
      const analysis = detector.analyzePlanUsage(blocks);

      // With opus weighting: first block is 10000 tokens -> (5000+5000)*5 = 50000 (max)
      // Other blocks: 10000 each (no weighting)
      // Max value should be 50000
      expect(analysis.maxTokensUsed).toBe(50000);
    });
  });
});
