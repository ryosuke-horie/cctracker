import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, statSync } from 'fs';
import { readdir } from 'fs/promises';

export function getStandardClaudePaths(): string[] {
  const home = homedir();
  return [
    join(home, '.claude', 'projects'),
    join(home, '.config', 'claude', 'projects')
  ];
}

export async function discoverClaudeDataPaths(customPaths?: string[]): Promise<string[]> {
  const pathsToCheck = customPaths || getStandardClaudePaths();
  const discoveredPaths: string[] = [];

  for (const pathStr of pathsToCheck) {
    const resolvedPath = resolve(pathStr);
    if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
      discoveredPaths.push(resolvedPath);
    }
  }

  return discoveredPaths;
}

export async function findJsonlFiles(dataPaths: string[]): Promise<string[]> {
  const allFiles: string[] = [];
  const seenFiles = new Set<string>();

  for (const dataPath of dataPaths) {
    if (!existsSync(dataPath)) {
      continue;
    }

    const files = await findJsonlFilesRecursive(dataPath);
    
    for (const file of files) {
      const stat = statSync(file);
      const fileSignature = `${file.split('/').pop()}-${stat.size}-${Math.floor(stat.mtimeMs)}`;
      
      if (!seenFiles.has(fileSignature)) {
        seenFiles.add(fileSignature);
        allFiles.push(file);
      }
    }
  }

  return allFiles.sort((a, b) => {
    const aStat = statSync(a);
    const bStat = statSync(b);
    return aStat.mtimeMs - bStat.mtimeMs;
  });
}

async function findJsonlFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subResults = await findJsonlFilesRecursive(fullPath);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return results;
}

export function parsePathList(pathString: string, separator?: string): string[] {
  if (!pathString || !pathString.trim()) {
    return [];
  }

  if (!separator) {
    if (pathString.includes(':') && !pathString.includes(',')) {
      separator = ':';
    } else if (pathString.includes(',')) {
      separator = ',';
    } else {
      return [pathString.trim()];
    }
  }

  return pathString
    .split(separator)
    .map(path => path.trim())
    .filter(path => path.length > 0);
}

export function getDefaultDataPaths(): string[] {
  const envPaths = process.env.CLAUDE_DATA_PATHS;
  if (envPaths) {
    return parsePathList(envPaths);
  }

  const singlePath = process.env.CLAUDE_DATA_PATH;
  if (singlePath) {
    return [singlePath];
  }

  return getStandardClaudePaths();
}