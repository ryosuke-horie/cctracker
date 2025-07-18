import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plan } from '../models/types.js';
import { Monitor } from './monitor.js';

// Type definition for testing private methods
type MonitorWithPrivateMethods = Monitor & {
  update: () => Promise<void>;
  updateOnce: () => Promise<void>;
  intervalId?: NodeJS.Timeout;
  isRunning: boolean;
  formatter: {
    hideCursor: () => void;
  };
};

// モック
vi.mock('../core/dataLoader.js');
vi.mock('../core/sessionIdentifier.js');
vi.mock('../core/tokenCalculator.js');
vi.mock('../core/burnRateCalculator.js');
vi.mock('./formatter.js');

describe('Monitor', () => {
  let monitor: Monitor;
  let monitorWithPrivate: MonitorWithPrivateMethods;
  let _consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let _processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    monitor = new Monitor({
      plan: 'pro' as Plan,
      refreshInterval: 1000,
    });
    monitorWithPrivate = monitor as MonitorWithPrivateMethods;
    _consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    _processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('runOnce', () => {
    it('should update once and exit without starting interval', async () => {
      expect(monitor.runOnce).toBeDefined();

      // Mock the private updateOnce method
      const updateOnceSpy = vi.spyOn(monitorWithPrivate, 'updateOnce').mockResolvedValue(undefined);

      await monitor.runOnce();

      // Should call updateOnce exactly once
      expect(updateOnceSpy).toHaveBeenCalledTimes(1);

      // Should not set up any intervals
      expect(monitorWithPrivate.intervalId).toBeUndefined();

      // Should not hide cursor (as it's a one-time run)
      expect(monitorWithPrivate.formatter.hideCursor).not.toHaveBeenCalled();
    });

    it('should not register signal handlers in runOnce mode', async () => {
      const processSpy = vi.spyOn(process, 'on');
      vi.spyOn(monitorWithPrivate, 'updateOnce').mockResolvedValue(undefined);

      await monitor.runOnce();

      // Should not register SIGINT or SIGTERM handlers
      expect(processSpy).not.toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processSpy).not.toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('should handle errors gracefully during runOnce', async () => {
      const errorMessage = 'Test error';
      vi.spyOn(monitorWithPrivate, 'updateOnce').mockRejectedValue(new Error(errorMessage));

      await expect(monitor.runOnce()).rejects.toThrow(errorMessage);
    });
  });

  describe('start', () => {
    it('should set up continuous monitoring with interval', async () => {
      const updateSpy = vi.spyOn(monitorWithPrivate, 'update').mockResolvedValue(undefined);

      // Start the monitor
      monitor.start();

      // Initial update should be called
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(updateSpy).toHaveBeenCalledTimes(1);

      // Should set up interval
      expect(monitorWithPrivate.intervalId).toBeDefined();

      // Should hide cursor for continuous monitoring
      expect(monitorWithPrivate.formatter.hideCursor).toHaveBeenCalled();

      // Clear interval without calling stop() to avoid process.exit
      clearInterval(monitorWithPrivate.intervalId);
      monitorWithPrivate.isRunning = false;
    });
  });
});
