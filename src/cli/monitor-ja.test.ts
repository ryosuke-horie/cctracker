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

      // Mock data with high token usage
      const mockEntries = [
        {
          timestamp: Date.now(),
          usage: {
            tokenInput: 0,
            tokenOutput: 0,
            tokenTotal: 45000,
            tokenBalance: 5000,
            weightedBalance: 5000,
          },
        },
      ];

      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue(mockEntries),
      });

      await monitor.runOnce();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('トークン制限に近づいています！');
      expect(output).not.toContain('Token limit nearly reached!');
    });

    it('should display depletion warning in Japanese', async () => {
      const monitor = new Monitor({
        plan: 'pro',
        locale: 'ja',
      });

      // Mock data that would trigger depletion warning
      const now = Date.now();
      const mockEntries = [
        {
          timestamp: now - 30 * 60 * 1000, // 30 minutes ago
          usage: {
            tokenInput: 0,
            tokenOutput: 0,
            tokenTotal: 20000,
            tokenBalance: 30000,
            weightedBalance: 30000,
          },
        },
        {
          timestamp: now,
          usage: {
            tokenInput: 0,
            tokenOutput: 0,
            tokenTotal: 40000,
            tokenBalance: 10000,
            weightedBalance: 10000,
          },
        },
      ];

      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue(mockEntries),
      });

      await monitor.runOnce();

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

      // Mock data with usage above pro limit
      const mockEntries = [
        {
          timestamp: Date.now(),
          usage: {
            tokenInput: 0,
            tokenOutput: 0,
            tokenTotal: 45000,
            tokenBalance: 5000,
            weightedBalance: 5000,
          },
        },
      ];

      vi.spyOn(monitor as any, 'dataLoader', 'get').mockReturnValue({
        loadUsageData: vi.fn().mockResolvedValue(mockEntries),
      });

      await monitor.runOnce();

      const output = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n');
      expect(output).toContain('Pro制限を超える使用を検出しました。custom_maxモードに切り替えます。');
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