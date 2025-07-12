import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

interface DependabotUpdate {
  'package-ecosystem': string;
  directory: string;
  schedule: {
    interval: string;
    day?: string;
    time?: string;
    timezone?: string;
  };
  'open-pull-requests-limit': number;
  'pull-request-branch-name': {
    separator: string;
  };
  groups: Record<string, {
    patterns: string[];
    'update-types'?: string[];
  }>;
}

interface DependabotConfig {
  version: number;
  updates: DependabotUpdate[];
}

describe('Dependabot Configuration', () => {
  const dependabotConfigPath = resolve(process.cwd(), '.github/dependabot.yml');

  it('should have dependabot configuration file', () => {
    expect(existsSync(dependabotConfigPath), 'dependabot.yml should exist').toBe(true);
  });

  it('should have valid YAML structure', () => {
    const configContent = readFileSync(dependabotConfigPath, 'utf-8');
    expect(() => parse(configContent)).not.toThrow();
  });

  it('should configure npm package manager', () => {
    const configContent = readFileSync(dependabotConfigPath, 'utf-8');
    const config = parse(configContent) as DependabotConfig;
    
    expect(config.version).toBe(2);
    expect(config.updates).toBeDefined();
    
    const npmUpdate = config.updates.find((update) => update['package-ecosystem'] === 'npm');
    expect(npmUpdate).toBeDefined();
    expect(npmUpdate?.directory).toBe('/');
  });

  it('should have grouped dependency updates', () => {
    const configContent = readFileSync(dependabotConfigPath, 'utf-8');
    const config = parse(configContent) as DependabotConfig;
    
    const npmUpdate = config.updates.find((update) => update['package-ecosystem'] === 'npm');
    expect(npmUpdate?.groups).toBeDefined();
    
    // 開発用ライブラリのグループが設定されていることを確認
    expect(npmUpdate?.groups['dev-dependencies']).toBeDefined();
    expect(npmUpdate?.groups['dev-dependencies'].patterns).toContain('@types/*');
    expect(npmUpdate?.groups['dev-dependencies'].patterns).toContain('@biomejs/*');
    
    // 本番用ライブラリのグループが設定されていることを確認
    expect(npmUpdate?.groups['production-dependencies']).toBeDefined();
    expect(npmUpdate?.groups['production-dependencies'].patterns).toContain('commander');
    expect(npmUpdate?.groups['production-dependencies'].patterns).toContain('chalk');
  });

  it('should have appropriate schedule configuration', () => {
    const configContent = readFileSync(dependabotConfigPath, 'utf-8');
    const config = parse(configContent) as DependabotConfig;
    
    const npmUpdate = config.updates.find((update) => update['package-ecosystem'] === 'npm');
    expect(npmUpdate?.schedule).toBeDefined();
    expect(npmUpdate?.schedule.interval).toBe('weekly');
  });

  it('should have security updates configuration', () => {
    const configContent = readFileSync(dependabotConfigPath, 'utf-8');
    const config = parse(configContent) as DependabotConfig;
    
    const npmUpdate = config.updates.find((update) => update['package-ecosystem'] === 'npm');
    expect(npmUpdate?.['open-pull-requests-limit']).toBeGreaterThanOrEqual(5);
    expect(npmUpdate?.['pull-request-branch-name']).toBeDefined();
  });
});