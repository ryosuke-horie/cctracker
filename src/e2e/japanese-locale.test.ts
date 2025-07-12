import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('Japanese locale support (--ja option)', () => {
  const cliPath = join(process.cwd(), 'dist', 'cli.js');
  const originalClaudeDataPath = process.env.CLAUDE_DATA_PATH;
  const testDataPath = join(homedir(), 'Library', 'Application Support', 'Claude');

  beforeAll(() => {
    // 実データパスが存在しない場合はスキップ
    if (!existsSync(testDataPath)) {
      console.warn(`Skipping E2E tests: Claude data path not found at ${testDataPath}`);
      return;
    }

    // Set test data path
    process.env.CLAUDE_DATA_PATH = testDataPath;
  });

  afterAll(() => {
    // Restore original environment
    if (originalClaudeDataPath) {
      process.env.CLAUDE_DATA_PATH = originalClaudeDataPath;
    } else {
      delete process.env.CLAUDE_DATA_PATH;
    }
  });

  it('should display messages in Japanese when --ja option is used', () => {
    if (!existsSync(testDataPath)) {
      return; // Skip if no data
    }

    const output = execSync(`node "${cliPath}" --ja`, { encoding: 'utf-8' });

    // 日本語メッセージの確認
    expect(output).toContain('Claude Code 使用状況');
    expect(output).toContain('プラン:');
    expect(output).toContain('トークン:');
    expect(output).toContain('バーンレート:');
    expect(output).not.toContain('Claude Code Usage Status');
    expect(output).not.toContain('Plan:');
    expect(output).not.toContain('Tokens:');
    expect(output).not.toContain('Burn Rate:');
  });

  it('should display help messages in Japanese when --ja option is used with --help', () => {
    const output = execSync(`node "${cliPath}" --ja --help`, { encoding: 'utf-8' });

    // --jaオプションが日本語で表示されていることを確認
    expect(output).toContain('日本語で表示');
    // 基本的な構造は英語でも許容する（commander.jsの制限のため）
    expect(output).toContain('Usage:');
    expect(output).toContain('Options:');
    expect(output).toContain('Commands:');
  });

  it('should display info command output in Japanese when --ja option is used', () => {
    if (!existsSync(testDataPath)) {
      return; // Skip if no data
    }

    const output = execSync(`node "${cliPath}" info --ja`, { encoding: 'utf-8' });

    // 日本語情報メッセージの確認
    expect(output).toContain('Claude データパス:');
    expect(output).toContain('デフォルトパス:');
    expect(output).toContain('検出されたパス:');
    expect(output).toContain('ヒント:');
    // 使用状況分析は実際のデータが存在する場合のみ表示される
  });

  it('should display error messages in Japanese when --ja option is used with invalid plan', () => {
    const invalidPlan = 'invalid_plan';

    try {
      execSync(`node "${cliPath}" --ja --plan ${invalidPlan}`, { encoding: 'utf-8' });
      // Should not reach here
      expect(false).toBe(true);
    } catch (error: unknown) {
      const execError = error as { stdout: string; stderr: string };
      const output = execError.stdout + execError.stderr;
      expect(output).toContain('無効なプラン:');
      expect(output).toContain('有効なプラン:');
    }
  });
});
