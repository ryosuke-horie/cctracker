import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Formatter } from './formatter.js';
import { SessionBlock, Plan } from '../models/types.js';

describe('Formatter', () => {
  let formatter: Formatter;

  beforeEach(() => {
    formatter = new Formatter();
  });

  describe('formatProgressBar', () => {
    it('should format progress bar with correct colors and width', () => {
      // Test safe range (green)
      const safeBar = formatter.formatProgressBar(25, 20);
      expect(safeBar).toContain('[');
      expect(safeBar).toContain(']');
      expect(safeBar).toContain('25.0%');

      // Test warning range (yellow)
      const warningBar = formatter.formatProgressBar(75, 20);
      expect(warningBar).toContain('75.0%');

      // Test critical range (red)
      const criticalBar = formatter.formatProgressBar(95, 20);
      expect(criticalBar).toContain('95.0%');
    });

    it('should handle edge cases', () => {
      const zeroBar = formatter.formatProgressBar(0);
      expect(zeroBar).toContain('0.0%');

      const fullBar = formatter.formatProgressBar(100);
      expect(fullBar).toContain('100.0%');

      const overBar = formatter.formatProgressBar(150);
      expect(overBar).toContain('150.0%');
    });
  });

  describe('formatTokenStatus', () => {
    it('should format token status with appropriate emoji and numbers', () => {
      const safeStatus = formatter.formatTokenStatus(2500, 10000, 25);
      expect(safeStatus).toContain('🟢');
      expect(safeStatus).toContain('2,500');
      expect(safeStatus).toContain('10,000');

      const warningStatus = formatter.formatTokenStatus(5000, 10000, 50);
      expect(warningStatus).toContain('🟡');
      expect(warningStatus).toContain('5,000');
      expect(warningStatus).toContain('10,000');

      const warningStatus2 = formatter.formatTokenStatus(7500, 10000, 75);
      expect(warningStatus2).toContain('🟡');

      const criticalStatus = formatter.formatTokenStatus(9500, 10000, 95);
      expect(criticalStatus).toContain('🔴');
    });
  });

  describe('formatBurnRate', () => {
    it('should format burn rate with indicator and value', () => {
      const burnRate = { tokensPerMinute: 15.5, costPerHour: 0.05 };
      const result = formatter.formatBurnRate(burnRate, '🚶');

      expect(result).toContain('🚶');
      expect(result).toContain('15.5');
      expect(result).toContain('tokens/min');
    });
  });

  describe('formatTimeRemaining', () => {
    it('should format time in hours and minutes', () => {
      expect(formatter.formatTimeRemaining(150)).toBe('2h 30m');
      expect(formatter.formatTimeRemaining(90)).toBe('1h 30m');
      expect(formatter.formatTimeRemaining(45)).toBe('45m');
      expect(formatter.formatTimeRemaining(0)).toBe('0m');
    });
  });

  describe('formatSessionInfo', () => {
    it('should format active session info', () => {
      const mockBlock: SessionBlock = {
        id: 'test',
        startTime: new Date(),
        endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
        isActive: true,
        isGap: false,
        entries: [],
        tokenCounts: { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
        costUSD: 0,
        models: [],
        durationMinutes: 0
      };

      const result = formatter.formatSessionInfo(mockBlock);
      expect(result).toContain('Session ends at');
      expect(result).toContain('remaining');
    });

    it('should handle null active session', () => {
      const result = formatter.formatSessionInfo(null);
      expect(result).toContain('No active session');
    });
  });

  describe('formatWarning', () => {
    it('should format warning message with emoji', () => {
      const result = formatter.formatWarning('Test warning');
      expect(result).toContain('⚠️');
      expect(result).toContain('Test warning');
    });
  });

  describe('formatError', () => {
    it('should format error message with emoji', () => {
      const result = formatter.formatError('Test error');
      expect(result).toContain('❌');
      expect(result).toContain('Test error');
    });
  });

  describe('formatSuccess', () => {
    it('should format success message with emoji', () => {
      const result = formatter.formatSuccess('Test success');
      expect(result).toContain('✅');
      expect(result).toContain('Test success');
    });
  });

  describe('formatPlan', () => {
    it('should format different plan types', () => {
      expect(formatter.formatPlan('pro')).toContain('Claude Pro');
      expect(formatter.formatPlan('max5')).toContain('Claude Max5');
      expect(formatter.formatPlan('max20')).toContain('Claude Max20');
      expect(formatter.formatPlan('custom_max')).toContain('Custom Max');
    });
  });

  describe('Terminal control methods', () => {
    it('should call terminal control methods without error', () => {
      // Mock stdout.write to capture calls
      const mockWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      formatter.hideCursor();
      expect(mockWrite).toHaveBeenCalledWith('\x1B[?25l');

      formatter.showCursor();
      expect(mockWrite).toHaveBeenCalledWith('\x1B[?25h');

      formatter.moveCursorUp(5);
      expect(mockWrite).toHaveBeenCalledWith('\x1B[5A');

      mockWrite.mockRestore();
    });

    it('should clear screen', () => {
      const mockClear = vi.spyOn(console, 'clear').mockImplementation(() => {});
      const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});

      formatter.clearScreen();

      expect(mockClear).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith('\x1Bc');

      mockClear.mockRestore();
      mockLog.mockRestore();
    });
  });
});