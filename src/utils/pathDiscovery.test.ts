import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getStandardClaudePaths,
  parsePathList,
  getDefaultDataPaths
} from './pathDiscovery.js';

// Mock OS module
vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/testuser')
}));

describe('pathDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.CLAUDE_DATA_PATHS;
    delete process.env.CLAUDE_DATA_PATH;
  });

  describe('getStandardClaudePaths', () => {
    it('should return standard Claude paths based on home directory', () => {
      const paths = getStandardClaudePaths();
      
      expect(paths).toEqual([
        '/home/testuser/.claude/projects',
        '/home/testuser/.config/claude/projects'
      ]);
    });
  });

  describe('parsePathList', () => {
    it('should parse colon-separated paths', () => {
      const result = parsePathList('/path1:/path2:/path3');
      expect(result).toEqual(['/path1', '/path2', '/path3']);
    });

    it('should parse comma-separated paths', () => {
      const result = parsePathList('/path1,/path2,/path3');
      expect(result).toEqual(['/path1', '/path2', '/path3']);
    });

    it('should return single path when no separators', () => {
      const result = parsePathList('/single/path');
      expect(result).toEqual(['/single/path']);
    });

    it('should handle empty strings', () => {
      expect(parsePathList('')).toEqual([]);
      expect(parsePathList('   ')).toEqual([]);
    });
  });

  describe('getDefaultDataPaths', () => {
    it('should use CLAUDE_DATA_PATHS environment variable when set', () => {
      process.env.CLAUDE_DATA_PATHS = '/env/path1:/env/path2';
      
      const result = getDefaultDataPaths();
      expect(result).toEqual(['/env/path1', '/env/path2']);
    });

    it('should use CLAUDE_DATA_PATH environment variable when set', () => {
      process.env.CLAUDE_DATA_PATH = '/single/env/path';
      
      const result = getDefaultDataPaths();
      expect(result).toEqual(['/single/env/path']);
    });

    it('should return standard paths when no environment variables are set', () => {
      const result = getDefaultDataPaths();
      expect(result).toEqual([
        '/home/testuser/.claude/projects',
        '/home/testuser/.config/claude/projects'
      ]);
    });
  });
});