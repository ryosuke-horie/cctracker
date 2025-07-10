import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { UsageEntry, RawUsageData } from '../models/types.js';
import { discoverClaudeDataPaths, findJsonlFiles, getDefaultDataPaths } from '../utils/pathDiscovery.js';

export class DataLoader {
  private dataPath: string | null = null;

  constructor(dataPath?: string) {
    this.dataPath = dataPath || null;
  }

  async loadUsageData(): Promise<UsageEntry[]> {
    const paths = this.dataPath 
      ? [this.dataPath] 
      : await discoverClaudeDataPaths(getDefaultDataPaths());

    if (paths.length === 0) {
      return [];
    }

    const jsonlFiles = await findJsonlFiles(paths);
    if (jsonlFiles.length === 0) {
      return [];
    }

    const allEntries: UsageEntry[] = [];
    const processedHashes = new Set<string>();

    for (const filePath of jsonlFiles) {
      const entries = await this.parseJsonlFile(filePath, processedHashes);
      allEntries.push(...entries);
    }

    return allEntries.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private async parseJsonlFile(
    filePath: string, 
    processedHashes: Set<string>
  ): Promise<UsageEntry[]> {
    const entries: UsageEntry[] = [];
    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const data: RawUsageData = JSON.parse(line);
        
        const uniqueHash = this.createUniqueHash(data);
        if (uniqueHash && processedHashes.has(uniqueHash)) {
          continue;
        }

        const entry = this.convertToUsageEntry(data);
        if (entry) {
          entries.push(entry);
          if (uniqueHash) {
            processedHashes.add(uniqueHash);
          }
        }
      } catch (error) {
        // Skip invalid JSON lines
      }
    }

    return entries;
  }

  private createUniqueHash(data: RawUsageData): string | null {
    let messageId: string | undefined;
    const requestId = data.requestId || data.request_id;

    if (data.message && typeof data.message === 'object') {
      messageId = data.message.id;
    } else {
      messageId = data.message_id;
    }

    if (!messageId || !requestId) {
      return null;
    }

    return `${messageId}:${requestId}`;
  }

  private convertToUsageEntry(data: RawUsageData): UsageEntry | null {
    try {
      if (!data.timestamp) {
        return null;
      }

      const timestamp = new Date(data.timestamp);
      if (isNaN(timestamp.getTime())) {
        return null;
      }

      let usage = data.usage || {};
      if (Object.keys(usage).length === 0 && data.message?.usage) {
        usage = data.message.usage;
      }

      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
      const cacheReadTokens = usage.cache_read_input_tokens || 0;

      const model = data.model || data.message?.model || '';
      const messageId = data.message_id || data.message?.id;
      const requestId = data.request_id || data.requestId;
      const costUSD = data.cost || data.costUSD;

      return {
        timestamp,
        inputTokens,
        outputTokens,
        cacheCreationTokens,
        cacheReadTokens,
        costUSD,
        model,
        messageId,
        requestId
      };
    } catch (error) {
      return null;
    }
  }
}