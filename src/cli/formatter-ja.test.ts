import { describe, expect, it } from 'vitest';
import { Formatter } from './formatter.js';

describe('Formatter with Japanese locale', () => {
  describe('when locale is set to Japanese', () => {
    it('should format token status in Japanese', () => {
      const formatter = new Formatter('ja');
      const result = formatter.formatTokenStatus(50000, 100000, 50);

      expect(result).toContain('トークン:');
      expect(result).not.toContain('Tokens:');
      expect(result).toContain('50,000 / 100,000');
    });

    it('should format burn rate in Japanese', () => {
      const formatter = new Formatter('ja');
      const burnRate = {
        tokensPerMinute: 100,
        tokensPerHour: 6000,
        confidence: 'high' as const,
      };

      const result = formatter.formatBurnRate(burnRate, '🔥');

      expect(result).toContain('バーンレート:');
      expect(result).not.toContain('Burn Rate:');
      expect(result).toContain('100.0 トークン/分');
    });

    it('should format session info in Japanese', () => {
      const formatter = new Formatter('ja');
      const activeBlock = {
        startTime: new Date('2024-01-01T10:00:00'),
        endTime: new Date('2024-01-01T18:00:00'),
        entries: [],
        isActive: true,
        isGap: false,
      };

      const result = formatter.formatSessionInfo(activeBlock);

      expect(result).toContain('セッション終了時刻:');
      expect(result).toContain('残り');
      expect(result).not.toContain('Session ends at');
      expect(result).not.toContain('remaining');
    });

    it('should format no active session message in Japanese', () => {
      const formatter = new Formatter('ja');
      const result = formatter.formatSessionInfo(null);

      expect(result).toContain('アクティブなセッションなし');
      expect(result).not.toContain('No active session');
    });

    it('should format warning messages in Japanese', () => {
      const formatter = new Formatter('ja');
      const result = formatter.formatWarning('Test warning');

      expect(result).toContain('⚠️  Test warning');
    });

    it('should format error messages in Japanese', () => {
      const formatter = new Formatter('ja');
      const result = formatter.formatError('Test error');

      expect(result).toContain('❌ Test error');
    });

    it('should format success messages in Japanese', () => {
      const formatter = new Formatter('ja');
      const result = formatter.formatSuccess('Test success');

      expect(result).toContain('✅ Test success');
    });

    it('should format plan names in Japanese', () => {
      const formatter = new Formatter('ja');

      expect(formatter.formatPlan('pro')).toContain('Claude Pro (~7k トークン)');
      expect(formatter.formatPlan('max5')).toContain('Claude Max5 (~35k トークン)');
      expect(formatter.formatPlan('max20')).toContain('Claude Max20 (~140k トークン)');
      expect(formatter.formatPlan('custom_max')).toContain('カスタム Max (自動検出)');
    });

    it('should format time remaining in Japanese', () => {
      const formatter = new Formatter('ja');

      expect(formatter.formatTimeRemaining(150)).toBe('2時間 30分');
      expect(formatter.formatTimeRemaining(45)).toBe('45分');
      expect(formatter.formatTimeRemaining(0)).toBe('0分');
    });
  });

  describe('when locale is not set (default English)', () => {
    it('should format messages in English by default', () => {
      const formatter = new Formatter();
      const result = formatter.formatTokenStatus(50000, 100000, 50);

      expect(result).toContain('Tokens:');
      expect(result).not.toContain('トークン:');
    });
  });
});
