import type { ReadStream } from 'node:fs';
import type { Interface } from 'node:readline';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataLoader } from './dataLoader.js';

// Mock types for Node.js modules
type MockReadStream = Partial<ReadStream>;
type MockInterface = Partial<Interface> & {
  [Symbol.asyncIterator]: () => AsyncIterableIterator<string>;
};

// Type for accessing private methods in tests
type DataLoaderWithPrivateMethods = DataLoader & {
  convertToUsageEntry: (data: unknown) => unknown;
};

// Mock the path discovery module
vi.mock('../utils/pathDiscovery.js', () => ({
  discoverClaudeDataPaths: vi.fn(),
  findJsonlFiles: vi.fn(),
  getDefaultDataPaths: vi.fn(),
}));

// Mock fs module
vi.mock('fs', () => ({
  createReadStream: vi.fn(),
}));

// Mock readline module
vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

describe('DataLoader', () => {
  let dataLoader: DataLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    dataLoader = new DataLoader();
  });

  describe('loadUsageData', () => {
    it('should return empty array when no JSONL files found', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue([]);

      const result = await dataLoader.loadUsageData();

      expect(result).toEqual([]);
    });

    it('should return empty array when no data paths found', async () => {
      const { discoverClaudeDataPaths } = await import('../utils/pathDiscovery.js');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue([]);

      const result = await dataLoader.loadUsageData();

      expect(result).toEqual([]);
    });

    it('should parse JSONL files and return sorted usage entries', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      // Mock path discovery
      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      // Create mock JSONL data
      const mockJsonlData = [
        '{"timestamp":"2024-01-15T10:00:00Z","usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}',
        '{"timestamp":"2024-01-15T09:00:00Z","usage":{"input_tokens":200,"output_tokens":100},"model":"claude-3-opus","message_id":"msg2","request_id":"req2"}',
      ];

      // Mock readline interface
      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(2);
      // Should be sorted chronologically (9:00 comes before 10:00)
      expect(result[0].timestamp.getTime()).toBeLessThan(result[1].timestamp.getTime());
      expect(result[0].inputTokens).toBe(200);
      expect(result[1].inputTokens).toBe(100);
    });

    it('should deduplicate entries with same message_id and request_id', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      // Same message_id and request_id = duplicate
      const mockJsonlData = [
        '{"timestamp":"2024-01-15T10:00:00Z","usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}',
        '{"timestamp":"2024-01-15T10:01:00Z","usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}', // Duplicate
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(1); // Should deduplicate
      expect(result[0].messageId).toBe('msg1');
    });

    it('should handle nested message structure', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{"timestamp":"2024-01-15T10:00:00Z","message":{"id":"msg1","model":"claude-3-sonnet","usage":{"input_tokens":150,"output_tokens":75}},"request_id":"req1"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(1);
      expect(result[0].inputTokens).toBe(150);
      expect(result[0].outputTokens).toBe(75);
      expect(result[0].model).toBe('claude-3-sonnet');
      expect(result[0].messageId).toBe('msg1');
    });

    it('should handle cache tokens correctly', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{"timestamp":"2024-01-15T10:00:00Z","usage":{"input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":25,"cache_read_input_tokens":10},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(1);
      expect(result[0].cacheCreationTokens).toBe(25);
      expect(result[0].cacheReadTokens).toBe(10);
    });

    it('should skip invalid JSON lines', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{"timestamp":"2024-01-15T10:00:00Z","usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}',
        '{invalid json}', // Invalid JSON
        '', // Empty line
        '{"timestamp":"2024-01-15T10:01:00Z","usage":{"input_tokens":200,"output_tokens":100},"model":"claude-3-sonnet","message_id":"msg2","request_id":"req2"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(2); // Should skip invalid lines
      expect(result[0].messageId).toBe('msg1');
      expect(result[1].messageId).toBe('msg2');
    });

    it('should skip entries without timestamp', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{"usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}', // No timestamp
        '{"timestamp":"2024-01-15T10:01:00Z","usage":{"input_tokens":200,"output_tokens":100},"model":"claude-3-sonnet","message_id":"msg2","request_id":"req2"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(1); // Should skip entry without timestamp
      expect(result[0].messageId).toBe('msg2');
    });

    it('should handle invalid timestamp formats', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{"timestamp":"invalid-date","usage":{"input_tokens":100,"output_tokens":50},"model":"claude-3-sonnet","message_id":"msg1","request_id":"req1"}',
        '{"timestamp":"2024-01-15T10:01:00Z","usage":{"input_tokens":200,"output_tokens":100},"model":"claude-3-sonnet","message_id":"msg2","request_id":"req2"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(1); // Should skip entry with invalid timestamp
      expect(result[0].messageId).toBe('msg2');
    });

    it('should handle entries without message_id for deduplication', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{\"timestamp\":\"2024-01-15T10:00:00Z\",\"usage\":{\"input_tokens\":100,\"output_tokens\":50},\"model\":\"claude-3-sonnet\",\"request_id\":\"req1\"}', // Missing message_id
        '{\"timestamp\":\"2024-01-15T10:01:00Z\",\"usage\":{\"input_tokens\":100,\"output_tokens\":50},\"model\":\"claude-3-sonnet\",\"request_id\":\"req1\"}', // Duplicate without message_id (should not be deduplicated)
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(2); // Both entries should be included (no deduplication)
    });

    it('should handle entries without request_id for deduplication', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      const mockJsonlData = [
        '{\"timestamp\":\"2024-01-15T10:00:00Z\",\"usage\":{\"input_tokens\":100,\"output_tokens\":50},\"model\":\"claude-3-sonnet\",\"message_id\":\"msg1\"}', // Missing request_id
        '{\"timestamp\":\"2024-01-15T10:01:00Z\",\"usage\":{\"input_tokens\":100,\"output_tokens\":50},\"model\":\"claude-3-sonnet\",\"message_id\":\"msg1\"}', // Duplicate without request_id (should not be deduplicated)
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(2); // Both entries should be included (no deduplication)
    });

    it('should handle parsing errors in convertToUsageEntry', async () => {
      const { discoverClaudeDataPaths, findJsonlFiles } = await import('../utils/pathDiscovery.js');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      vi.mocked(discoverClaudeDataPaths).mockResolvedValue(['/test/path']);
      vi.mocked(findJsonlFiles).mockResolvedValue(['/test/file.jsonl']);

      // Mock the DataLoader to force an exception in convertToUsageEntry
      const _originalConvert = dataLoader.convertToUsageEntry;
      vi.spyOn(
        dataLoader as DataLoaderWithPrivateMethods,
        'convertToUsageEntry'
      ).mockImplementationOnce(() => {
        throw new Error('Parsing error');
      });

      const mockJsonlData = [
        '{\"timestamp\":\"2024-01-15T10:00:00Z\",\"usage\":{\"input_tokens\":100,\"output_tokens\":50},\"model\":\"claude-3-sonnet\",\"message_id\":\"msg1\",\"request_id\":\"req1\"}',
      ];

      const mockReadline = {
        [Symbol.asyncIterator]: async function* () {
          for (const line of mockJsonlData) {
            yield line;
          }
        },
      };

      vi.mocked(fs.createReadStream).mockReturnValue({} as MockReadStream);
      vi.mocked(readline.createInterface).mockReturnValue(mockReadline as MockInterface);

      const result = await dataLoader.loadUsageData();

      expect(result).toHaveLength(0); // Should skip entry that causes parsing error
    });
  });

  describe('Custom data path', () => {
    it('should use custom data path when provided', async () => {
      const customDataLoader = new DataLoader('/custom/path');
      const { findJsonlFiles } = await import('../utils/pathDiscovery.js');

      vi.mocked(findJsonlFiles).mockResolvedValue([]);

      const result = await customDataLoader.loadUsageData();

      expect(findJsonlFiles).toHaveBeenCalledWith(['/custom/path']);
      expect(result).toEqual([]);
    });
  });
});
