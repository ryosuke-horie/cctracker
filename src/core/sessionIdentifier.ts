import { UsageEntry, SessionBlock } from '../models/types.js';
import { addHours, startOfHour, isAfter, differenceInMinutes } from 'date-fns';

export class SessionIdentifier {
  private sessionHours: number;
  private resetHours: number[];

  constructor(sessionHours = 5, resetHours = [4, 9, 14, 18, 23]) {
    this.sessionHours = sessionHours;
    this.resetHours = resetHours;
  }

  createSessionBlocks(entries: UsageEntry[]): SessionBlock[] {
    if (entries.length === 0) {
      return [];
    }

    const blocks: SessionBlock[] = [];
    let currentBlock: SessionBlock | null = null;

    for (const entry of entries) {
      if (!currentBlock || this.shouldStartNewBlock(currentBlock, entry)) {
        if (currentBlock) {
          this.finalizeBlock(currentBlock);
          blocks.push(currentBlock);
          
          // Check for gap
          const gapMinutes = differenceInMinutes(
            entry.timestamp, 
            currentBlock.actualEndTime || currentBlock.startTime
          );
          
          if (gapMinutes > this.sessionHours * 60) {
            blocks.push(this.createGapBlock(
              currentBlock.actualEndTime || currentBlock.endTime,
              entry.timestamp
            ));
          }
        }

        currentBlock = this.createNewBlock(entry);
      }

      this.addEntryToBlock(currentBlock, entry);
    }

    if (currentBlock) {
      this.finalizeBlock(currentBlock);
      blocks.push(currentBlock);
    }

    return this.markActiveBlocks(blocks);
  }

  private shouldStartNewBlock(block: SessionBlock, entry: UsageEntry): boolean {
    return isAfter(entry.timestamp, block.endTime);
  }

  private createNewBlock(entry: UsageEntry): SessionBlock {
    const startTime = this.alignToResetHour(entry.timestamp);
    const endTime = addHours(startTime, this.sessionHours);

    return {
      id: `session_${startTime.getTime()}`,
      startTime,
      endTime,
      isActive: false,
      isGap: false,
      entries: [],
      tokenCounts: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0
      },
      costUSD: 0,
      models: [],
      durationMinutes: 0
    };
  }

  private createGapBlock(startTime: Date, endTime: Date): SessionBlock {
    return {
      id: `gap_${startTime.getTime()}`,
      startTime,
      endTime,
      isActive: false,
      isGap: true,
      entries: [],
      tokenCounts: {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0
      },
      costUSD: 0,
      models: [],
      durationMinutes: differenceInMinutes(endTime, startTime)
    };
  }

  private alignToResetHour(timestamp: Date): Date {
    const hour = timestamp.getHours();
    const alignedHour = this.resetHours
      .filter(h => h <= hour)
      .pop() || this.resetHours[this.resetHours.length - 1];
    
    return startOfHour(new Date(timestamp.setHours(alignedHour, 0, 0, 0)));
  }

  private addEntryToBlock(block: SessionBlock, entry: UsageEntry): void {
    block.entries.push(entry);
    
    block.tokenCounts.inputTokens += entry.inputTokens;
    block.tokenCounts.outputTokens += entry.outputTokens;
    block.tokenCounts.cacheCreationTokens += entry.cacheCreationTokens;
    block.tokenCounts.cacheReadTokens += entry.cacheReadTokens;
    
    if (entry.costUSD) {
      block.costUSD += entry.costUSD;
    }
    
    if (entry.model && !block.models.includes(entry.model)) {
      block.models.push(entry.model);
    }
    
    block.actualEndTime = entry.timestamp;
  }

  private finalizeBlock(block: SessionBlock): void {
    if (block.actualEndTime) {
      block.durationMinutes = differenceInMinutes(
        block.actualEndTime,
        block.startTime
      );
    } else {
      block.durationMinutes = differenceInMinutes(
        new Date(),
        block.startTime
      );
    }
  }

  private markActiveBlocks(blocks: SessionBlock[]): SessionBlock[] {
    const now = new Date();
    
    return blocks.map(block => ({
      ...block,
      isActive: !block.isGap && isAfter(block.endTime, now)
    }));
  }
}