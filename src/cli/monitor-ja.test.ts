import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Monitor } from './monitor.js';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Monitor with Japanese locale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when locale is set to Japanese', () => {
    it('should display headers in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Mock the data loader to avoid actual file access
      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue([]),
      });

      await monitor.runOnce();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Claude Code 使用状況');
      expect(output).toContain('プラン:');
      expect(output).not.toContain('Claude Code Usage Status');
    });

    it('should display warnings in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Directly test the display logic by calling displayOnce with high percentage
      const testData = {
        plan: 'pro' as const,
        currentTokens: 45000,
        limit: 50000,
        percentage: 90, // This should trigger the warning
        burnRate: {
          tokensPerMinute: 100,
          tokensPerHour: 6000,
          confidence: 'high' as const,
        },
        burnRateIndicator: '🔥',
        activeBlock: null,
        projection: null,
        depletionTime: null,
      };

      // Call the private displayOnce method directly
      (monitor as any).displayOnce(testData);

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('トークン制限に近づいています！');
      expect(output).not.toContain('Token limit nearly reached!');
    });

    it('should display depletion warning in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Test depletion warning with activeBlock and depletionTime
      const testData = {
        plan: 'pro' as const,
        currentTokens: 40000,
        limit: 50000,
        percentage: 80,
        burnRate: {
          tokensPerMinute: 200,
          tokensPerHour: 12000,
          confidence: 'high' as const,
        },
        burnRateIndicator: '🔥',
        activeBlock: {
          startTime: new Date('2024-01-01T10:00:00'),
          endTime: new Date('2024-01-01T18:00:00'),
          entries: [],
          isActive: true,
          isGap: false,
        },
        projection: null,
        depletionTime: new Date('2024-01-01T17:00:00'), // Before session end
      };

      // Call the private displayOnce method directly
      (monitor as any).displayOnce(testData);

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('セッションリセット前にトークンが枯渇します！');
      expect(output).not.toContain('Tokens will deplete before session reset!');
    });

    it('should display stop message in Japanese when monitor is stopped', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Mock process.exit to prevent actual exit
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await monitor.stop();

      mockExit.mockRestore();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('モニターを停止しました');
      expect(output).not.toContain('Monitor stopped');
    });

    it('should display error messages in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Mock data loader to throw error
      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockRejectedValue(new Error('Test error')),
      });

      await monitor.runOnce();

      const output = mockConsoleError.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('使用状況データの取得エラー:');
      expect(output).not.toContain('Error fetching usage data:');
    });

    it('should display plan switch message in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // We need to test the plan switching logic more directly
      // Mock the dependencies to ensure we get the right conditions
      const mockSessionBlocks = [
        {
          startTime: new Date('2024-01-01T10:00:00'),
          endTime: new Date('2024-01-01T18:00:00'),
          entries: [],
          isActive: true,
          isGap: false,
        },
      ];

      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue([]),
      });

      vi.spyOn(monitor as any, 'sessionIdentifier', 'get').mockReturnValue({
        createSessionBlocks: vi.fn().mockReturnValue(mockSessionBlocks),
      });

      vi.spyOn(monitor as any, 'tokenCalculator', 'get').mockReturnValue({
        calculateBlockWeightedTokens: vi.fn().mockReturnValue(45000), // > 44000
        determinePlanLimit: vi.fn().mockReturnValue(50000),
        calculateTokenPercentage: vi.fn().mockReturnValue(90),
      });

      vi.spyOn(monitor as any, 'burnRateCalculator', 'get').mockReturnValue({
        calculateHourlyBurnRate: vi.fn().mockReturnValue({
          tokensPerMinute: 100,
          tokensPerHour: 6000,
          confidence: 'high',
        }),
        getBurnRateIndicator: vi.fn().mockReturnValue('🔥'),
        projectUsage: vi.fn().mockReturnValue(null),
        calculateDepletionTime: vi.fn().mockReturnValue(null),
      });

      await monitor.runOnce();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain(
        'Pro制限を超える使用を検出しました。custom_maxモードに切り替えます。'
      );
      expect(output).not.toContain('Detected usage above Pro limit. Switching to custom_max mode.');
    });

    it('should not display "Press Ctrl+C to exit" message for runOnce in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue([]),
      });

      await monitor.runOnce();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).not.toContain('Ctrl+C で終了');
    });
  });
});
