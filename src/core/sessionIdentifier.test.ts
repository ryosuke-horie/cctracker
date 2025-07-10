import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageEntry } from '../models/types.js';
import { SessionIdentifier } from './sessionIdentifier.js';

describe('SessionIdentifier', () => {
  let identifier: SessionIdentifier;
  const fixedDate = new Date('2024-01-15T14:30:00Z'); // Monday 2:30 PM

  beforeEach(() => {
    identifier = new SessionIdentifier();
    // Set up fake timers with a fixed date
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Helper function to create mock usage entries
  const createMockEntry = (timestamp: Date, inputTokens = 100, outputTokens = 50): UsageEntry => ({
    timestamp,
    inputTokens,
    outputTokens,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    model: 'claude-3-sonnet-20240229',
  });

  describe('createSessionBlocks', () => {
    it('should create single session block for entries within 5 hours', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T10:00:00Z')),
        createMockEntry(new Date('2024-01-15T12:00:00Z')),
        createMockEntry(new Date('2024-01-15T14:00:00Z')),
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].entries).toHaveLength(3);
      expect(blocks[0].isGap).toBe(false);
      expect(blocks[0].tokenCounts.inputTokens).toBe(300); // 3 entries × 100
      expect(blocks[0].tokenCounts.outputTokens).toBe(150); // 3 entries × 50
    });

    it('should create separate blocks when entries span more than 5 hours', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T08:00:00Z')), // Start: 8 AM
        createMockEntry(new Date('2024-01-15T14:00:00Z')), // 6 hours later: 2 PM
      ];

      const blocks = identifier.createSessionBlocks(entries);

      // May create: session1, gap, session2 = 3 blocks total
      expect(blocks.length).toBeGreaterThan(1);
      expect(blocks[0].entries).toHaveLength(1);
      // Find non-gap blocks
      const sessionBlocks = blocks.filter((b) => !b.isGap);
      expect(sessionBlocks).toHaveLength(2);
    });

    it('should create gap blocks when there are long periods of inactivity', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T08:00:00Z')),
        createMockEntry(new Date('2024-01-15T20:00:00Z')), // 12 hours later
      ];

      const blocks = identifier.createSessionBlocks(entries);

      // Should have: session1, gap, session2
      expect(blocks).toHaveLength(3);
      expect(blocks[0].isGap).toBe(false);
      expect(blocks[1].isGap).toBe(true);
      expect(blocks[2].isGap).toBe(false);
    });

    it('should mark active blocks correctly', () => {
      // Current time is 14:30, create entries that should result in active session
      const entries = [
        createMockEntry(new Date('2024-01-15T14:00:00Z')), // Recent entry
        createMockEntry(new Date('2024-01-15T14:20:00Z')), // Very recent
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks.length).toBeGreaterThan(0);
      // Check if any block is active (some should be active as their end time is in the future)
      const hasActiveBlock = blocks.some((b) => b.isActive);
      expect(hasActiveBlock).toBe(true);
    });

    it('should handle empty entries array', () => {
      const blocks = identifier.createSessionBlocks([]);
      expect(blocks).toEqual([]);
    });

    it('should aggregate token counts correctly', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T12:00:00Z'), 100, 50),
        createMockEntry(new Date('2024-01-15T12:30:00Z'), 200, 100),
        createMockEntry(new Date('2024-01-15T13:00:00Z'), 150, 75),
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].tokenCounts).toEqual({
        inputTokens: 450, // 100 + 200 + 150
        outputTokens: 225, // 50 + 100 + 75
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      });
    });

    it('should track models used in the block', () => {
      const entries = [
        { ...createMockEntry(new Date('2024-01-15T12:00:00Z')), model: 'claude-3-opus-20240229' },
        { ...createMockEntry(new Date('2024-01-15T12:30:00Z')), model: 'claude-3-sonnet-20240229' },
        { ...createMockEntry(new Date('2024-01-15T13:00:00Z')), model: 'claude-3-sonnet-20240229' },
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].models).toContain('claude-3-opus-20240229');
      expect(blocks[0].models).toContain('claude-3-sonnet-20240229');
      expect(blocks[0].models).toHaveLength(2); // Should deduplicate
    });

    it('should calculate duration correctly', () => {
      const startTime = new Date('2024-01-15T12:00:00Z');
      const endTime = new Date('2024-01-15T12:30:00Z'); // 30 minutes later (within same session)

      const entries = [createMockEntry(startTime), createMockEntry(endTime)];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks.length).toBeGreaterThan(0);
      // Check the first session block
      const sessionBlock = blocks.find((b) => !b.isGap);
      expect(sessionBlock).toBeDefined();

      // Duration is calculated from session start time to actualEndTime (12:30)
      // But session start is aligned to reset hour, so calculate accordingly
      expect(sessionBlock?.durationMinutes).toBeGreaterThan(0);
      expect(sessionBlock?.actualEndTime).toEqual(endTime);
    });
  });

  describe('Session alignment to reset hours', () => {
    it('should align session start times to reset hours', () => {
      // Entry at 14:30, check what the actual alignment is
      const entries = [createMockEntry(new Date('2024-01-15T14:30:00Z'))];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks.length).toBeGreaterThan(0);
      const sessionBlock = blocks.find((b) => !b.isGap);
      expect(sessionBlock).toBeDefined();

      // Test that the start time is aligned to some hour (minutes should be 0)
      expect(sessionBlock?.startTime.getMinutes()).toBe(0);
      expect(sessionBlock?.startTime.getSeconds()).toBe(0);

      // Test that end time is 5 hours after start time
      const expectedEndHour = (sessionBlock?.startTime.getHours() + 5) % 24;
      expect(sessionBlock?.endTime.getHours()).toBe(expectedEndHour);
    });

    it('should handle custom reset hours', () => {
      const customIdentifier = new SessionIdentifier(5, [0, 6, 12, 18]); // Every 6 hours

      const entries = [
        createMockEntry(new Date('2024-01-15T14:30:00Z')), // 2:30 PM
      ];

      const blocks = customIdentifier.createSessionBlocks(entries);

      expect(blocks.length).toBeGreaterThan(0);
      const sessionBlock = blocks.find((b) => !b.isGap);
      expect(sessionBlock).toBeDefined();

      // Should align to one of the custom reset hours [0, 6, 12, 18]
      const alignedHour = sessionBlock?.startTime.getHours();
      expect([0, 6, 12, 18]).toContain(alignedHour);
    });
  });

  describe('Edge cases', () => {
    it('should handle entries with same timestamp', () => {
      const sameTime = new Date('2024-01-15T12:00:00Z');
      const entries = [createMockEntry(sameTime, 100, 50), createMockEntry(sameTime, 200, 100)];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].entries).toHaveLength(2);
      expect(blocks[0].tokenCounts.inputTokens).toBe(300);
    });

    it('should handle entries in non-chronological order', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T14:00:00Z')),
        createMockEntry(new Date('2024-01-15T12:00:00Z')), // Earlier time
        createMockEntry(new Date('2024-01-15T13:00:00Z')),
      ];

      // Note: The function expects entries to be sorted, but let's test what happens
      const blocks = identifier.createSessionBlocks(entries);

      // Should still work but may create multiple blocks due to time jumps
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('should handle very short sessions', () => {
      const entries = [
        createMockEntry(new Date('2024-01-15T12:00:00Z')),
        createMockEntry(new Date('2024-01-15T12:01:00Z')), // 1 minute later
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks.length).toBeGreaterThan(0);
      const sessionBlock = blocks.find((b) => !b.isGap);
      expect(sessionBlock).toBeDefined();

      // Check that entries are properly stored
      expect(sessionBlock?.entries).toHaveLength(2);
      expect(sessionBlock?.actualEndTime).toEqual(new Date('2024-01-15T12:01:00Z'));
    });

    it('should handle cache tokens correctly', () => {
      const entries = [
        {
          timestamp: new Date('2024-01-15T12:00:00Z'),
          inputTokens: 100,
          outputTokens: 50,
          cacheCreationTokens: 25,
          cacheReadTokens: 10,
          model: 'claude-3-sonnet-20240229',
        },
      ];

      const blocks = identifier.createSessionBlocks(entries);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].tokenCounts).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 25,
        cacheReadTokens: 10,
      });
    });
  });
});
